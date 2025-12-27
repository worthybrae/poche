"""Base model with common fields for all database models."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import SQLModel, Field


class BaseModel(SQLModel):
    """
    Base model that provides common fields for all database models.

    Inherit from this class AND set table=True to create a database table:

        class User(BaseModel, table=True):
            email: str = Field(unique=True, index=True)
            name: str

    This gives you:
    - id: UUID primary key (auto-generated)
    - created_at: Timestamp when record was created
    - updated_at: Timestamp when record was last updated
    """

    id: UUID = Field(
        default_factory=uuid4,
        primary_key=True,
        index=True,
        nullable=False,
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        sa_column_kwargs={"onupdate": datetime.utcnow},
    )


class BaseModelRead(SQLModel):
    """Base schema for reading models (includes id and timestamps)."""

    id: UUID
    created_at: datetime
    updated_at: datetime


class BaseModelCreate(SQLModel):
    """Base schema for creating models (no id or timestamps)."""

    pass


class BaseModelUpdate(SQLModel):
    """Base schema for updating models (all fields optional)."""

    pass
