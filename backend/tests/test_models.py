from sqlalchemy.orm import configure_mappers

from app.core.database import Base
from app.models import (
    Equipment,
    Inventory,
    MaintenancePlan,
    Part,
    PartTransaction,
    Supplier,
    WorkOrder,
    WorkOrderLabor,
    WorkOrderPart,
    WorkOrderTask,
)


def test_model_mappers_configure():
    configure_mappers()
    expected = {
        "equipment",
        "equipment_categories",
        "locations",
        "operators",
        "meter_readings",
        "maintenance_plans",
        "work_orders",
        "work_order_tasks",
        "work_order_parts",
        "work_order_labor",
        "suppliers",
        "parts",
        "inventory",
        "part_transactions",
    }
    assert expected.issubset(set(Base.metadata.tables))
