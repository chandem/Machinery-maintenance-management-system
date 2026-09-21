from datetime import datetime, timezone, date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_write_user
from app.core.database import get_db
from app.core.pagination import Page, PageParams, paginate
from app.models.equipment import Equipment, MeterReading
from app.models.operations import DowntimeEvent, FuelRecord, Inspection
from app.models.maintenance import WorkOrder, WorkOrderLabor, WorkOrderPart
from app.models.user import User
from app.schemas.operations import (
    DowntimeCreate,
    DowntimeRead,
    DowntimeUpdate,
    FuelRecordCreate,
    FuelRecordRead,
    InspectionCreate,
    InspectionRead,
    InspectionUpdate,
    DowntimeSummaryRead,
    MaintenancePerformanceRead,
    FuelSummaryRead,
    FuelEquipmentSummaryRead,
    FuelOperatingCostSummaryRead,
    FuelOperatingCostEquipmentRead,
)

router = APIRouter(tags=["Operations"])


@router.post("/inspections", response_model=InspectionRead, status_code=status.HTTP_201_CREATED)
def create_inspection(
    payload: InspectionCreate,
    db: Session = Depends(get_db),
    _: User | None = Depends(require_write_user),
):
    if db.get(Equipment, payload.equipment_id) is None:
        raise HTTPException(404, "Equipment not found")
    item = Inspection(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/inspections", response_model=Page[InspectionRead])
def list_inspections(
    equipment_id: int | None = None,
    status_filter: str | None = None,
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    query = select(Inspection).order_by(Inspection.inspected_at.desc())
    if equipment_id is not None:
        query = query.where(Inspection.equipment_id == equipment_id)
    if status_filter:
        query = query.where(Inspection.status == status_filter)
    return paginate(db, query, params, InspectionRead)


@router.get("/inspections/{inspection_id}", response_model=InspectionRead)
def get_inspection(inspection_id: int, db: Session = Depends(get_db)):
    item = db.get(Inspection, inspection_id)
    if item is None:
        raise HTTPException(404, "Inspection not found")
    return item


@router.patch("/inspections/{inspection_id}", response_model=InspectionRead)
def update_inspection(
    inspection_id: int,
    payload: InspectionUpdate,
    db: Session = Depends(get_db),
    _: User | None = Depends(require_write_user),
):
    item = db.get(Inspection, inspection_id)
    if item is None:
        raise HTTPException(404, "Inspection not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.post("/fuel", response_model=FuelRecordRead, status_code=status.HTTP_201_CREATED)
def create_fuel_record(
    payload: FuelRecordCreate,
    db: Session = Depends(get_db),
    _: User | None = Depends(require_write_user),
):
    equipment = db.get(Equipment, payload.equipment_id)
    if equipment is None:
        raise HTTPException(404, "Equipment not found")
    item = FuelRecord(**payload.model_dump())
    db.add(item)
    if payload.hour_meter is not None and (
        equipment.hour_meter is None or payload.hour_meter > equipment.hour_meter
    ):
        equipment.hour_meter = payload.hour_meter
    if payload.odometer is not None and (
        equipment.odometer is None or payload.odometer > equipment.odometer
    ):
        equipment.odometer = payload.odometer
    db.commit()
    db.refresh(item)
    return item


@router.get("/fuel", response_model=Page[FuelRecordRead])
def list_fuel_records(
    equipment_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    query = select(FuelRecord).order_by(FuelRecord.recorded_at.desc())
    if equipment_id is not None:
        query = query.where(FuelRecord.equipment_id == equipment_id)
    if start_date is not None:
        query = query.where(FuelRecord.recorded_at >= datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc))
    if end_date is not None:
        query = query.where(FuelRecord.recorded_at < datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc))
    return paginate(db, query, params, FuelRecordRead)



@router.get("/fuel/operating-costs", response_model=FuelOperatingCostSummaryRead)
def fuel_operating_costs(
    equipment_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
):
    fuel_query = select(FuelRecord).order_by(FuelRecord.equipment_id, FuelRecord.recorded_at)
    if equipment_id is not None:
        fuel_query = fuel_query.where(FuelRecord.equipment_id == equipment_id)
    if start_date is not None:
        fuel_query = fuel_query.where(FuelRecord.recorded_at >= datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc))
    if end_date is not None:
        fuel_query = fuel_query.where(FuelRecord.recorded_at < datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc))
    fuels = list(db.scalars(fuel_query).all())

    wo_query = select(WorkOrder).where(WorkOrder.status != "cancelled")
    if equipment_id is not None:
        wo_query = wo_query.where(WorkOrder.equipment_id == equipment_id)
    if start_date is not None:
        wo_query = wo_query.where(
            WorkOrder.created_at
            >= datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
        )
    if end_date is not None:
        wo_query = wo_query.where(
            WorkOrder.created_at
            < datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        )
    orders = list(db.scalars(wo_query).all())

    equipment_ids = {x.equipment_id for x in fuels} | {x.equipment_id for x in orders}
    equipment_map = {x.id: x for x in db.scalars(select(Equipment).where(Equipment.id.in_(equipment_ids))).all()} if equipment_ids else {}
    fuel_by: dict[int, Decimal] = {}
    parts_by: dict[int, Decimal] = {}
    labor_by: dict[int, Decimal] = {}
    maintenance_by: dict[int, Decimal] = {}

    for row in fuels:
        fuel_by[row.equipment_id] = fuel_by.get(row.equipment_id, Decimal("0")) + Decimal(row.quantity or 0) * Decimal(row.unit_cost or 0)

    for order in orders:
        parts = db.scalars(select(WorkOrderPart).where(WorkOrderPart.work_order_id == order.id)).all()
        parts_cost = sum((Decimal(p.quantity) * Decimal(p.unit_cost or 0) for p in parts), Decimal("0"))
        labor_cost = db.scalar(
            select(func.coalesce(func.sum(WorkOrderLabor.hours * WorkOrderLabor.hourly_rate), 0))
            .where(WorkOrderLabor.work_order_id == order.id)
        ) or Decimal("0")
        parts_by[order.equipment_id] = parts_by.get(order.equipment_id, Decimal("0")) + parts_cost
        labor_by[order.equipment_id] = labor_by.get(order.equipment_id, Decimal("0")) + Decimal(labor_cost)
        # actual_cost is incremented when parts/labor are posted to a work order,
        # so only the residual represents other maintenance cost. This prevents
        # double-counting parts and labor in total operating cost.
        recorded_cost = Decimal(order.actual_cost or 0)
        residual_maintenance = max(recorded_cost - parts_cost - Decimal(labor_cost), Decimal("0"))
        maintenance_by[order.equipment_id] = (
            maintenance_by.get(order.equipment_id, Decimal("0")) + residual_maintenance
        )

    rows = []
    for eid in equipment_ids:
        eq = equipment_map[eid]
        fuel = fuel_by.get(eid, Decimal("0"))
        parts = parts_by.get(eid, Decimal("0"))
        labor = labor_by.get(eid, Decimal("0"))
        maintenance = maintenance_by.get(eid, Decimal("0"))
        total = fuel + maintenance + parts + labor
        # Use meter readings within the selected period, with the latest reading
        # before the period as a baseline when available. This avoids treating the
        # lifetime equipment hour meter as "hours used" for the selected period.
        meter_query = (
            select(MeterReading)
            .where(
                MeterReading.equipment_id == eid,
                MeterReading.reading_type == "hour_meter",
            )
            .order_by(MeterReading.recorded_at)
        )
        if start_date is not None:
            period_start = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
            baseline_query = (
                select(MeterReading)
                .where(
                    MeterReading.equipment_id == eid,
                    MeterReading.reading_type == "hour_meter",
                    MeterReading.recorded_at < period_start,
                )
                .order_by(MeterReading.recorded_at.desc())
                .limit(1)
            )
            baseline = db.scalar(baseline_query)
            meter_query = meter_query.where(MeterReading.recorded_at >= period_start)
        else:
            baseline = None
        if end_date is not None:
            period_end = datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
            meter_query = meter_query.where(MeterReading.recorded_at < period_end)

        meter_rows = list(db.scalars(meter_query).all())
        hours = None
        if meter_rows:
            first_value = Decimal(meter_rows[0].reading_value)
            last_value = Decimal(meter_rows[-1].reading_value)
            if baseline is not None:
                first_value = Decimal(baseline.reading_value)
            if last_value >= first_value:
                hours = last_value - first_value

        rows.append(FuelOperatingCostEquipmentRead(
            equipment_id=eid, asset_code=eq.asset_code, equipment_name=eq.name,
            fuel_cost=fuel.quantize(Decimal("0.01")),
            maintenance_cost=maintenance.quantize(Decimal("0.01")),
            parts_cost=parts.quantize(Decimal("0.01")),
            labor_cost=labor.quantize(Decimal("0.01")),
            total_operating_cost=total.quantize(Decimal("0.01")),
            hours_used=hours.quantize(Decimal("0.01")) if hours is not None and hours > 0 else None,
            cost_per_hour=(total / hours).quantize(Decimal("0.01")) if hours is not None and hours > 0 else None,
        ))
    rows.sort(key=lambda x: x.total_operating_cost, reverse=True)
    return FuelOperatingCostSummaryRead(
        total_fuel_cost=sum((x.fuel_cost for x in rows), Decimal("0")),
        total_maintenance_cost=sum((x.maintenance_cost for x in rows), Decimal("0")),
        total_parts_cost=sum((x.parts_cost for x in rows), Decimal("0")),
        total_labor_cost=sum((x.labor_cost for x in rows), Decimal("0")),
        total_operating_cost=sum((x.total_operating_cost for x in rows), Decimal("0")),
        by_equipment=rows,
    )


@router.get("/fuel/summary", response_model=FuelSummaryRead)
def fuel_summary(
    equipment_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
):
    query = select(FuelRecord).order_by(FuelRecord.equipment_id, FuelRecord.recorded_at)
    if equipment_id is not None:
        query = query.where(FuelRecord.equipment_id == equipment_id)
    if start_date is not None:
        query = query.where(FuelRecord.recorded_at >= datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc))
    if end_date is not None:
        query = query.where(FuelRecord.recorded_at < datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc))

    rows = list(db.scalars(query).all())
    equipment_ids = {row.equipment_id for row in rows}
    equipment_map = {
        item.id: item
        for item in db.scalars(select(Equipment).where(Equipment.id.in_(equipment_ids))).all()
    } if equipment_ids else {}

    totals_by_equipment: dict[int, dict] = {}
    previous: dict[int, FuelRecord] = {}
    total_quantity = Decimal("0")
    total_cost = Decimal("0")
    priced_quantity = Decimal("0")

    for row in rows:
        quantity = Decimal(row.quantity or 0)
        cost = quantity * Decimal(row.unit_cost or 0)
        total_quantity += quantity
        total_cost += cost
        if row.unit_cost is not None:
            priced_quantity += quantity

        item = totals_by_equipment.setdefault(row.equipment_id, {
            "quantity": Decimal("0"),
            "fuel_cost": Decimal("0"),
            "priced_quantity": Decimal("0"),
            "hours_used": Decimal("0"),
            "km_used": Decimal("0"),
            "has_hours": False,
            "has_km": False,
        })
        item["quantity"] += quantity
        item["fuel_cost"] += cost
        if row.unit_cost is not None:
            item["priced_quantity"] += quantity

        prev = previous.get(row.equipment_id)
        if prev is not None:
            if row.hour_meter is not None and prev.hour_meter is not None and row.hour_meter >= prev.hour_meter:
                item["hours_used"] += Decimal(row.hour_meter) - Decimal(prev.hour_meter)
                item["has_hours"] = True
            if row.odometer is not None and prev.odometer is not None and row.odometer >= prev.odometer:
                item["km_used"] += Decimal(row.odometer) - Decimal(prev.odometer)
                item["has_km"] = True
        previous[row.equipment_id] = row

    summaries = []
    for eid, item in totals_by_equipment.items():
        eq = equipment_map.get(eid)
        if eq is None:
            continue
        quantity = item["quantity"]
        summaries.append(FuelEquipmentSummaryRead(
            equipment_id=eid,
            asset_code=eq.asset_code,
            equipment_name=eq.name,
            quantity=quantity.quantize(Decimal("0.01")),
            fuel_cost=item["fuel_cost"].quantize(Decimal("0.01")),
            average_unit_cost=(item["fuel_cost"] / item["priced_quantity"]).quantize(Decimal("0.01")) if item["priced_quantity"] > 0 else None,
            hours_used=item["hours_used"].quantize(Decimal("0.01")) if item["has_hours"] else None,
            km_used=item["km_used"].quantize(Decimal("0.01")) if item["has_km"] else None,
            liters_per_hour=(quantity / item["hours_used"]).quantize(Decimal("0.01")) if item["has_hours"] and item["hours_used"] > 0 else None,
            liters_per_km=(quantity / item["km_used"]).quantize(Decimal("0.0001")) if item["has_km"] and item["km_used"] > 0 else None,
        ))
    summaries.sort(key=lambda x: x.fuel_cost, reverse=True)

    return FuelSummaryRead(
        total_records=len(rows),
        total_quantity=total_quantity.quantize(Decimal("0.01")),
        total_fuel_cost=total_cost.quantize(Decimal("0.01")),
        average_unit_cost=(total_cost / priced_quantity).quantize(Decimal("0.01")) if priced_quantity > 0 else None,
        by_equipment=summaries,
    )


@router.post("/downtime", response_model=DowntimeRead, status_code=status.HTTP_201_CREATED)
def create_downtime(
    payload: DowntimeCreate,
    db: Session = Depends(get_db),
    _: User | None = Depends(require_write_user),
):
    if db.get(Equipment, payload.equipment_id) is None:
        raise HTTPException(404, "Equipment not found")
    if payload.ended_at is not None and payload.ended_at < payload.started_at:
        raise HTTPException(400, "ended_at cannot be before started_at")
    item = DowntimeEvent(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/downtime", response_model=Page[DowntimeRead])
def list_downtime(
    equipment_id: int | None = None,
    open_only: bool = False,
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    query = select(DowntimeEvent).order_by(DowntimeEvent.started_at.desc())
    if equipment_id is not None:
        query = query.where(DowntimeEvent.equipment_id == equipment_id)
    if open_only:
        query = query.where(DowntimeEvent.ended_at.is_(None))
    return paginate(db, query, params, DowntimeRead)


@router.patch("/downtime/{event_id}", response_model=DowntimeRead)
def update_downtime(
    event_id: int,
    payload: DowntimeUpdate,
    db: Session = Depends(get_db),
    _: User | None = Depends(require_write_user),
):
    item = db.get(DowntimeEvent, event_id)
    if item is None:
        raise HTTPException(404, "Downtime event not found")
    data = payload.model_dump(exclude_unset=True)
    if "ended_at" in data and data["ended_at"] is not None and data["ended_at"] < item.started_at:
        raise HTTPException(400, "ended_at cannot be before started_at")
    for key, value in data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.get("/downtime/summary", response_model=DowntimeSummaryRead)
def downtime_summary(equipment_id: int, db: Session = Depends(get_db)):
    rows = db.scalars(
        select(DowntimeEvent)
        .where(DowntimeEvent.equipment_id == equipment_id)
        .order_by(DowntimeEvent.started_at)
    ).all()
    now = datetime.now(timezone.utc)
    total = Decimal("0")
    breakdown = Decimal("0")
    maintenance = Decimal("0")
    for event in rows:
        start = event.started_at
        end = event.ended_at or now
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        hours = Decimal(str(max((end - start).total_seconds(), 0) / 3600))
        total += hours
        if event.category == "breakdown":
            breakdown += hours
        elif event.category == "maintenance":
            maintenance += hours
    return DowntimeSummaryRead(
        equipment_id=equipment_id,
        total_events=len(rows),
        open_events=sum(1 for event in rows if event.ended_at is None),
        total_hours=total.quantize(Decimal("0.01")),
        breakdown_hours=breakdown.quantize(Decimal("0.01")),
        maintenance_hours=maintenance.quantize(Decimal("0.01")),
        other_hours=(total - breakdown - maintenance).quantize(Decimal("0.01")),
    )


@router.get("/maintenance/performance", response_model=MaintenancePerformanceRead)
def maintenance_performance(equipment_id: int, db: Session = Depends(get_db)):
    equipment = db.get(Equipment, equipment_id)
    if equipment is None:
        raise HTTPException(404, "Equipment not found")
    rows = db.scalars(
        select(DowntimeEvent)
        .where(DowntimeEvent.equipment_id == equipment_id, DowntimeEvent.category == "breakdown")
        .order_by(DowntimeEvent.started_at)
    ).all()
    if not rows:
        return MaintenancePerformanceRead(
            equipment_id=equipment_id,
            breakdown_events=0,
            breakdown_hours=Decimal("0.00"),
            mttr_hours=None,
            observation_hours=Decimal("0.00"),
            operating_hours=Decimal("0.00"),
            mtbf_hours=None,
        )
    now = datetime.now(timezone.utc)
    first = rows[0].started_at
    if first.tzinfo is None:
        first = first.replace(tzinfo=timezone.utc)
    observation = Decimal(str(max((now - first).total_seconds(), 0) / 3600))
    breakdown_hours = Decimal("0")
    for event in rows:
        start = event.started_at
        end = event.ended_at or now
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        breakdown_hours += Decimal(str(max((end - start).total_seconds(), 0) / 3600))
    operating = max(observation - breakdown_hours, Decimal("0"))
    failures = len(rows)
    mttr = breakdown_hours / failures
    mtbf = operating / failures if operating > 0 else None
    return MaintenancePerformanceRead(
        equipment_id=equipment_id,
        breakdown_events=failures,
        breakdown_hours=breakdown_hours.quantize(Decimal("0.01")),
        mttr_hours=mttr.quantize(Decimal("0.01")),
        observation_hours=observation.quantize(Decimal("0.01")),
        operating_hours=operating.quantize(Decimal("0.01")),
        mtbf_hours=mtbf.quantize(Decimal("0.01")) if mtbf is not None else None,
    )
