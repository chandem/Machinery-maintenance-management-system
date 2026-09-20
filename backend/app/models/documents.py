from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class EquipmentDocument(Base):
    """Metadata for manuals, certificates, photos (URL-based; no binary storage yet)."""

    __tablename__ = "equipment_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    document_type: Mapped[str] = mapped_column(String(50), default="other", index=True)
    # manual | certificate | photo | invoice | other
    url: Mapped[str] = mapped_column(String(500))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    equipment: Mapped["Equipment"] = relationship()
