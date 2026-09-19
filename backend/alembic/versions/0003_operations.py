"""inspections, fuel records, downtime events"""

from alembic import op
import sqlalchemy as sa

revision = "0003_operations"
down_revision = "0002_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "inspections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("equipment_id", sa.Integer(), sa.ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False),
        sa.Column("inspection_type", sa.String(50), nullable=False, server_default="routine"),
        sa.Column("status", sa.String(30), nullable=False, server_default="open"),
        sa.Column("inspected_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("inspector_name", sa.String(150)),
        sa.Column("findings", sa.Text()),
        sa.Column("severity", sa.String(20)),
        sa.Column("corrective_action", sa.Text()),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_inspections_equipment_id", "inspections", ["equipment_id"])
    op.create_index("ix_inspections_status", "inspections", ["status"])
    op.create_index("ix_inspections_inspected_at", "inspections", ["inspected_at"])

    op.create_table(
        "fuel_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("equipment_id", sa.Integer(), sa.ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 2), nullable=False),
        sa.Column("unit", sa.String(20), nullable=False, server_default="L"),
        sa.Column("unit_cost", sa.Numeric(14, 2)),
        sa.Column("odometer", sa.Numeric(12, 2)),
        sa.Column("hour_meter", sa.Numeric(12, 2)),
        sa.Column("notes", sa.Text()),
    )
    op.create_index("ix_fuel_records_equipment_id", "fuel_records", ["equipment_id"])
    op.create_index("ix_fuel_records_recorded_at", "fuel_records", ["recorded_at"])

    op.create_table(
        "downtime_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("equipment_id", sa.Integer(), sa.ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reason", sa.String(200), nullable=False),
        sa.Column("category", sa.String(50), nullable=False, server_default="breakdown"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_downtime_events_equipment_id", "downtime_events", ["equipment_id"])
    op.create_index("ix_downtime_events_started_at", "downtime_events", ["started_at"])
    op.create_index("ix_downtime_events_category", "downtime_events", ["category"])


def downgrade() -> None:
    op.drop_table("downtime_events")
    op.drop_table("fuel_records")
    op.drop_table("inspections")
