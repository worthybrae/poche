"""
Database models - Single Source of Truth for data structures.

All models defined here will:
1. Create database tables via Alembic migrations
2. Generate Pydantic schemas for API validation
3. Appear in OpenAPI schema for frontend codegen

Usage:
    from app.models import User, Item, ItemCreate, ItemRead
"""

from .base import BaseModel, BaseModelCreate, BaseModelRead, BaseModelUpdate
from .item import Item, ItemCreate, ItemRead, ItemUpdate

__all__ = [
    # Base models
    "BaseModel",
    "BaseModelCreate",
    "BaseModelRead",
    "BaseModelUpdate",
    # Item models
    "Item",
    "ItemCreate",
    "ItemRead",
    "ItemUpdate",
]
