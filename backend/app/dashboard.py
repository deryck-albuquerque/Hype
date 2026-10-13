from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import RequestItem, RequestStatus, User, UserRole


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class DashboardSummary(BaseModel):
    role: UserRole
    total: int
    status_counts: dict[str, int]


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(db: AsyncSession = Depends(get_db),
                                current_user: User = Depends(get_current_user)) -> DashboardSummary:
    if current_user.role in {UserRole.PO, UserRole.TECH_LEAD}:
        user_scope = RequestItem.created_by_id == current_user.id
    elif current_user.role == UserRole.DEVELOPER:
        user_scope = RequestItem.developer_id == current_user.id
    else:
        user_scope = RequestItem.qa_id == current_user.id

    query = (
        select(RequestItem.status, func.count(RequestItem.id))
        .where(user_scope)
        .group_by(RequestItem.status)
    )

    result = await db.execute(query)

    status_counts = {
        status.value: 0
        for status in RequestStatus
    }

    for request_status, count in result.all():
        status_counts[request_status.value] = count

    return DashboardSummary(
        role=current_user.role,
        total=sum(status_counts.values()),
        status_counts=status_counts
    )