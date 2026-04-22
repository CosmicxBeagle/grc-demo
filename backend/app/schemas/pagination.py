"""
Shared pagination schema used by all list endpoints.
"""
from typing import Generic, TypeVar, List
from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    model_config = {"from_attributes": True}


def make_page(items: list, total: int, page: int, page_size: int) -> dict:
    """Helper to build the pagination dict from a query result."""
    import math
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if page_size else 1,
    }
