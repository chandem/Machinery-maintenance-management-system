from math import ceil
from typing import Generic, Sequence, TypeVar

from fastapi import Query
from pydantic import BaseModel, Field
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

T = TypeVar("T")


class PageParams:
    """FastAPI dependency for page/page_size query params."""

    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number (1-based)"),
        page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    ):
        self.page = page
        self.page_size = page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int = Field(description="Total number of pages")


def paginate(db: Session, query: Select, params: PageParams, schema: type[T]) -> Page[T]:
    """Execute a SQLAlchemy select with count + limit/offset and wrap in Page."""
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.offset(params.offset).limit(params.page_size)).all()
    pages = ceil(total / params.page_size) if params.page_size and total else 0
    items = [schema.model_validate(row) for row in rows]
    return Page(
        items=items,
        total=total,
        page=params.page,
        page_size=params.page_size,
        pages=pages,
    )
