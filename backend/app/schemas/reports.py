from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class CostByEquipment(BaseModel):
    equipment_id: int
    asset_code: str
    name: str
    work_order_cost: Decimal
    fuel_cost: Decimal
    total_cost: Decimal
    work_order_count: int


class CostReport(BaseModel):
    total_work_order_cost: Decimal
    total_fuel_cost: Decimal
    total_cost: Decimal
    by_equipment: list[CostByEquipment]


class AvailabilityItem(BaseModel):
    equipment_id: int
    asset_code: str
    name: str
    status: str
    downtime_hours_open: Optional[Decimal]
    downtime_events_total: int
    open_work_orders: int


class AvailabilityReport(BaseModel):
    total_equipment: int
    operational: int
    availability_pct: Decimal
    items: list[AvailabilityItem]
