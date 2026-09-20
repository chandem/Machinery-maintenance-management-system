from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_write_user
from app.core.database import get_db
from app.core.pagination import Page, PageParams, paginate
from app.models.equipment import Equipment
from app.models.operations import DowntimeEvent, FuelRecord, Inspection
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
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    query = select(FuelRecord).order_by(FuelRecord.recorded_at.desc())
    if equipment_id is not None:
        query = query.where(FuelRecord.equipment_id == equipment_id)
    return paginate(db, query, params, FuelRecordRead)


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
