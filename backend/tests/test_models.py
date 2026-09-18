from sqlalchemy.orm import configure_mappers

from app.core.database import Base
from app.models import Equipment, MaintenancePlan, WorkOrder, WorkOrderTask, Supplier, Part, Inventory, PartTransaction, WorkOrderPart, WorkOrderLabor


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
        "suppliers",
        "parts",
        "inventory",
        "part_transactions",
          "work_order_labor",
    }
    assert expected.issubset(set(Base.metadata.tables))
