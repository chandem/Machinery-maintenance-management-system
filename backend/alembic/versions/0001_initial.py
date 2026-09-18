"""initial equipment and maintenance schema"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "equipment_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text()),
    )
    op.create_index("ix_equipment_categories_name", "equipment_categories", ["name"], unique=True)

    op.create_table(
        "locations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("description", sa.Text()),
    )
    op.create_index("ix_locations_name", "locations", ["name"], unique=True)

    op.create_table(
        "operators",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_code", sa.String(50), nullable=False),
        sa.Column("full_name", sa.String(150), nullable=False),
        sa.Column("phone", sa.String(50)),
        sa.Column("license_number", sa.String(100)),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_operators_employee_code", "operators", ["employee_code"], unique=True)
    op.create_index("ix_operators_full_name", "operators", ["full_name"])

    op.create_table(
        "equipment",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("asset_code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("manufacturer", sa.String(100)),
        sa.Column("model", sa.String(100)),
        sa.Column("serial_number", sa.String(100)),
        sa.Column("plate_number", sa.String(50)),
        sa.Column("purchase_date", sa.Date()),
        sa.Column("purchase_cost", sa.Numeric(14, 2)),
        sa.Column("status", sa.String(30), nullable=False, server_default="operational"),
        sa.Column("hour_meter", sa.Numeric(12, 2)),
        sa.Column("odometer", sa.Numeric(12, 2)),
        sa.Column("warranty_expiry", sa.Date()),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("equipment_categories.id")),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id")),
        sa.Column("operator_id", sa.Integer(), sa.ForeignKey("operators.id")),
    )
    op.create_index("ix_equipment_asset_code", "equipment", ["asset_code"], unique=True)
    op.create_index("ix_equipment_name", "equipment", ["name"])
    op.create_unique_constraint("uq_equipment_serial_number", "equipment", ["serial_number"])
    op.create_unique_constraint("uq_equipment_plate_number", "equipment", ["plate_number"])

    op.create_table(
        "meter_readings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("equipment_id", sa.Integer(), sa.ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reading_type", sa.String(30), nullable=False),
        sa.Column("reading_value", sa.Numeric(12, 2), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("source", sa.String(50)),
        sa.Column("notes", sa.Text()),
    )
    op.create_index("ix_meter_readings_equipment_id", "meter_readings", ["equipment_id"])
    op.create_index("ix_meter_readings_recorded_at", "meter_readings", ["recorded_at"])

    op.create_table(
        "maintenance_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("equipment_id", sa.Integer(), sa.ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("maintenance_type", sa.String(30), nullable=False, server_default="preventive"),
        sa.Column("interval_hours", sa.Numeric(12, 2)),
        sa.Column("interval_days", sa.Integer()),
        sa.Column("last_service_date", sa.Date()),
        sa.Column("last_service_meter", sa.Numeric(12, 2)),
        sa.Column("next_due_date", sa.Date()),
        sa.Column("next_due_meter", sa.Numeric(12, 2)),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_maintenance_plans_equipment_id", "maintenance_plans", ["equipment_id"])
    op.create_index("ix_maintenance_plans_maintenance_type", "maintenance_plans", ["maintenance_type"])
    op.create_index("ix_maintenance_plans_next_due_date", "maintenance_plans", ["next_due_date"])
    op.create_index("ix_maintenance_plans_next_due_meter", "maintenance_plans", ["next_due_meter"])

    op.create_table(
        "work_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("work_order_number", sa.String(50), nullable=False),
        sa.Column("equipment_id", sa.Integer(), sa.ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False),
        sa.Column("maintenance_plan_id", sa.Integer(), sa.ForeignKey("maintenance_plans.id", ondelete="SET NULL")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("maintenance_type", sa.String(30), nullable=False, server_default="corrective"),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("scheduled_date", sa.Date()),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
        sa.Column("estimated_cost", sa.Numeric(14, 2)),
        sa.Column("actual_cost", sa.Numeric(14, 2)),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_work_orders_work_order_number", "work_orders", ["work_order_number"], unique=True)
    op.create_index("ix_work_orders_equipment_id", "work_orders", ["equipment_id"])
    op.create_index("ix_work_orders_maintenance_plan_id", "work_orders", ["maintenance_plan_id"])
    op.create_index("ix_work_orders_maintenance_type", "work_orders", ["maintenance_type"])
    op.create_index("ix_work_orders_priority", "work_orders", ["priority"])
    op.create_index("ix_work_orders_status", "work_orders", ["status"])
    op.create_index("ix_work_orders_scheduled_date", "work_orders", ["scheduled_date"])

    op.create_table(
        "work_order_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("work_order_id", sa.Integer(), sa.ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("description", sa.String(300), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("estimated_hours", sa.Numeric(8, 2)),
        sa.Column("actual_hours", sa.Numeric(8, 2)),
        sa.Column("notes", sa.Text()),
    )
    op.create_index("ix_work_order_tasks_work_order_id", "work_order_tasks", ["work_order_id"])


def downgrade() -> None:
    op.drop_table("work_order_tasks")
    op.drop_table("work_orders")
    op.drop_table("maintenance_plans")
    op.drop_table("meter_readings")
    op.drop_table("equipment")
    op.drop_table("operators")
    op.drop_table("locations")
    op.drop_table("equipment_categories")
