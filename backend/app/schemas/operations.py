from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class InspectionCreate(BaseModel):
    equipment_id: int
    inspection_type: str = "routine"
    status: str = "open"
    inspector_name: Optional[str] = None
    findings: Optional[str] = None
    severity: Optional[str] = None
    corrective_action: Optional[str] = None
    notes: Optional[str] = None


class InspectionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Optional[str] = None
    findings: Optional[str] = None
    severity: Optional[str] = None
    corrective_action: Optional[str] = None
    notes: Optional[str] = None
    inspector_name: Optional[str] = None


class InspectionRead(InspectionCreate):
    id: int
    inspected_at: datetime
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class FuelRecordCreate(BaseModel):
    equipment_id: int
    quantity: Decimal = Field(gt=0)
    unit: str = "L"
    unit_cost: Optional[Decimal] = Field(default=None, ge=0)
    odometer: Optional[Decimal] = Field(default=None, ge=0)
    hour_meter: Optional[Decimal] = Field(default=None, ge=0)
    notes: Optional[str] = None


class FuelRecordRead(FuelRecordCreate):
    id: int
    recorded_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DowntimeCreate(BaseModel):
    equipment_id: int
    reason: str = Field(min_length=1, max_length=200)
    category: str = "breakdown"
    started_at: datetime
    ended_at: Optional[datetime] = None
    notes: Optional[str] = None


class DowntimeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ended_at: Optional[datetime] = None
    notes: Optional[str] = None
    reason: Optional[str] = None


class DowntimeRead(DowntimeCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DowntimeSummaryRead(BaseModel):
    equipment_id: int
    total_events: int
    open_events: int
    total_hours: Decimal
    breakdown_hours: Decimal
    maintenance_hours: Decimal
    other_hours: Decimal
