from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.equipment import Equipment
from app.models.maintenance import MaintenancePlan, WorkOrder, WorkOrderPart, WorkOrderLabor
from app.models.inventory import Inventory, Part, PartTransaction
from app.schemas.maintenance import (
    MaintenancePlanCreate,
    MaintenancePlanRead,
    WorkOrderCreate,
    WorkOrderRead,
    WorkOrderUpdate,
    WorkOrderPartCreate,
    WorkOrderPartRead,
    WorkOrderLaborCreate,
    WorkOrderLaborRead,
)

router = APIRouter(tags=["maintenance"])


@router.post("/maintenance-plans", response_model=MaintenancePlanRead, status_code=status.HTTP_201_CREATED)
def create_maintenance_plan(payload: MaintenancePlanCreate, db: Session = Depends(get_db)):
    if db.get(Equipment, payload.equipment_id) is None:
        raise HTTPException(status_code=404, detail="Equipment not found")
    plan = MaintenancePlan(**payload.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/maintenance-plans", response_model=list[MaintenancePlanRead])
def list_maintenance_plans(db: Session = Depends(get_db)):
    return db.scalars(select(MaintenancePlan).order_by(MaintenancePlan.id.desc())).all()


@router.post("/work-orders", response_model=WorkOrderRead, status_code=status.HTTP_201_CREATED)
def create_work_order(payload: WorkOrderCreate, db: Session = Depends(get_db)):
    if db.get(Equipment, payload.equipment_id) is None:
        raise HTTPException(status_code=404, detail="Equipment not found")
    if payload.maintenance_plan_id is not None and db.get(MaintenancePlan, payload.maintenance_plan_id) is None:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")
    if db.scalar(select(WorkOrder).where(WorkOrder.work_order_number == payload.work_order_number)):
        raise HTTPException(status_code=409, detail="Work order number already exists")
    order = WorkOrder(**payload.model_dump())
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/work-orders", response_model=list[WorkOrderRead])
def list_work_orders(db: Session = Depends(get_db)):
    return db.scalars(select(WorkOrder).order_by(WorkOrder.id.desc())).all()


@router.get("/work-orders/{work_order_id}", response_model=WorkOrderRead)
def get_work_order(work_order_id: int, db: Session = Depends(get_db)):
    order = db.get(WorkOrder, work_order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Work order not found")
    return order


@router.patch("/work-orders/{work_order_id}", response_model=WorkOrderRead)
def update_work_order(work_order_id: int, payload: WorkOrderUpdate, db: Session = Depends(get_db)):
    order = db.get(WorkOrder, work_order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Work order not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(order, key, value)
    db.commit()
    db.refresh(order)
    return order


@router.post("/work-orders/{work_order_id}/parts", response_model=WorkOrderPartRead, status_code=status.HTTP_201_CREATED)
def add_work_order_part(work_order_id: int, payload: WorkOrderPartCreate, db: Session = Depends(get_db)):
    order = db.get(WorkOrder, work_order_id)
    if order is None:
        raise HTTPException(404, "Work order not found")
    part = db.get(Part, payload.part_id)
    if part is None:
        raise HTTPException(404, "Part not found")
    inventory = db.scalar(select(Inventory).where(Inventory.part_id == payload.part_id))
    if inventory is None or inventory.quantity_on_hand < payload.quantity:
        raise HTTPException(400, "Insufficient stock")
    existing = db.scalar(select(WorkOrderPart).where(WorkOrderPart.work_order_id == work_order_id, WorkOrderPart.part_id == payload.part_id))
    if existing:
        raise HTTPException(409, "Part already added to this work order")
    unit_cost = payload.unit_cost if payload.unit_cost is not None else part.unit_cost
    inventory.quantity_on_hand -= payload.quantity
    item = WorkOrderPart(work_order_id=work_order_id, part_id=payload.part_id, quantity=payload.quantity, unit_cost=unit_cost)
    db.add(item)
    db.add(
        PartTransaction(
            part_id=payload.part_id,
            transaction_type="out",
            quantity=payload.quantity,
            unit_cost=unit_cost,
            reference=order.work_order_number,
            notes=f"Issued to work order {order.work_order_number}",
        )
    )
    if unit_cost is not None:
        current = order.actual_cost or 0
        order.actual_cost = current + payload.quantity * unit_cost
    db.commit()
    db.refresh(item)
    return item


@router.get("/work-orders/{work_order_id}/parts", response_model=list[WorkOrderPartRead])
def list_work_order_parts(work_order_id: int, db: Session = Depends(get_db)):
    if db.get(WorkOrder, work_order_id) is None:
        raise HTTPException(404, "Work order not found")
    return db.scalars(select(WorkOrderPart).where(WorkOrderPart.work_order_id == work_order_id).order_by(WorkOrderPart.id)).all()


@router.post("/work-orders/{work_order_id}/labor", response_model=WorkOrderLaborRead, status_code=status.HTTP_201_CREATED)
def add_work_order_labor(work_order_id: int, payload: WorkOrderLaborCreate, db: Session = Depends(get_db)):
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
    return db.scalars(select(WorkOrderLabor).where(WorkOrderLabor.work_order_id == work_order_id).order_by(WorkOrderLabor.id)).all()
