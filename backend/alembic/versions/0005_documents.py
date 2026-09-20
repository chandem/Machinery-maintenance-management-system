"""equipment documents"""

from alembic import op
import sqlalchemy as sa

revision = "0005_documents"
down_revision = "0004_purchase_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "equipment_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("equipment_id", sa.Integer(), sa.ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("document_type", sa.String(50), nullable=False, server_default="other"),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_equipment_documents_equipment_id", "equipment_documents", ["equipment_id"])
    op.create_index("ix_equipment_documents_document_type", "equipment_documents", ["document_type"])


def downgrade() -> None:
    op.drop_table("equipment_documents")
