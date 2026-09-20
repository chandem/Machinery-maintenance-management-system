from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_write_user
from app.core.database import get_db
from app.core.pagination import Page, PageParams, paginate
from app.models.equipment import Equipment
from app.models.inventory import Inventory, Part, PartTransaction
from app.models.maintenance import (
    MaintenancePlan,
    WorkOrder,
    WorkOrderLabor,
    WorkOrderPart,
    WorkOrderTask,
)
from app.schemas.maintenance import (
    MaintenancePlanCreate,
    MaintenancePlanRead,
    MaintenanceScheduleStatusRead,
    MaintenanceServiceComplete,
    WorkOrderCostRead,
    WorkOrderCreate,
    WorkOrderLaborCreate,
    WorkOrderLaborRead,
    WorkOrderPartCreate,
    WorkOrderPartRead,
    WorkOrderPartReturn,
    WorkOrderRead,
    WorkOrderTaskCreate,
    WorkOrderTaskRead,
    WorkOrderTaskUpdate,
    WorkOrderUpdate,
)

router = APIRouter(tags=["Maintenance"])

WO_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"scheduled", "in_progress", "completed", "cancelled"},
    "scheduled": {"in_progress", "completed", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "completed": {"verified", "cancelled"},
    "verified": {"closed"},
    "closed": set(),
    "cancelled": set(),
}


def _part_reference(work_order_number: str, part_id: int) -> str:
    return f"WO:{work_order_number}:PART:{part_id}"


def _advance_plan(
    plan: MaintenancePlan,
    equipment: Equipment,
    service_date: date,
    service_meter: Decimal | None,
) -> None:
    meter = service_meter if service_meter is not None else equipment.hour_meter
    plan.last_service_date = service_date
    plan.last_service_meter = meter
    plan.next_due_date = (
        service_date + timedelta(days=plan.interval_days) if plan.interval_days is not None else None
    )
    plan.next_due_meter = (
        meter + plan.interval_hours
        if plan.interval_hours is not None and meter is not None
        else None
    )
    if meter is not None and (equipment.hour_meter is None or meter > equipment.hour_meter):
        equipment.hour_meter = meter


def _validate_status_transition(current: str, new: str) -> None:
    if current == new:
        return
    allowed = WO_TRANSITIONS.get(current, set())
    if new not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition: {current} -> {new}. Allowed: {sorted(allowed) or 'none'}",
        )


@router.post("/maintenance-plans", response_model=MaintenancePlanRead, status_code=status.HTTP_201_CREATED)
def create_maintenance_plan(payload: MaintenancePlanCreate, db: Session = Depends(get_db), _: object = Depends(require_write_user)):
    if db.get(Equipment, payload.equipment_id) is None:
        raise HTTPException(404, "Equipment not found")
    plan = MaintenancePlan(**payload.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/maintenance-plans", response_model=Page[MaintenancePlanRead])
def list_maintenance_plans(
    equipment_id: int | None = None,
    active_only: bool = False,
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    query = select(MaintenancePlan).order_by(MaintenancePlan.id.desc())
    if equipment_id is not None:
        query = query.where(MaintenancePlan.equipment_id == equipment_id)
    if active_only:
        query = query.where(MaintenancePlan.active.is_(True))
    return paginate(db, query, params, MaintenancePlanRead)


@router.post("/maintenance-plans/{plan_id}/complete", response_model=MaintenancePlanRead)
def complete_maintenance_service(
    plan_id: int,
    payload: MaintenanceServiceComplete,
    db: Session = Depends(get_db),
    _: object = Depends(require_write_user),
):
    plan = db.get(MaintenancePlan, plan_id)
    if plan is None:
        raise HTTPException(404, "Maintenance plan not found")
    equipment = db.get(Equipment, plan.equipment_id)
    if equipment is None:
        raise HTTPException(404, "Equipment not found")
    if plan.next_due_date is not None and payload.service_date < plan.next_due_date:
        raise HTTPException(400, "Service date cannot be before the scheduled due date")
    if (
        payload.service_meter is not None
        and plan.next_due_meter is not None
        and payload.service_meter < plan.next_due_meter
    ):
        raise HTTPException(400, "Service meter cannot be below the scheduled due meter")
    _advance_plan(plan, equipment, payload.service_date, payload.service_meter)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/maintenance-plans/status", response_model=list[MaintenanceScheduleStatusRead])
def maintenance_plan_status(db: Session = Depends(get_db)):
    plans = db.execute(
        select(MaintenancePlan, Equipment)
        .join(Equipment, Equipment.id == MaintenancePlan.equipment_id)
        .where(MaintenancePlan.active.is_(True))
        .order_by(MaintenancePlan.next_due_date, MaintenancePlan.id)
    ).all()
    today = date.today()
    result = []
    for plan, equipment in plans:
        date_due = plan.next_due_date is not None and plan.next_due_date <= today
        meter_due = (
            plan.next_due_meter is not None
            and equipment.hour_meter is not None
            and equipment.hour_meter >= plan.next_due_meter
        )
        if date_due or meter_due:
            schedule_status = (
                "overdue"
                if (
                    (plan.next_due_date is not None and plan.next_due_date < today)
                    or (
                        plan.next_due_meter is not None
                        and equipment.hour_meter is not None
                        and equipment.hour_meter > plan.next_due_meter
                    )
                )
                else "due"
            )
        else:
            schedule_status = "scheduled"
        result.append(
            MaintenanceScheduleStatusRead(
                id=plan.id,
                equipment_id=equipment.id,
                equipment_name=equipment.name,
                asset_code=equipment.asset_code,
                name=plan.name,
                next_due_date=plan.next_due_date,
                next_due_meter=plan.next_due_meter,
                current_meter=equipment.hour_meter,
                status=schedule_status,
            )
        )
    return result


@router.post("/work-orders", response_model=WorkOrderRead, status_code=status.HTTP_201_CREATED)
def create_work_order(payload: WorkOrderCreate, db: Session = Depends(get_db), _: object = Depends(require_write_user)):
    if db.get(Equipment, payload.equipment_id) is None:
        raise HTTPException(404, "Equipment not found")
    if payload.maintenance_plan_id is not None:
        plan = db.get(MaintenancePlan, payload.maintenance_plan_id)
        if plan is None:
            raise HTTPException(404, "Maintenance plan not found")
        if plan.equipment_id != payload.equipment_id:
            raise HTTPException(400, "Maintenance plan does not belong to this equipment")
    if db.scalar(select(WorkOrder).where(WorkOrder.work_order_number == payload.work_order_number)):
        raise HTTPException(409, "Work order number already exists")
    order = WorkOrder(**payload.model_dump())
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/work-orders", response_model=Page[WorkOrderRead])
def list_work_orders(
    status_filter: str | None = None,
    equipment_id: int | None = None,
    priority: str | None = None,
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    query = select(WorkOrder).order_by(WorkOrder.id.desc())
    if status_filter:
        query = query.where(WorkOrder.status == status_filter)
    if equipment_id is not None:
        query = query.where(WorkOrder.equipment_id == equipment_id)
    if priority:
        query = query.where(WorkOrder.priority == priority)
    return paginate(db, query, params, WorkOrderRead)


@router.get("/work-orders/{work_order_id}", response_model=WorkOrderRead)
def get_work_order(work_order_id: int, db: Session = Depends(get_db)):
    order = db.get(WorkOrder, work_order_id)
    if order is None:
        raise HTTPException(404, "Work order not found")
    return order


@router.patch("/work-orders/{work_order_id}", response_model=WorkOrderRead)
def update_work_order(
    work_order_id: int,
    payload: WorkOrderUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(require_write_user),
):
    order = db.get(WorkOrder, work_order_id)
    if order is None:
        raise HTTPException(404, "Work order not found")
    changes = payload.model_dump(exclude_unset=True)

    if "status" in changes and changes["status"] is not None:
        _validate_status_transition(order.status, changes["status"])
        if changes["status"] == "closed" and order.maintenance_type == "preventive":
            incomplete = db.scalar(
                select(func.count())
                .select_from(WorkOrderTask)
                .where(
                    WorkOrderTask.work_order_id == work_order_id,
                    WorkOrderTask.status != "done",
                )
            ) or 0
            if incomplete:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot close preventive work order with {incomplete} incomplete task(s)",
                )
        now = datetime.now(timezone.utc)
        new_status = changes["status"]
        if new_status == "in_progress" and order.started_at is None:
            changes.setdefault("started_at", now)
        elif new_status == "completed" and order.completed_at is None:
            changes.setdefault("completed_at", now)
        elif new_status == "verified" and order.verified_at is None:
            changes.setdefault("verified_at", now)
        elif new_status == "closed" and order.closed_at is None:
            changes.setdefault("closed_at", now)

    was_completed = order.status == "completed"
    for key, value in changes.items():
        setattr(order, key, value)

    if changes.get("status") == "completed" and not was_completed and order.maintenance_plan_id is not None:
        plan = db.get(MaintenancePlan, order.maintenance_plan_id)
        equipment = db.get(Equipment, order.equipment_id)
        if plan is not None and equipment is not None:
            service_date = order.completed_at.date() if order.completed_at is not None else date.today()
            _advance_plan(plan, equipment, service_date, equipment.hour_meter)

    db.commit()
    db.refresh(order)
    return order


@router.get("/work-orders/{work_order_id}/cost", response_model=WorkOrderCostRead)
def get_work_order_cost(work_order_id: int, db: Session = Depends(get_db)):
    order = db.get(WorkOrder, work_order_id)
    if order is None:
        raise HTTPException(404, "Work order not found")
    parts = db.scalars(select(WorkOrderPart).where(WorkOrderPart.work_order_id == work_order_id)).all()
    parts_cost = Decimal("0")
    for item in parts:
        if item.unit_cost is None:
            continue
        returned = db.scalar(
            select(func.coalesce(func.sum(PartTransaction.quantity), 0)).where(
                PartTransaction.part_id == item.part_id,
                PartTransaction.transaction_type == "in",
                PartTransaction.reference == _part_reference(order.work_order_number, item.part_id),
            )
        ) or Decimal("0")
        parts_cost += max(item.quantity - returned, Decimal("0")) * item.unit_cost
    labor_cost = db.scalar(
        select(func.coalesce(func.sum(WorkOrderLabor.hours * WorkOrderLabor.hourly_rate), 0)).where(
            WorkOrderLabor.work_order_id == work_order_id
        )
    ) or Decimal("0")
    return WorkOrderCostRead(
        work_order_id=order.id,
        estimated_cost=order.estimated_cost,
        parts_cost=parts_cost,
        labor_cost=labor_cost,
        total_cost=parts_cost + labor_cost,
        recorded_actual_cost=order.actual_cost,
    )


@router.post(
    "/work-orders/{work_order_id}/parts",
    response_model=WorkOrderPartRead,
    status_code=status.HTTP_201_CREATED,
)
def add_work_order_part(
    work_order_id: int,
    payload: WorkOrderPartCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_write_user),
):
    order = db.get(WorkOrder, work_order_id)
    if order is None:
        raise HTTPException(404, "Work order not found")
    part = db.get(Part, payload.part_id)
    if part is None:
        raise HTTPException(404, "Part not found")
    inventory = db.scalar(select(Inventory).where(Inventory.part_id == payload.part_id))
    if inventory is None or inventory.quantity_on_hand < payload.quantity:
        raise HTTPException(400, "Insufficient stock")
    if db.scalar(
        select(WorkOrderPart).where(
            WorkOrderPart.work_order_id == work_order_id, WorkOrderPart.part_id == payload.part_id
        )
    ):
        raise HTTPException(409, "Part already added to this work order")
    unit_cost = payload.unit_cost if payload.unit_cost is not None else part.unit_cost
    inventory.quantity_on_hand -= payload.quantity
    item = WorkOrderPart(
        work_order_id=work_order_id,
        part_id=payload.part_id,
        quantity=payload.quantity,
        unit_cost=unit_cost,
    )
    db.add(item)
    db.add(
        PartTransaction(
            part_id=payload.part_id,
            transaction_type="out",
            quantity=payload.quantity,
            unit_cost=unit_cost,
            reference=_part_reference(order.work_order_number, payload.part_id),
            notes=f"Issued to work order {order.work_order_number}",
        )
    )
    if unit_cost is not None:
        order.actual_cost = (order.actual_cost or 0) + payload.quantity * unit_cost
    db.commit()
    db.refresh(item)
    return item


@router.get("/work-orders/{work_order_id}/parts", response_model=list[WorkOrderPartRead])
def list_work_order_parts(work_order_id: int, db: Session = Depends(get_db)):
    if db.get(WorkOrder, work_order_id) is None:
        raise HTTPException(404, "Work order not found")
    return list(
        db.scalars(
            select(WorkOrderPart).where(WorkOrderPart.work_order_id == work_order_id).order_by(WorkOrderPart.id)
        ).all()
    )


@router.post(
    "/work-orders/{work_order_id}/parts/{work_order_part_id}/return",
    response_model=WorkOrderPartRead,
)
def return_work_order_part(
    work_order_id: int,
    work_order_part_id: int,
    payload: WorkOrderPartReturn,
    db: Session = Depends(get_db),
    _: object = Depends(require_write_user),
):
    order = db.get(WorkOrder, work_order_id)
    if order is None:
        raise HTTPException(404, "Work order not found")
    item = db.get(WorkOrderPart, work_order_part_id)
    if item is None or item.work_order_id != work_order_id:
        raise HTTPException(404, "Work order part not found")
    reference = _part_reference(order.work_order_number, item.part_id)
    returned = db.scalar(
        select(func.coalesce(func.sum(PartTransaction.quantity), 0)).where(
            PartTransaction.part_id == item.part_id,
            PartTransaction.transaction_type == "in",
            PartTransaction.reference == reference,
        )
    ) or 0
    if payload.quantity > item.quantity - returned:
        raise HTTPException(400, "Return quantity exceeds remaining issued quantity")
    inventory = db.scalar(select(Inventory).where(Inventory.part_id == item.part_id))
    if inventory is None:
        raise HTTPException(404, "Inventory record not found")
    inventory.quantity_on_hand += payload.quantity
    db.add(
        PartTransaction(
            part_id=item.part_id,
            transaction_type="in",
            quantity=payload.quantity,
            unit_cost=item.unit_cost,
            reference=reference,
            notes=payload.notes or f"Returned from work order {order.work_order_number}",
        )
    )
    if item.unit_cost is not None:
        order.actual_cost = max((order.actual_cost or 0) - payload.quantity * item.unit_cost, 0)
    db.commit()
    db.refresh(item)
    return item


@router.post(
    "/work-orders/{work_order_id}/labor",
    response_model=WorkOrderLaborRead,
    status_code=status.HTTP_201_CREATED,
)
def add_work_order_labor(
    work_order_id: int,
    payload: WorkOrderLaborCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_write_user),
):
    order = db.get(WorkOrder, work_order_id)
    if order is None:
        raise HTTPException(404, "Work order not found")
    item = WorkOrderLabor(work_order_id=work_order_id, **payload.model_dump())
    db.add(item)
    order.actual_cost = (order.actual_cost or 0) + payload.hours * payload.hourly_rate
    db.commit()
    db.refresh(item)
    return item


@router.get("/work-orders/{work_order_id}/labor", response_model=list[WorkOrderLaborRead])
def list_work_order_labor(work_order_id: int, db: Session = Depends(get_db)):
    if db.get(WorkOrder, work_order_id) is None:
        raise HTTPException(404, "Work order not found")
    return list(
        db.scalars(
            select(WorkOrderLabor).where(WorkOrderLabor.work_order_id == work_order_id).order_by(WorkOrderLabor.id)
        ).all()
    )


@router.post(
    "/work-orders/{work_order_id}/tasks",
    response_model=WorkOrderTaskRead,
    status_code=status.HTTP_201_CREATED,
)
def add_work_order_task(
    work_order_id: int,
    payload: WorkOrderTaskCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_write_user),
):
    if db.get(WorkOrder, work_order_id) is None:
        raise HTTPException(404, "Work order not found")
    item = WorkOrderTask(work_order_id=work_order_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/work-orders/{work_order_id}/tasks", response_model=list[WorkOrderTaskRead])
def list_work_order_tasks(work_order_id: int, db: Session = Depends(get_db)):
    if db.get(WorkOrder, work_order_id) is None:
        raise HTTPException(404, "Work order not found")
    return list(
        db.scalars(
            select(WorkOrderTask).where(WorkOrderTask.work_order_id == work_order_id).order_by(WorkOrderTask.id)
        ).all()
    )


@router.patch(
    "/work-orders/{work_order_id}/tasks/{task_id}",
    response_model=WorkOrderTaskRead,
)
def update_work_order_task(
    work_order_id: int,
    task_id: int,
    payload: WorkOrderTaskUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(require_write_user),
):
    item = db.get(WorkOrderTask, task_id)
    if item is None or item.work_order_id != work_order_id:
        raise HTTPException(404, "Task not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item
