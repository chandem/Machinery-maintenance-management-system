from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class EquipmentCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None


class EquipmentCategoryRead(EquipmentCategoryCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class LocationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: Optional[str] = None


class LocationRead(LocationCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class OperatorCreate(BaseModel):
    employee_code: str = Field(min_length=1, max_length=50)
    full_name: str = Field(min_length=1, max_length=150)
    phone: Optional[str] = None
    license_number: Optional[str] = None
    active: bool = True


class OperatorUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: Optional[str] = None
    phone: Optional[str] = None
    license_number: Optional[str] = None
    active: Optional[bool] = None


class OperatorRead(OperatorCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class MeterReadingCreate(BaseModel):
    equipment_id: int
    reading_type: str = Field(min_length=1, max_length=30)  # hour_meter | odometer | other
    reading_value: Decimal = Field(ge=0)
    source: Optional[str] = Field(default=None, max_length=50)
    notes: Optional[str] = None


class MeterReadingRead(MeterReadingCreate):
    id: int
    recorded_at: datetime
    model_config = ConfigDict(from_attributes=True)


class EquipmentBase(BaseModel):
    asset_code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=150)
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    plate_number: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_cost: Optional[Decimal] = None
    status: str = "operational"
    hour_meter: Optional[Decimal] = None
    odometer: Optional[Decimal] = None
    warranty_expiry: Optional[date] = None
    notes: Optional[str] = None
    category_id: Optional[int] = None
    location_id: Optional[int] = None
    operator_id: Optional[int] = None


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    plate_number: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_cost: Optional[Decimal] = None
    status: Optional[str] = None
    hour_meter: Optional[Decimal] = None
    odometer: Optional[Decimal] = None
    warranty_expiry: Optional[date] = None
    notes: Optional[str] = None
    category_id: Optional[int] = None
    location_id: Optional[int] = None
    operator_id: Optional[int] = None


class EquipmentRead(EquipmentBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
