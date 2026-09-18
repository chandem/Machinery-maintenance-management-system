from sqlalchemy.orm import configure_mappers

from app.core.database import Base
from app.models import (  # noqa: F401 — register all models on Base.metadata
    Equipment,
    Inventory,
    MaintenancePlan,
    Part,
    PartTransaction,
    Supplier,
    User,
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
        "users",
    }
    assert expected.issubset(set(Base.metadata.tables))
