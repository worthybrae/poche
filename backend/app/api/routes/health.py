from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "healthy", "service": "app-backend"}


@router.get("/")
async def root() -> dict:
    """Root endpoint."""
    return {"message": "Welcome to the App Template API"}
