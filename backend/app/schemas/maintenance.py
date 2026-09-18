from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class MaintenancePlanCreate(BaseModel):
    equipment_id: int
    name: str = Field(min_length=1, max_length=150)
    maintenance_type: str = "preventive"
    interval_hours: Optional[Decimal] = None
    interval_days: Optional[int] = Field(default=None, ge=1)
    last_service_date: Optional[date] = None
    last_service_meter: Optional[Decimal] = Field(default=None, ge=0)
    next_due_date: Optional[date] = None
    next_due_meter: Optional[Decimal] = Field(default=None, ge=0)
    active: bool = True
    notes: Optional[str] = None


class MaintenancePlanRead(MaintenancePlanCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class WorkOrderCreate(BaseModel):
    work_order_number: str = Field(min_length=1, max_length=50)
    equipment_id: int
    maintenance_plan_id: Optional[int] = None
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    maintenance_type: str = "corrective"
    priority: str = "medium"
    status: str = "draft"
    scheduled_date: Optional[date] = None
    estimated_cost: Optional[Decimal] = Field(default=None, ge=0)
    notes: Optional[str] = None


class WorkOrderUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    description: Optional[str] = None
    scheduled_date: Optional[date] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    estimated_cost: Optional[Decimal] = Field(default=None, ge=0)
    actual_cost: Optional[Decimal] = Field(default=None, ge=0)
    notes: Optional[str] = None


class WorkOrderRead(WorkOrderCreate):
    id: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    verified_at: Optional[datetime]
    closed_at: Optional[datetime]
    actual_cost: Optional[Decimal]
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class WorkOrderCostRead(BaseModel):
    work_order_id: int
    estimated_cost: Optional[Decimal]
    parts_cost: Decimal
    labor_cost: Decimal
    total_cost: Decimal
    recorded_actual_cost: Optional[Decimal]


class WorkOrderPartCreate(BaseModel):
    part_id: int
    quantity: Decimal = Field(gt=0)
    unit_cost: Optional[Decimal] = Field(default=None, ge=0)


class WorkOrderPartRead(WorkOrderPartCreate):
    id: int
    work_order_id: int
    model_config = ConfigDict(from_attributes=True)


class WorkOrderPartReturn(BaseModel):
    quantity: Decimal = Field(gt=0)
    notes: Optional[str] = None


class WorkOrderLaborCreate(BaseModel):
    worker_name: str = Field(min_length=1, max_length=150)
    role: Optional[str] = None
    hours: Decimal = Field(gt=0)
    hourly_rate: Decimal = Field(ge=0)
    notes: Optional[str] = None


class WorkOrderLaborRead(WorkOrderLaborCreate):
    id: int
    work_order_id: int
    model_config = ConfigDict(from_attributes=True)
