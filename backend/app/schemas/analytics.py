from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class FleetEquipmentAnalyticsRead(BaseModel):
    equipment_id: int
    asset_code: str
    equipment_name: str
    status: str
    breakdown_events: int
    breakdown_hours: Decimal
    downtime_hours: Decimal
    mttr_hours: Optional[Decimal]
    mtbf_hours: Optional[Decimal]
    overdue_pm: bool
    open_work_orders: int
    total_operating_cost: Decimal
    cost_per_hour: Optional[Decimal]
    attention_reasons: list[str]


class FleetCostTrendRead(BaseModel):
    period: str
    fuel_cost: Decimal
    maintenance_cost: Decimal
    parts_cost: Decimal
    labor_cost: Decimal
    total_operating_cost: Decimal


class FleetAnalyticsRead(BaseModel):
    fleet_size: int
    operational_assets: int
    maintenance_assets: int
    down_assets: int
    out_of_service_assets: int
    availability_percent: Optional[Decimal]
    open_work_orders: int
    overdue_pm: int
    pm_work_orders: int
    completed_pm_work_orders: int
    pm_completion_percent: Optional[Decimal]
    breakdown_events: int
    breakdown_downtime_hours: Decimal
    total_downtime_hours: Decimal
    average_mttr_hours: Optional[Decimal]
    average_mtbf_hours: Optional[Decimal]
    fuel_cost: Decimal
    maintenance_cost: Decimal
    parts_cost: Decimal
    labor_cost: Decimal
    total_operating_cost: Decimal
    total_operating_hours: Decimal
    operating_cost_per_hour: Optional[Decimal]
    equipment: list[FleetEquipmentAnalyticsRead]
    monthly_trend: list[FleetCostTrendRead]
