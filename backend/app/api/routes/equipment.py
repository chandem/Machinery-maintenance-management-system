from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_write_user
from app.core.config import settings
from app.core.database import get_db
from app.core.pagination import Page, PageParams, paginate
from app.models.equipment import (
    Equipment,
    EquipmentCategory,
    Location,
    MeterReading,
    Operator,
)
from app.models.user import User
from app.schemas.equipment import (
    EquipmentCategoryCreate,
    EquipmentCategoryRead,
    EquipmentCreate,
    EquipmentRead,
    EquipmentUpdate,
    LocationCreate,
    LocationRead,
    MeterReadingCreate,
    MeterReadingRead,
    OperatorCreate,
    OperatorRead,
    OperatorUpdate,
)

router = APIRouter(prefix="/equipment", tags=["Equipment"])


@router.post("/categories", response_model=EquipmentCategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: EquipmentCategoryCreate,
    db: Session = Depends(get_db),
    _: User | None = Depends(require_write_user),
):
    if db.scalar(select(EquipmentCategory).where(EquipmentCategory.name == payload.name)):
        raise HTTPException(status_code=409, detail="Category name already exists")
    item = EquipmentCategory(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/categories", response_model=list[EquipmentCategoryRead])
def list_categories(db: Session = Depends(get_db)):
    return list(db.scalars(select(EquipmentCategory).order_by(EquipmentCategory.name)).all())


@router.get("/categories/{category_id}", response_model=EquipmentCategoryRead)
def get_category(category_id: int, db: Session = Depends(get_db)):
    item = db.get(EquipmentCategory, category_id)
    if not item:
        raise HTTPException(status_code=404, detail="Category not found")
    return item


@router.post("/locations", response_model=LocationRead, status_code=status.HTTP_201_CREATED)
def create_location(
    payload: LocationCreate,
    db: Session = Depends(get_db),
    _: User | None = Depends(require_write_user),
):
    if db.scalar(select(Location).where(Location.name == payload.name)):
        raise HTTPException(status_code=409, detail="Location name already exists")
    item = Location(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/locations", response_model=list[LocationRead])
def list_locations(db: Session = Depends(get_db)):
    return list(db.scalars(select(Location).order_by(Location.name)).all())


@router.get("/locations/{location_id}", response_model=LocationRead)
def get_location(location_id: int, db: Session = Depends(get_db)):
    item = db.get(Location, location_id)
    if not item:
        raise HTTPException(status_code=404, detail="Location not found")
    return item


@router.post("/operators", response_model=OperatorRead, status_code=status.HTTP_201_CREATED)
def create_operator(
    payload: OperatorCreate,
    db: Session = Depends(get_db),
    _: User | None = Depends(require_write_user),
):
    if db.scalar(select(Operator).where(Operator.employee_code == payload.employee_code)):
        raise HTTPException(status_code=409, detail="Employee code already exists")
    item = Operator(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/operators", response_model=list[OperatorRead])
def list_operators(active_only: bool = False, db: Session = Depends(get_db)):
    query = select(Operator).order_by(Operator.full_name)
    if active_only:
        query = query.where(Operator.active.is_(True))
    return list(db.scalars(query).all())


@router.get("/operators/{operator_id}", response_model=OperatorRead)
def get_operator(operator_id: int, db: Session = Depends(get_db)):
    item = db.get(Operator, operator_id)
    if not item:
        raise HTTPException(status_code=404, detail="Operator not found")
    return item


@router.patch("/operators/{operator_id}", response_model=OperatorRead)
def update_operator(
    operator_id: int,
    payload: OperatorUpdate,
    db: Session = Depends(get_db),
    _: User | None = Depends(require_write_user),
):
    item = db.get(Operator, operator_id)
    if not item:
        raise HTTPException(status_code=404, detail="Operator not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.post("/meter-readings", response_model=MeterReadingRead, status_code=status.HTTP_201_CREATED)
def create_meter_reading(
    payload: MeterReadingCreate,
    db: Session = Depends(get_db),
    _: User | None = Depends(require_write_user),
):
    equipment = db.get(Equipment, payload.equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    reading = MeterReading(**payload.model_dump())
    db.add(reading)

    if payload.reading_type == "hour_meter":
        if equipment.hour_meter is None or payload.reading_value > equipment.hour_meter:
            equipment.hour_meter = payload.reading_value
    elif payload.reading_type == "odometer":
        if equipment.odometer is None or payload.reading_value > equipment.odometer:
            equipment.odometer = payload.reading_value

    db.commit()
    db.refresh(reading)
    return reading


@router.get("/meter-readings", response_model=Page[MeterReadingRead])
def list_meter_readings(
    equipment_id: int | None = None,
    reading_type: str | None = None,
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    query = select(MeterReading).order_by(MeterReading.recorded_at.desc())
    if equipment_id is not None:
        query = query.where(MeterReading.equipment_id == equipment_id)
    if reading_type is not None:
        query = query.where(MeterReading.reading_type == reading_type)
    return paginate(db, query, params, MeterReadingRead)


@router.post("", response_model=EquipmentRead, status_code=status.HTTP_201_CREATED)
def create_equipment(
    payload: EquipmentCreate,
    db: Session = Depends(get_db),
    _: User | None = Depends(require_write_user),
):
    existing = db.scalar(select(Equipment).where(Equipment.asset_code == payload.asset_code))
    if existing:
        raise HTTPException(status_code=409, detail="Asset code already exists")
    if payload.category_id and not db.get(EquipmentCategory, payload.category_id):
        raise HTTPException(status_code=404, detail="Category not found")
    if payload.location_id and not db.get(Location, payload.location_id):
        raise HTTPException(status_code=404, detail="Location not found")
    if payload.operator_id and not db.get(Operator, payload.operator_id):
        raise HTTPException(status_code=404, detail="Operator not found")
    equipment = Equipment(**payload.model_dump())
    db.add(equipment)
    db.commit()
    db.refresh(equipment)
    return equipment


@router.get("", response_model=Page[EquipmentRead])
def list_equipment(
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = None,
    category_id: int | None = None,
    location_id: int | None = None,
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    query = select(Equipment).order_by(Equipment.id)
    if status_filter:
        query = query.where(Equipment.status == status_filter)
    if category_id is not None:
        query = query.where(Equipment.category_id == category_id)
    if location_id is not None:
        query = query.where(Equipment.location_id == location_id)
    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Equipment.asset_code.ilike(term),
                Equipment.name.ilike(term),
                Equipment.serial_number.ilike(term),
                Equipment.plate_number.ilike(term),
            )
        )
    return paginate(db, query, params, EquipmentRead)


@router.get("/{equipment_id}/qr")
def equipment_qr(equipment_id: int, db: Session = Depends(get_db)):
    """Return QR payload URL for asset identification (scan opens equipment page)."""
    equipment = db.get(Equipment, equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    target = f"{settings.public_app_url.rstrip('/')}/equipment/{equipment.id}"
    # Public QR image service — no extra Python dependency
    image_url = f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={quote(target, safe='')}"
    return {
        "equipment_id": equipment.id,
        "asset_code": equipment.asset_code,
        "payload": target,
        "qr_image_url": image_url,
    }


@router.get("/{equipment_id}", response_model=EquipmentRead)
def get_equipment(equipment_id: int, db: Session = Depends(get_db)):
    equipment = db.get(Equipment, equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return equipment


@router.patch("/{equipment_id}", response_model=EquipmentRead)
def update_equipment(
    equipment_id: int,
    payload: EquipmentUpdate,
    db: Session = Depends(get_db),
    _: User | None = Depends(require_write_user),
):
    equipment = db.get(Equipment, equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data and data["category_id"] is not None and not db.get(EquipmentCategory, data["category_id"]):
        raise HTTPException(status_code=404, detail="Category not found")
    if "location_id" in data and data["location_id"] is not None and not db.get(Location, data["location_id"]):
        raise HTTPException(status_code=404, detail="Location not found")
    if "operator_id" in data and data["operator_id"] is not None and not db.get(Operator, data["operator_id"]):
        raise HTTPException(status_code=404, detail="Operator not found")
    for key, value in data.items():
        setattr(equipment, key, value)
    db.commit()
    db.refresh(equipment)
    return equipment


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    _: User | None = Depends(require_write_user),
):
    equipment = db.get(Equipment, equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    db.delete(equipment)
    db.commit()
