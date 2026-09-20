from sqlalchemy.orm import configure_mappers

from app.core.database import Base
from app.models import (  # noqa: F401
    DowntimeEvent,
    Equipment,
    EquipmentDocument,
    FuelRecord,
    Inspection,
    Inventory,
    MaintenancePlan,
    Part,
    PartTransaction,
    PurchaseRequest,
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
        "inspections",
        "fuel_records",
        "downtime_events",
        "purchase_requests",
        "equipment_documents",
    }
    assert expected.issubset(set(Base.metadata.tables))
