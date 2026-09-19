from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_equipment: int
    operational_equipment: int
    down_equipment: int
    open_work_orders: int
    overdue_maintenance_plans: int
    low_stock_parts: int
    out_of_stock_parts: int
    total_parts_inventory_value: Optional[Decimal] = None
    open_inspections: int = 0
    open_downtime_events: int = 0
