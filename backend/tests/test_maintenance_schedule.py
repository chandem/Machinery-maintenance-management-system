from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.routes.maintenance import complete_maintenance_service, maintenance_plan_status
from app.core.database import Base
from app.models import Equipment, MaintenancePlan
from app.schemas.maintenance import MaintenanceServiceComplete


@pytest.fixture
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    Base.metadata.drop_all(engine)


def seed(db: Session):
    equipment = Equipment(asset_code="EX-100", name="Excavator", hour_meter=Decimal("1000"))
    db.add(equipment); db.flush()
    plan = MaintenancePlan(equipment_id=equipment.id, name="Engine service", interval_days=30, interval_hours=Decimal("250"), next_due_date=date.today(), next_due_meter=Decimal("1000"), active=True)
    db.add(plan); db.commit(); db.refresh(plan)
    return plan


def test_complete_service_advances_date_and_meter(db: Session):
    plan = seed(db)
    result = complete_maintenance_service(plan.id, MaintenanceServiceComplete(service_date=date.today(), service_meter=Decimal("1000")), db)
    assert result.last_service_date == date.today()
    assert result.last_service_meter == Decimal("1000.00")
    assert result.next_due_date == date.today() + timedelta(days=30)
    assert result.next_due_meter == Decimal("1250.00")
    assert maintenance_plan_status(db)[0].status == "scheduled"


def test_complete_service_rejects_early_date(db: Session):
    plan = seed(db)
    with pytest.raises(Exception):
        complete_maintenance_service(plan.id, MaintenanceServiceComplete(service_date=date.today() - timedelta(days=1), service_meter=Decimal("1000")), db)
