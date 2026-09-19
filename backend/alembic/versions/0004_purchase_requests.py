"""purchase requests"""

from alembic import op
import sqlalchemy as sa

revision = "0004_purchase_requests"
down_revision = "0003_operations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "purchase_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("part_id", sa.Integer(), sa.ForeignKey("parts.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 2), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("requested_by", sa.String(150)),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_purchase_requests_part_id", "purchase_requests", ["part_id"])
    op.create_index("ix_purchase_requests_status", "purchase_requests", ["status"])


def downgrade() -> None:
    op.drop_table("purchase_requests")
