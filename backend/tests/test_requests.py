import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from auth import create_access_token
from models import Priority, RequestItem, RequestStatus, User, UserRole


def auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(user)
    return {"Authorization": f"Bearer {token}"}


async def make_user(db_session: AsyncSession, name: str, email: str, role: UserRole) -> User:
    user = User(
        name=name,
        email=email,
        password_hash="hash-apenas-para-teste",
        role=role
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def make_request(db_session: AsyncSession, creator: User, developer: User, qa: User,
                       status: RequestStatus = RequestStatus.OPEN) -> RequestItem:
    request = RequestItem(
        title="Solicitação de teste",
        description="Descrição usada pelo teste.",
        priority=Priority.MEDIUM,
        status=status,
        created_by_id=creator.id,
        developer_id=developer.id,
        qa_id=qa.id
    )
    db_session.add(request)
    await db_session.commit()
    await db_session.refresh(request)
    return request


@pytest.mark.asyncio
async def test_list_requests_only_shows_assigned_requests(client: AsyncClient, db_session: AsyncSession):
    po = await make_user(db_session, "PO", "po@hype.dev", UserRole.PO)
    dev_one = await make_user(db_session, "Dev One", "dev.one@hype.dev", UserRole.DEVELOPER)
    dev_two = await make_user(db_session, "Dev Two", "dev.two@hype.dev", UserRole.DEVELOPER)
    qa_one = await make_user(db_session, "QA One", "qa.one@hype.dev", UserRole.QA)
    qa_two = await make_user(db_session, "QA Two", "qa.two@hype.dev", UserRole.QA)

    request_one = await make_request(db_session, po, dev_one, qa_one)
    request_two = await make_request(db_session, po, dev_two, qa_two)

    po_response = await client.get(
        "/api/v1/requests",
        headers=auth_headers(po)
    )
    dev_response = await client.get(
        "/api/v1/requests",
        headers=auth_headers(dev_one)
    )
    qa_response = await client.get(
        "/api/v1/requests",
        headers=auth_headers(qa_two)
    )

    assert po_response.status_code == 200
    assert {item["id"] for item in po_response.json()} == {
        request_one.id,
        request_two.id
    }

    assert dev_response.status_code == 200
    assert {item["id"] for item in dev_response.json()} == {request_one.id}

    assert qa_response.status_code == 200
    assert {item["id"] for item in qa_response.json()} == {request_two.id}


@pytest.mark.asyncio
async def test_only_po_or_tech_lead_can_create_requests(client: AsyncClient, db_session: AsyncSession):
    po = await make_user(db_session, "PO", "po@hype.dev", UserRole.PO)
    developer = await make_user(db_session, "Dev", "dev@hype.dev", UserRole.DEVELOPER)
    qa = await make_user(db_session, "QA", "qa@hype.dev", UserRole.QA)

    payload = {
        "title": "Criar relatório",
        "description": "Adicionar um relatório ao painel.",
        "priority": "high",
        "developer_id": developer.id,
        "qa_id": qa.id
    }

    denied = await client.post(
        "/api/v1/requests",
        json=payload,
        headers=auth_headers(developer)
    )
    created = await client.post(
        "/api/v1/requests",
        json=payload,
        headers=auth_headers(po)
    )

    assert denied.status_code == 403
    assert created.status_code == 201
    assert created.json()["status"] == "open"


@pytest.mark.asyncio
async def test_developer_and_qa_can_follow_rejection_flow(client: AsyncClient, db_session: AsyncSession):
    po = await make_user(db_session, "PO", "po@hype.dev", UserRole.PO)
    developer = await make_user(db_session, "Dev", "dev@hype.dev", UserRole.DEVELOPER)
    qa = await make_user(db_session, "QA", "qa@hype.dev", UserRole.QA)
    request = await make_request(db_session, po, developer, qa)

    url = f"/api/v1/requests/{request.id}/status"

    started = await client.patch(
        url,
        json={"status": "in_progress"},
        headers=auth_headers(developer)
    )
    finished = await client.patch(
        url,
        json={"status": "done"},
        headers=auth_headers(developer)
    )
    testing = await client.patch(
        url,
        json={"status": "in_test"},
        headers=auth_headers(qa)
    )
    rejected = await client.patch(
        url,
        json={
            "status": "rejected",
            "comment": "O relatório mostra valores incorretos."
        },
        headers=auth_headers(qa)
    )
    reopened = await client.patch(
        url,
        json={"status": "in_progress"},
        headers=auth_headers(developer)
    )

    assert started.json()["status"] == "in_progress"
    assert finished.json()["status"] == "done"
    assert testing.json()["status"] == "in_test"
    assert rejected.json()["status"] == "rejected"
    assert reopened.json()["status"] == "in_progress"

    history = await client.get(f"/api/v1/requests/{request.id}/history", headers=auth_headers(developer))

    assert history.status_code == 200
    assert any(
        entry["new_value"] == "rejected"
        and entry["comment"] == "O relatório mostra valores incorretos."
        and entry["actor_name"] == "QA"
        for entry in history.json()
    )


@pytest.mark.asyncio
async def test_qa_must_comment_when_approving(client: AsyncClient, db_session: AsyncSession):
    po = await make_user(db_session, "PO", "po@hype.dev", UserRole.PO)
    developer = await make_user(db_session, "Dev", "dev@hype.dev", UserRole.DEVELOPER)
    qa = await make_user(db_session, "QA", "qa@hype.dev", UserRole.QA)
    request = await make_request(
        db_session,
        po,
        developer,
        qa,
        status=RequestStatus.IN_TEST
    )

    response = await client.patch(
        f"/api/v1/requests/{request.id}/status",
        json={"status": "completed"},
        headers=auth_headers(qa)
    )

    assert response.status_code == 422
    assert "comentário" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_qa_can_approve_with_comment(client: AsyncClient, db_session: AsyncSession):
    po = await make_user(db_session, "PO", "po@hype.dev", UserRole.PO)
    developer = await make_user(db_session, "Dev", "dev@hype.dev", UserRole.DEVELOPER)
    qa = await make_user(db_session, "QA", "qa@hype.dev", UserRole.QA)

    request = await make_request(
        db_session,
        po,
        developer,
        qa,
        status=RequestStatus.IN_TEST
    )

    response = await client.patch(
        f"/api/v1/requests/{request.id}/status",
        json={
            "status": "completed",
            "comment": "Testes aprovados."
        },
        headers=auth_headers(qa)
    )

    assert response.status_code == 200
    assert response.json()["status"] == "completed"

    history = await client.get(f"/api/v1/requests/{request.id}/history", headers=auth_headers(qa))

    assert history.status_code == 200
    assert any(
        entry["old_value"] == "in_test"
        and entry["new_value"] == "completed"
        and entry["comment"] == "Testes aprovados."
        and entry["actor_name"] == "QA"
        for entry in history.json()
    )