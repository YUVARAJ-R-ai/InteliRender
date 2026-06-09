from fastapi import APIRouter
from schemas.common import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", version="0.1.0")
