"""Chat API routes for AI assistant integration."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.services.chat import ChatService

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    """Request model for chat messages."""
    message: str
    conversation_history: list[dict[str, str]] | None = None


class ChatResponse(BaseModel):
    """Response model for chat messages."""
    response: str
    tool_calls: list[dict] = []


@router.post("", response_model=ChatResponse)
async def chat(request: ChatMessage) -> ChatResponse:
    """
    Send a message to the AI assistant.

    The assistant can use MCP tools to query the database and API.
    """
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=500,
            detail="OpenAI API key not configured",
        )

    service = ChatService()
    result = await service.chat(
        message=request.message,
        conversation_history=request.conversation_history,
    )

    return ChatResponse(
        response=result["response"] or "",
        tool_calls=result.get("tool_calls", []),
    )


@router.get("/status")
async def chat_status() -> dict:
    """Check if chat service is configured and available."""
    return {
        "configured": bool(settings.openai_api_key),
        "model": "gpt-5-mini",
    }
