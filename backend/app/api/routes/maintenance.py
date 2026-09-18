from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.equipment import Equipment
from app.models.maintenance import MaintenancePlan, WorkOrder
from app.schemas.maintenance import (
    MaintenancePlanCreate,
    MaintenancePlanRead,
    WorkOrderCreate,
    WorkOrderRead,
    WorkOrderUpdate,
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
