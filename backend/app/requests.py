from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import Priority, RequestItem, RequestStatus, RequestHistory, User, UserRole
from schemas import RequestPublic, RequestCreate, RequestStatusUpdate, RequestHistoryPublic


router = APIRouter(prefix="/requests", tags=["requests"])


@router.get("", response_model=list[RequestPublic])
async def list_requests(
    status: RequestStatus | None = None,
    developer_id: int | None = Query(default=None, gt=0),
    priority: Priority | None = None,
    created_from: date | None = None,
    created_to: date | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)) -> list[RequestItem]:
    query = select(RequestItem)

    # PO e Tech Lead podem consultar todas
    # Desenvolvedor e QA ficam limitados as solicitações atribuídas a eles.
    if current_user.role in {UserRole.PO, UserRole.TECH_LEAD}:
        pass
    elif current_user.role == UserRole.DEVELOPER:
        query = query.where(RequestItem.developer_id == current_user.id)
    elif current_user.role == UserRole.QA:
        query = query.where(RequestItem.qa_id == current_user.id)
    else:
        raise HTTPException(status_code=403, detail="Papel sem acesso as solicitações.")

    if status is not None:
        query = query.where(RequestItem.status == status)

    if developer_id is not None:
        query = query.where(RequestItem.developer_id == developer_id)

    if priority is not None:
        query = query.where(RequestItem.priority == priority)

    if created_from is not None:
        start = datetime.combine(created_from, time.min, tzinfo=timezone.utc)
        query = query.where(RequestItem.created_at >= start)

    if created_to is not None:
        end = datetime.combine(
            created_to + timedelta(days=1),
            time.min,
            tzinfo=timezone.utc
        )
        query = query.where(RequestItem.created_at < end)

    if created_from is not None and created_to is not None and created_from > created_to:
        raise HTTPException(
            status_code=422,
            detail="created_from não pode ser posterior a created_to."
        )

    query = (
        query.order_by(RequestItem.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(query)
    return list(result.scalars().all())

@router.post("", response_model=RequestPublic, status_code=http_status.HTTP_201_CREATED)
async def create_request(data: RequestCreate, db: AsyncSession = Depends(get_db),
                         current_user: User = Depends(get_current_user)) -> RequestItem:
    if current_user.role not in {UserRole.PO, UserRole.TECH_LEAD}:
        raise HTTPException(
            status_code=403,
            detail="Somente PO ou Tech Lead podem criar solicitações."
        )

    result = await db.execute(
        select(User).where(
            User.id.in_([data.developer_id, data.qa_id])
        )
    )
    assigned_users = {
        user.id: user
        for user in result.scalars().all()
    }

    developer = assigned_users.get(data.developer_id)
    qa = assigned_users.get(data.qa_id)

    if developer is None or qa is None:
        raise HTTPException(
            status_code=404,
            detail="Desenvolvedor ou QA não encontrado."
        )

    if developer.role != UserRole.DEVELOPER:
        raise HTTPException(
            status_code=422,
            detail="O usuário atribuído como desenvolvedor não tem o papel Developer."
        )

    if qa.role != UserRole.QA:
        raise HTTPException(
            status_code=422,
            detail="O usuário atribuído como QA não tem o papel QA."
        )

    request = RequestItem(
        title=data.title,
        description=data.description,
        priority=data.priority,
        status=RequestStatus.OPEN,
        created_by_id=current_user.id,
        developer_id=developer.id,
        qa_id=qa.id
    )

    db.add(request)
    await db.flush()

    db.add_all([
        RequestHistory(
            request_id=request.id,
            actor_id=current_user.id,
            action="created",
            field_name="status",
            new_value=RequestStatus.OPEN.value
        ),
        RequestHistory(
            request_id=request.id,
            actor_id=current_user.id,
            action="assigned",
            field_name="developer_id",
            new_value=str(developer.id)
        ),
        RequestHistory(
            request_id=request.id,
            actor_id=current_user.id,
            action="assigned",
            field_name="qa_id",
            new_value=str(qa.id)
        ),
    ])

    await db.commit()
    await db.refresh(request)

    return request

@router.patch("/{request_id}/status", response_model=RequestPublic)
async def update_request_status(request_id: int, data: RequestStatusUpdate, db: AsyncSession = Depends(get_db),
                                current_user: User = Depends(get_current_user)) -> RequestItem:
    result = await db.execute(select(RequestItem).where(RequestItem.id == request_id))
    request = result.scalar_one_or_none()

    if request is None:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada.")

    old_status = request.status
    new_status = data.status

    if current_user.role in {UserRole.PO, UserRole.TECH_LEAD}:
        # PO e Tech Lead podem alterar qualquer solicitação para qualquer status.
        pass

    elif current_user.role == UserRole.DEVELOPER:
        if request.developer_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Você só pode atualizar solicitações atribuídas a você."
            )

        allowed_transitions = {
            RequestStatus.OPEN: {RequestStatus.IN_PROGRESS},
            RequestStatus.IN_PROGRESS: {RequestStatus.DONE},
            RequestStatus.REJECTED: {RequestStatus.IN_PROGRESS}
        }

        if new_status not in allowed_transitions.get(old_status, set()):
            raise HTTPException(
                status_code=409,
                detail="Transição de status não permitida para desenvolvedor."
            )

    elif current_user.role == UserRole.QA:
        if request.qa_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Você só pode atualizar solicitações atribuídas a você."
            )

        allowed_transitions = {
            RequestStatus.DONE: {RequestStatus.IN_TEST},
            RequestStatus.IN_TEST: {
                RequestStatus.COMPLETED,
                RequestStatus.REJECTED
            }
        }

        if new_status not in allowed_transitions.get(old_status, set()):
            raise HTTPException(
                status_code=409,
                detail="Transição de status não permitida para QA."
            )

        if new_status in {RequestStatus.COMPLETED, RequestStatus.REJECTED}:
            if not data.comment or not data.comment.strip():
                raise HTTPException(
                    status_code=422,
                    detail="O QA deve informar um comentário ao aprovar ou rejeitar."
                )

    else:
        raise HTTPException(
            status_code=403,
            detail="Seu papel não pode atualizar solicitações."
        )

    if new_status == old_status:
        raise HTTPException(
            status_code=409,
            detail="A solicitação já está nesse status."
        )

    request.status = new_status

    db.add(
        RequestHistory(
            request_id=request.id,
            actor_id=current_user.id,
            action="status_changed",
            field_name="status",
            old_value=old_status.value,
            new_value=new_status.value,
            comment=data.comment
        )
    )

    await db.commit()
    await db.refresh(request)

    return request

@router.get("/{request_id}/history", response_model=list[RequestHistoryPublic])
async def get_request_history(request_id: int, db: AsyncSession = Depends(get_db),
                              current_user: User = Depends(get_current_user)) -> list[RequestHistoryPublic]:
    result = await db.execute(select(RequestItem).where(RequestItem.id == request_id))
    request = result.scalar_one_or_none()

    if request is None:
        raise HTTPException(
            status_code=404,
            detail="Solicitação não encontrada."
        )

    if current_user.role in {UserRole.PO, UserRole.TECH_LEAD}:
        pass
    elif current_user.role == UserRole.DEVELOPER:
        if request.developer_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Você não tem acesso a esta solicitação."
            )
    elif current_user.role == UserRole.QA:
        if request.qa_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Você não tem acesso a esta solicitação.",
            )
    else:
        raise HTTPException(
            status_code=403,
            detail="Seu papel não pode consultar solicitações."
        )

    history_result = await db.execute(
        select(RequestHistory, User.name)
        .join(User, User.id == RequestHistory.actor_id)
        .where(RequestHistory.request_id == request_id)
        .order_by(RequestHistory.created_at, RequestHistory.id)
    )

    return [
        RequestHistoryPublic(
            id=entry.id,
            actor_id=entry.actor_id,
            actor_name=actor_name,
            action=entry.action,
            field_name=entry.field_name,
            old_value=entry.old_value,
            new_value=entry.new_value,
            comment=entry.comment,
            created_at=entry.created_at
        )
        for entry, actor_name in history_result.all()
    ]