from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.equipment import Equipment
from app.models.maintenance import WorkOrder
from app.models.operations import DowntimeEvent, FuelRecord
from app.schemas.reports import (
    AvailabilityItem,
    AvailabilityReport,
    CostByEquipment,
    CostReport,
)

router = APIRouter(prefix="/reports", tags=["Reports"])

OPEN_WO = ("draft", "scheduled", "in_progress")


@router.get("/costs", response_model=CostReport)
def cost_report(db: Session = Depends(get_db)):
    equipment_rows = db.scalars(select(Equipment).order_by(Equipment.asset_code)).all()
    by_eq: list[CostByEquipment] = []
    total_wo = Decimal("0")
    total_fuel = Decimal("0")

    for eq in equipment_rows:
        wo_cost = db.scalar(
            select(func.coalesce(func.sum(WorkOrder.actual_cost), 0)).where(WorkOrder.equipment_id == eq.id)
        ) or Decimal("0")
        wo_count = db.scalar(
            select(func.count()).select_from(WorkOrder).where(WorkOrder.equipment_id == eq.id)
        ) or 0
        fuels = db.scalars(select(FuelRecord).where(FuelRecord.equipment_id == eq.id)).all()
        fuel_cost = Decimal("0")
        for f in fuels:
            if f.unit_cost is not None:
                fuel_cost += f.quantity * f.unit_cost
        total = wo_cost + fuel_cost
        if total > 0 or wo_count > 0:
            by_eq.append(
                CostByEquipment(
                    equipment_id=eq.id,
                    asset_code=eq.asset_code,
                    name=eq.name,
                    work_order_cost=wo_cost,
                    fuel_cost=fuel_cost,
                    total_cost=total,
                    work_order_count=wo_count,
                )
            )
        total_wo += wo_cost
        total_fuel += fuel_cost

    by_eq.sort(key=lambda x: x.total_cost, reverse=True)
    return CostReport(
        total_work_order_cost=total_wo,
        total_fuel_cost=total_fuel,
        total_cost=total_wo + total_fuel,
        by_equipment=by_eq,
    )


@router.get("/availability", response_model=AvailabilityReport)
def availability_report(db: Session = Depends(get_db)):
    equipment_rows = db.scalars(select(Equipment).order_by(Equipment.asset_code)).all()
    total = len(equipment_rows)
    operational = sum(1 for e in equipment_rows if e.status == "operational")
    pct = (Decimal(operational) * Decimal("100") / Decimal(total)).quantize(Decimal("0.01")) if total else Decimal("0")
    now = datetime.now(timezone.utc)
    items: list[AvailabilityItem] = []

    for eq in equipment_rows:
        open_events = db.scalars(
            select(DowntimeEvent).where(
                DowntimeEvent.equipment_id == eq.id,
                DowntimeEvent.ended_at.is_(None),
            )
        ).all()
        open_hours: Decimal | None = None
        if open_events:
            hours = Decimal("0")
            for ev in open_events:
                start = ev.started_at
                if start.tzinfo is None:
                    start = start.replace(tzinfo=timezone.utc)
                delta = now - start
                hours += Decimal(str(delta.total_seconds() / 3600)).quantize(Decimal("0.01"))
            open_hours = hours
        total_dt = db.scalar(
            select(func.count()).select_from(DowntimeEvent).where(DowntimeEvent.equipment_id == eq.id)
        ) or 0
        open_wo = db.scalar(
            select(func.count())
            .select_from(WorkOrder)
            .where(WorkOrder.equipment_id == eq.id, WorkOrder.status.in_(OPEN_WO))
        ) or 0
        items.append(
            AvailabilityItem(
                equipment_id=eq.id,
                asset_code=eq.asset_code,
                name=eq.name,
                status=eq.status,
                downtime_hours_open=open_hours,
                downtime_events_total=total_dt,
                open_work_orders=open_wo,
            )
        )

    return AvailabilityReport(
        total_equipment=total,
        operational=operational,
        availability_pct=pct,
        items=items,
    )
