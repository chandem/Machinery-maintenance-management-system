from datetime import date, datetime, timezone, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.equipment import Equipment
from app.models.maintenance import WorkOrder, WorkOrderLabor, WorkOrderPart
from app.models.operations import DowntimeEvent, FuelRecord
from app.schemas.reports import AvailabilityItem, AvailabilityReport, CostByEquipment, CostReport

router = APIRouter(prefix="/reports", tags=["Reports"])
OPEN_WO = ("draft", "scheduled", "in_progress")


def _start(value: date) -> datetime:
    return datetime.combine(value, datetime.min.time(), tzinfo=timezone.utc)


def _end(value: date) -> datetime:
    return datetime.combine(value + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)


def _filters(start_date: date | None, end_date: date | None):
    if start_date is not None and end_date is not None and start_date > end_date:
        raise HTTPException(400, "start_date cannot be after end_date")


@router.get("/costs", response_model=CostReport)
def cost_report(
    equipment_id: int | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    db: Session = Depends(get_db),
):
    _filters(start_date, end_date)
    equipment_query = select(Equipment).order_by(Equipment.asset_code)
    if equipment_id is not None:
        equipment_query = equipment_query.where(Equipment.id == equipment_id)
    equipment_rows = list(db.scalars(equipment_query).all())
    by_eq = []
    total_wo = Decimal("0")
    total_fuel = Decimal("0")

    for eq in equipment_rows:
        wo_query = select(WorkOrder).where(WorkOrder.equipment_id == eq.id)
        if start_date is not None:
            wo_query = wo_query.where(WorkOrder.created_at >= _start(start_date))
        if end_date is not None:
            wo_query = wo_query.where(WorkOrder.created_at < _end(end_date))
        wo_rows = list(db.scalars(wo_query).all())
        wo_cost = sum((Decimal(w.actual_cost or 0) for w in wo_rows if w.status != "cancelled"), Decimal("0"))
        wo_count = sum(1 for w in wo_rows if w.status != "cancelled")

        fuel_query = select(FuelRecord).where(FuelRecord.equipment_id == eq.id)
        if start_date is not None:
            fuel_query = fuel_query.where(FuelRecord.recorded_at >= _start(start_date))
        if end_date is not None:
            fuel_query = fuel_query.where(FuelRecord.recorded_at < _end(end_date))
        fuels = list(db.scalars(fuel_query).all())
        fuel_cost = sum((Decimal(f.quantity or 0) * Decimal(f.unit_cost or 0) for f in fuels if f.unit_cost is not None), Decimal("0"))

        total = wo_cost + fuel_cost
        if total > 0 or wo_count > 0:
            by_eq.append(CostByEquipment(equipment_id=eq.id, asset_code=eq.asset_code, name=eq.name, work_order_cost=wo_cost, fuel_cost=fuel_cost, total_cost=total, work_order_count=wo_count))
        total_wo += wo_cost
        total_fuel += fuel_cost

    by_eq.sort(key=lambda x: x.total_cost, reverse=True)
    return CostReport(total_work_order_cost=total_wo, total_fuel_cost=total_fuel, total_cost=total_wo + total_fuel, by_equipment=by_eq)


@router.get("/availability", response_model=AvailabilityReport)
def availability_report(
    equipment_id: int | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    db: Session = Depends(get_db),
):
    _filters(start_date, end_date)
    equipment_query = select(Equipment).order_by(Equipment.asset_code)
    if equipment_id is not None:
        equipment_query = equipment_query.where(Equipment.id == equipment_id)
    equipment_rows = list(db.scalars(equipment_query).all())
    total = len(equipment_rows)
    operational = sum(1 for e in equipment_rows if e.status == "operational")
    pct = (Decimal(operational) * Decimal("100") / Decimal(total)).quantize(Decimal("0.01")) if total else Decimal("0")
    now = datetime.now(timezone.utc)
    items = []

    for eq in equipment_rows:
        open_events_query = select(DowntimeEvent).where(DowntimeEvent.equipment_id == eq.id, DowntimeEvent.ended_at.is_(None))
        if start_date is not None:
            open_events_query = open_events_query.where(DowntimeEvent.started_at >= _start(start_date))
        if end_date is not None:
            open_events_query = open_events_query.where(DowntimeEvent.started_at < _end(end_date))
        open_events = list(db.scalars(open_events_query).all())
        open_hours = None
        if open_events:
            open_hours = sum((Decimal(str(max((now - (ev.started_at.replace(tzinfo=timezone.utc) if ev.started_at.tzinfo is None else ev.started_at)).total_seconds(), 0) / 3600)).quantize(Decimal("0.01")) for ev in open_events), Decimal("0"))

        dt_query = select(func.count()).select_from(DowntimeEvent).where(DowntimeEvent.equipment_id == eq.id)
        if start_date is not None:
            dt_query = dt_query.where(DowntimeEvent.started_at >= _start(start_date))
        if end_date is not None:
            dt_query = dt_query.where(DowntimeEvent.started_at < _end(end_date))
        total_dt = db.scalar(dt_query) or 0

        wo_query = select(func.count()).select_from(WorkOrder).where(WorkOrder.equipment_id == eq.id, WorkOrder.status.in_(OPEN_WO))
        if start_date is not None:
            wo_query = wo_query.where(WorkOrder.created_at >= _start(start_date))
        if end_date is not None:
            wo_query = wo_query.where(WorkOrder.created_at < _end(end_date))
        open_wo = db.scalar(wo_query) or 0

        items.append(AvailabilityItem(equipment_id=eq.id, asset_code=eq.asset_code, name=eq.name, status=eq.status, downtime_hours_open=open_hours, downtime_events_total=total_dt, open_work_orders=open_wo))

    return AvailabilityReport(total_equipment=total, operational=operational, availability_pct=pct, items=items)
