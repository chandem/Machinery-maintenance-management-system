from app.schemas.maintenance import MaintenancePlanCreate, WorkOrderCreate


def test_maintenance_plan_defaults():
    plan = MaintenancePlanCreate(equipment_id=1, name="500 hour service")
    assert plan.maintenance_type == "preventive"
    assert plan.active is True


def test_work_order_defaults():
    order = WorkOrderCreate(
        work_order_number="WO-0001",
        equipment_id=1,
        title="Hydraulic inspection",
    )
    assert order.status == "draft"
    assert order.priority == "medium"
