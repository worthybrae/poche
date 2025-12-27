"""
Example Item model demonstrating the model pattern.

This file shows how to:
1. Define a database model with SQLModel
2. Create corresponding schemas for API operations
3. Use the base model for common fields

The model defined here will:
- Create a database table via Alembic migration
- Generate Pydantic schemas for request/response validation
- Appear in the OpenAPI schema for frontend codegen
"""

from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel, Field

from .base import BaseModel


# =============================================================================
# Database Model (table=True creates the actual database table)
# =============================================================================

class Item(BaseModel, table=True):
    """
    Item database model.

    Inherits from BaseModel which provides:
    - id: UUID (primary key)
    - created_at: datetime
    - updated_at: datetime
    """

    name: str = Field(index=True, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    price: float = Field(ge=0, description="Price must be non-negative")
    is_available: bool = Field(default=True)


# =============================================================================
# API Schemas (these control what's exposed via the API)
# =============================================================================

class ItemCreate(SQLModel):
    """Schema for creating a new item."""

    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    price: float = Field(ge=0)
    is_available: bool = Field(default=True)


class ItemUpdate(SQLModel):
    """Schema for updating an item (all fields optional)."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    price: float | None = Field(default=None, ge=0)
    is_available: bool | None = None


class ItemRead(SQLModel):
    """
    Schema for reading an item.

    This is what gets returned from the API and will be
    converted to TypeScript types via codegen.
    """

    id: UUID
    name: str
    description: str | None
    price: float
    is_available: bool
    created_at: datetime
    updated_at: datetime
