"""
Items API routes.

Demonstrates CRUD operations with SQLModel and proper typing.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import select

from app.api.deps import SessionDep
from app.models import Item, ItemCreate, ItemRead, ItemUpdate

router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=list[ItemRead])
async def list_items(
    session: SessionDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
) -> list[Item]:
    """List all items with pagination."""
    statement = select(Item).offset(skip).limit(limit)
    result = await session.execute(statement)
    return result.scalars().all()


@router.post("", response_model=ItemRead, status_code=201)
async def create_item(session: SessionDep, item_in: ItemCreate) -> Item:
    """Create a new item."""
    item = Item.model_validate(item_in)
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


@router.get("/{item_id}", response_model=ItemRead)
async def get_item(session: SessionDep, item_id: UUID) -> Item:
    """Get a specific item by ID."""
    item = await session.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.patch("/{item_id}", response_model=ItemRead)
async def update_item(
    session: SessionDep, item_id: UUID, item_in: ItemUpdate
) -> Item:
    """Update an item."""
    item = await session.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = item_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)

    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
async def delete_item(session: SessionDep, item_id: UUID) -> None:
    """Delete an item."""
    item = await session.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    await session.delete(item)
    await session.commit()
