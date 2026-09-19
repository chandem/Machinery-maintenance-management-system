from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.equipment import Equipment
from app.models.inventory import Inventory, Part
from app.models.maintenance import MaintenancePlan, WorkOrder
from app.models.operations import DowntimeEvent, Inspection
from app.schemas.dashboard import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

OPEN_WO_STATUSES = ("draft", "scheduled", "in_progress")


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db)):
    total_equipment = db.scalar(select(func.count()).select_from(Equipment)) or 0
    operational = db.scalar(
        select(func.count()).select_from(Equipment).where(Equipment.status == "operational")
    ) or 0
    down = db.scalar(
        select(func.count()).select_from(Equipment).where(
            Equipment.status.in_(("down", "out_of_service", "maintenance"))
        )
    ) or 0

    open_wo = db.scalar(
        select(func.count()).select_from(WorkOrder).where(WorkOrder.status.in_(OPEN_WO_STATUSES))
    ) or 0

    today = date.today()
    plans = db.execute(
        select(MaintenancePlan, Equipment)
        .join(Equipment, Equipment.id == MaintenancePlan.equipment_id)
        .where(MaintenancePlan.active.is_(True))
    ).all()
    overdue = 0
    for plan, equipment in plans:
        date_overdue = plan.next_due_date is not None and plan.next_due_date < today
        meter_overdue = (
            plan.next_due_meter is not None
            and equipment.hour_meter is not None
            and equipment.hour_meter > plan.next_due_meter
        )
        if date_overdue or meter_overdue:
            overdue += 1

    inv_rows = db.execute(select(Inventory, Part).join(Part, Part.id == Inventory.part_id)).all()
    low_stock = 0
    out_of_stock = 0
    inventory_value = Decimal("0")
    for inv, part in inv_rows:
        if inv.quantity_on_hand <= 0:
            out_of_stock += 1
        elif inv.quantity_on_hand <= part.reorder_level:
            low_stock += 1
        if part.unit_cost is not None:
            inventory_value += inv.quantity_on_hand * part.unit_cost

    open_inspections = db.scalar(
        select(func.count()).select_from(Inspection).where(Inspection.status == "open")
    ) or 0
    open_downtime = db.scalar(
        select(func.count()).select_from(DowntimeEvent).where(DowntimeEvent.ended_at.is_(None))
    ) or 0

    return DashboardSummary(
        total_equipment=total_equipment,
        operational_equipment=operational,
        down_equipment=down,
        open_work_orders=open_wo,
        overdue_maintenance_plans=overdue,
        low_stock_parts=low_stock,
        out_of_stock_parts=out_of_stock,
        total_parts_inventory_value=inventory_value if inventory_value else None,
        open_inspections=open_inspections,
        open_downtime_events=open_downtime,
    )
