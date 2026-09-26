from datetime import date, datetime, timezone, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.equipment import Equipment, MeterReading
from app.models.maintenance import MaintenancePlan, WorkOrder, WorkOrderLabor, WorkOrderPart
from app.models.operations import DowntimeEvent, FuelRecord
from app.schemas.analytics import (
    FleetAnalyticsRead,
    FleetCostTrendRead,
    FleetEquipmentAnalyticsRead,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])
OPEN_WO_STATUSES = ("draft", "scheduled", "in_progress")
CLOSED_WO_STATUSES = ("completed", "verified", "closed", "cancelled")


def _period_start(value: date) -> datetime:
    return datetime.combine(value, datetime.min.time(), tzinfo=timezone.utc)


def _period_end(value: date) -> datetime:
    return datetime.combine(value + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)


def _hours(start: datetime, end: datetime) -> Decimal:
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return Decimal(str(max((end - start).total_seconds(), 0) / 3600))


@router.get("/fleet", response_model=FleetAnalyticsRead)
def fleet_analytics(
    equipment_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
):
    if start_date is not None and end_date is not None and start_date > end_date:
        raise HTTPException(400, "start_date cannot be after end_date")

    equipment_query = select(Equipment).order_by(Equipment.asset_code)
    if equipment_id is not None:
        equipment_query = equipment_query.where(Equipment.id == equipment_id)
    equipment = list(db.scalars(equipment_query).all())
    if equipment_id is not None and not equipment:
        raise HTTPException(404, "Equipment not found")
    ids = {item.id for item in equipment}

    plans = list(db.scalars(select(MaintenancePlan).where(MaintenancePlan.active.is_(True))).all())
    overdue_ids: set[int] = set()
    today = date.today()
    equipment_map = {item.id: item for item in equipment}
    for plan in plans:
        if plan.equipment_id not in ids:
            continue
        date_overdue = plan.next_due_date is not None and plan.next_due_date < today
        eq = equipment_map[plan.equipment_id]
        meter_overdue = plan.next_due_meter is not None and eq.hour_meter is not None and eq.hour_meter > plan.next_due_meter
        if date_overdue or meter_overdue:
            overdue_ids.add(plan.equipment_id)

    wo_query = select(WorkOrder).where(WorkOrder.status != "cancelled")
    if equipment_id is not None:
        wo_query = wo_query.where(WorkOrder.equipment_id == equipment_id)
    if start_date is not None:
        wo_query = wo_query.where(WorkOrder.created_at >= _period_start(start_date))
    if end_date is not None:
        wo_query = wo_query.where(WorkOrder.created_at < _period_end(end_date))
    orders = list(db.scalars(wo_query).all())

    fuel_query = select(FuelRecord)
    if equipment_id is not None:
        fuel_query = fuel_query.where(FuelRecord.equipment_id == equipment_id)
    if start_date is not None:
        fuel_query = fuel_query.where(FuelRecord.recorded_at >= _period_start(start_date))
    if end_date is not None:
        fuel_query = fuel_query.where(FuelRecord.recorded_at < _period_end(end_date))
    fuels = list(db.scalars(fuel_query).all())

    downtime_query = select(DowntimeEvent).order_by(DowntimeEvent.started_at)
    if equipment_id is not None:
        downtime_query = downtime_query.where(DowntimeEvent.equipment_id == equipment_id)
    if start_date is not None:
        downtime_query = downtime_query.where(DowntimeEvent.started_at < _period_end(end_date or date.today()))
    if end_date is not None:
        downtime_query = downtime_query.where(DowntimeEvent.started_at < _period_end(end_date))
    downtime_rows = list(db.scalars(downtime_query).all())

    parts_by_wo: dict[int, Decimal] = {}
    labor_by_wo: dict[int, Decimal] = {}
    if orders:
        order_ids = [order.id for order in orders]
        part_rows = db.execute(
            select(WorkOrderPart.work_order_id, func.coalesce(func.sum(WorkOrderPart.quantity * WorkOrderPart.unit_cost), 0))
            .where(WorkOrderPart.work_order_id.in_(order_ids))
            .group_by(WorkOrderPart.work_order_id)
        ).all()
        parts_by_wo = {row[0]: Decimal(row[1] or 0) for row in part_rows}
        labor_rows = db.execute(
            select(WorkOrderLabor.work_order_id, func.coalesce(func.sum(WorkOrderLabor.hours * WorkOrderLabor.hourly_rate), 0))
            .where(WorkOrderLabor.work_order_id.in_(order_ids))
            .group_by(WorkOrderLabor.work_order_id)
        ).all()
        labor_by_wo = {row[0]: Decimal(row[1] or 0) for row in labor_rows}

    fuel_by: dict[int, Decimal] = {}
    for row in fuels:
        fuel_by[row.equipment_id] = fuel_by.get(row.equipment_id, Decimal("0")) + Decimal(row.quantity or 0) * Decimal(row.unit_cost or 0)

    cost_by: dict[int, dict[str, Decimal]] = {}
    open_wo_by: dict[int, int] = {}
    pm_total = pm_completed = 0
    for order in orders:
        parts = parts_by_wo.get(order.id, Decimal("0"))
        labor = labor_by_wo.get(order.id, Decimal("0"))
        residual = max(Decimal(order.actual_cost or 0) - parts - labor, Decimal("0"))
        bucket = cost_by.setdefault(order.equipment_id, {"maintenance": Decimal("0"), "parts": Decimal("0"), "labor": Decimal("0")})
        bucket["maintenance"] += residual
        bucket["parts"] += parts
        bucket["labor"] += labor
        if order.status in OPEN_WO_STATUSES:
            open_wo_by[order.equipment_id] = open_wo_by.get(order.equipment_id, 0) + 1
        if order.maintenance_type == "preventive":
            pm_total += 1
            if order.status in ("completed", "verified", "closed"):
                pm_completed += 1

    downtime_by: dict[int, dict[str, Decimal | int]] = {}
    breakdown_events = 0
    breakdown_hours = Decimal("0")
    total_downtime = Decimal("0")
    now = datetime.now(timezone.utc)
    for event in downtime_rows:
        end = event.ended_at or now
        duration = _hours(event.started_at, end)
        bucket = downtime_by.setdefault(event.equipment_id, {"events": 0, "breakdown_events": 0, "hours": Decimal("0"), "breakdown_hours": Decimal("0")})
        bucket["events"] = int(bucket["events"]) + 1
        bucket["hours"] = Decimal(bucket["hours"]) + duration
        total_downtime += duration
        if event.category == "breakdown":
            bucket["breakdown_events"] = int(bucket["breakdown_events"]) + 1
            bucket["breakdown_hours"] = Decimal(bucket["breakdown_hours"]) + duration
            breakdown_events += 1
            breakdown_hours += duration

    performance_values: list[tuple[Decimal, Decimal]] = []
    equipment_rows: list[FleetEquipmentAnalyticsRead] = []
    total_hours = Decimal("0")
    total_fuel = sum(fuel_by.values(), Decimal("0"))
    total_maintenance = sum((v["maintenance"] for v in cost_by.values()), Decimal("0"))
    total_parts = sum((v["parts"] for v in cost_by.values()), Decimal("0"))
    total_labor = sum((v["labor"] for v in cost_by.values()), Decimal("0"))

    for eq in equipment:
        dt = downtime_by.get(eq.id, {"breakdown_events": 0, "breakdown_hours": Decimal("0"), "hours": Decimal("0")})
        failures = int(dt["breakdown_events"])
        bd_hours = Decimal(dt["breakdown_hours"])
        observation = Decimal("0")
        if failures:
            first_event = next((x for x in downtime_rows if x.equipment_id == eq.id and x.category == "breakdown"), None)
            if first_event is not None:
                observation = _hours(first_event.started_at, now)
        mttr = bd_hours / failures if failures else None
        operating = max(observation - bd_hours, Decimal("0")) if failures else Decimal("0")
        mtbf = operating / failures if failures and operating > 0 else None
        if mttr is not None and mtbf is not None:
            performance_values.append((mttr, mtbf))

        meters = select(MeterReading).where(MeterReading.equipment_id == eq.id, MeterReading.reading_type == "hour_meter").order_by(MeterReading.recorded_at)
        if start_date is not None:
            baseline = db.scalar(select(MeterReading).where(MeterReading.equipment_id == eq.id, MeterReading.reading_type == "hour_meter", MeterReading.recorded_at < _period_start(start_date)).order_by(MeterReading.recorded_at.desc()).limit(1))
            meters = meters.where(MeterReading.recorded_at >= _period_start(start_date))
        else:
            baseline = None
        if end_date is not None:
            meters = meters.where(MeterReading.recorded_at < _period_end(end_date))
        meter_rows = list(db.scalars(meters).all())
        hours_used = None
        if meter_rows:
            first = Decimal(meter_rows[0].reading_value)
            last = Decimal(meter_rows[-1].reading_value)
            if baseline is not None:
                first = Decimal(baseline.reading_value)
            if last >= first:
                hours_used = last - first
                total_hours += hours_used

        cost_bucket = cost_by.get(eq.id, {"maintenance": Decimal("0"), "parts": Decimal("0"), "labor": Decimal("0")})
        total_cost = fuel_by.get(eq.id, Decimal("0")) + sum(cost_bucket.values(), Decimal("0"))
        reasons: list[str] = []
        if eq.status in ("down", "out_of_service"):
            reasons.append(eq.status.replace("_", " "))
        if eq.id in overdue_ids:
            reasons.append("overdue PM")
        if failures >= 2:
            reasons.append(f"{failures} breakdowns")
        if Decimal(dt["hours"]) >= 8:
            reasons.append(f"{Decimal(dt['hours']):.1f} h downtime")
        if mttr is not None and mttr >= 8:
            reasons.append(f"MTTR {mttr:.1f} h")
        equipment_rows.append(FleetEquipmentAnalyticsRead(
            equipment_id=eq.id,
            asset_code=eq.asset_code,
            equipment_name=eq.name,
            status=eq.status,
            breakdown_events=failures,
            breakdown_hours=bd_hours.quantize(Decimal("0.01")),
            downtime_hours=Decimal(dt["hours"]).quantize(Decimal("0.01")),
            mttr_hours=mttr.quantize(Decimal("0.01")) if mttr is not None else None,
            mtbf_hours=mtbf.quantize(Decimal("0.01")) if mtbf is not None else None,
            overdue_pm=eq.id in overdue_ids,
            open_work_orders=open_wo_by.get(eq.id, 0),
            total_operating_cost=total_cost.quantize(Decimal("0.01")),
            cost_per_hour=(total_cost / hours_used).quantize(Decimal("0.01")) if hours_used and hours_used > 0 else None,
            attention_reasons=reasons,
        ))

    operational = sum(1 for eq in equipment if eq.status == "operational")
    maintenance_assets = sum(1 for eq in equipment if eq.status == "maintenance")
    down_assets = sum(1 for eq in equipment if eq.status == "down")
    out_assets = sum(1 for eq in equipment if eq.status == "out_of_service")
    availability = (Decimal(operational) / Decimal(len(equipment)) * 100).quantize(Decimal("0.01")) if equipment else None
    avg_mttr = sum((x[0] for x in performance_values), Decimal("0")) / len(performance_values) if performance_values else None
    avg_mtbf = sum((x[1] for x in performance_values), Decimal("0")) / len(performance_values) if performance_values else None

    trend_start = start_date or (date.today().replace(day=1) - timedelta(days=180))
    trend_end = end_date or date.today()
    trend_fuels = list(db.scalars(select(FuelRecord).where(FuelRecord.recorded_at >= _period_start(trend_start), FuelRecord.recorded_at < _period_end(trend_end), *([FuelRecord.equipment_id == equipment_id] if equipment_id else []))).all())
    trend_orders = list(db.scalars(select(WorkOrder).where(WorkOrder.status != "cancelled", WorkOrder.created_at >= _period_start(trend_start), WorkOrder.created_at < _period_end(trend_end), *([WorkOrder.equipment_id == equipment_id] if equipment_id else []))).all())
    trend: dict[str, dict[str, Decimal]] = {}
    cursor = trend_start.replace(day=1)
    while cursor <= trend_end:
        trend[cursor.strftime("%Y-%m")] = {"fuel": Decimal("0"), "maintenance": Decimal("0"), "parts": Decimal("0"), "labor": Decimal("0")}
        cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)
    for row in trend_fuels:
        key = row.recorded_at.date().strftime("%Y-%m")
        if key in trend:
            trend[key]["fuel"] += Decimal(row.quantity or 0) * Decimal(row.unit_cost or 0)
    trend_order_ids = [x.id for x in trend_orders]
    trend_parts = {}
    trend_labor = {}
    if trend_order_ids:
        trend_parts = {r[0]: Decimal(r[1] or 0) for r in db.execute(select(WorkOrderPart.work_order_id, func.coalesce(func.sum(WorkOrderPart.quantity * WorkOrderPart.unit_cost), 0)).where(WorkOrderPart.work_order_id.in_(trend_order_ids)).group_by(WorkOrderPart.work_order_id)).all()}
        trend_labor = {r[0]: Decimal(r[1] or 0) for r in db.execute(select(WorkOrderLabor.work_order_id, func.coalesce(func.sum(WorkOrderLabor.hours * WorkOrderLabor.hourly_rate), 0)).where(WorkOrderLabor.work_order_id.in_(trend_order_ids)).group_by(WorkOrderLabor.work_order_id)).all()}
    for order in trend_orders:
        key = order.created_at.date().strftime("%Y-%m")
        if key in trend:
            parts = trend_parts.get(order.id, Decimal("0")); labor = trend_labor.get(order.id, Decimal("0"))
            trend[key]["parts"] += parts; trend[key]["labor"] += labor
            trend[key]["maintenance"] += max(Decimal(order.actual_cost or 0) - parts - labor, Decimal("0"))
    monthly = [FleetCostTrendRead(period=k, fuel_cost=v["fuel"].quantize(Decimal("0.01")), maintenance_cost=v["maintenance"].quantize(Decimal("0.01")), parts_cost=v["parts"].quantize(Decimal("0.01")), labor_cost=v["labor"].quantize(Decimal("0.01")), total_operating_cost=sum(v.values(), Decimal("0")).quantize(Decimal("0.01"))) for k, v in trend.items()]

    return FleetAnalyticsRead(
        fleet_size=len(equipment), operational_assets=operational, maintenance_assets=maintenance_assets,
        down_assets=down_assets, out_of_service_assets=out_assets, availability_percent=availability,
        open_work_orders=sum(open_wo_by.values()), overdue_pm=len(overdue_ids), pm_work_orders=pm_total,
        completed_pm_work_orders=pm_completed, pm_completion_percent=(Decimal(pm_completed) / Decimal(pm_total) * 100).quantize(Decimal("0.01")) if pm_total else None,
        breakdown_events=breakdown_events, breakdown_downtime_hours=breakdown_hours.quantize(Decimal("0.01")),
        total_downtime_hours=total_downtime.quantize(Decimal("0.01")), average_mttr_hours=avg_mttr.quantize(Decimal("0.01")) if avg_mttr else None,
        average_mtbf_hours=avg_mtbf.quantize(Decimal("0.01")) if avg_mtbf else None, fuel_cost=total_fuel.quantize(Decimal("0.01")),
        maintenance_cost=total_maintenance.quantize(Decimal("0.01")), parts_cost=total_parts.quantize(Decimal("0.01")), labor_cost=total_labor.quantize(Decimal("0.01")),
        total_operating_cost=(total_fuel + total_maintenance + total_parts + total_labor).quantize(Decimal("0.01")), total_operating_hours=total_hours.quantize(Decimal("0.01")),
        operating_cost_per_hour=((total_fuel + total_maintenance + total_parts + total_labor) / total_hours).quantize(Decimal("0.01")) if total_hours > 0 else None,
        equipment=sorted(equipment_rows, key=lambda x: (len(x.attention_reasons), x.total_operating_cost), reverse=True), monthly_trend=monthly,
    )
