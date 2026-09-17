"""Core test suite — auth flow, RBAC, company CRUD, tool CRUD, upload."""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.main import app
from app.database import Base, get_db
from app.config import get_settings

TEST_DB_URL = "sqlite+aiosqlite:///./test.db"


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session):
    async def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    r = await client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_root(client: AsyncClient):
    r = await client.get("/")
    assert r.status_code == 200
    assert "app" in r.json()


@pytest.mark.asyncio
async def test_login_invalid(client: AsyncClient):
    r = await client.post("/api/v1/auth/login", json={"email": "bad@test.com", "password": "wrong"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    settings = get_settings()
    r = await client.post("/api/v1/auth/login", json={
        "email": settings.INITIAL_ADMIN_EMAIL,
        "password": settings.INITIAL_ADMIN_PASSWORD,
    })
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["user"]["role"] == "tb_admin"


async def get_admin_token(client: AsyncClient) -> str:
    settings = get_settings()
    r = await client.post("/api/v1/auth/login", json={
        "email": settings.INITIAL_ADMIN_EMAIL,
        "password": settings.INITIAL_ADMIN_PASSWORD,
    })
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_create_company(client: AsyncClient):
    token = await get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    r = await client.post("/api/v1/companies", json={
        "name": "Qlik", "sector": "Analytics", "description": "Data analytics"
    }, headers=headers)
    assert r.status_code == 201
    assert r.json()["name"] == "Qlik"


@pytest.mark.asyncio
async def test_create_company_user(client: AsyncClient):
    token = await get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create company first
    company_r = await client.post("/api/v1/companies", json={"name": "TestCo"}, headers=headers)
    company_id = company_r.json()["id"]

    # Create company user
    r = await client.post("/api/v1/users", json={
        "email": "user@testco.com", "password": "TestPass123!",
        "first_name": "Test", "last_name": "User",
        "role": "company_user", "company_ids": [company_id],
    }, headers=headers)
    assert r.status_code == 201
    assert r.json()["role"] == "company_user"
    assert company_id in r.json()["company_ids"]


@pytest.mark.asyncio
async def test_rbac_company_user_cannot_see_other_company(client: AsyncClient):
    token = await get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create two companies
    c1 = await client.post("/api/v1/companies", json={"name": "CompanyA"}, headers=headers)
    c2 = await client.post("/api/v1/companies", json={"name": "CompanyB"}, headers=headers)
    c1_id = c1.json()["id"]
    c2_id = c2.json()["id"]

    # Create user for CompanyA only
    await client.post("/api/v1/users", json={
        "email": "a@companya.com", "password": "Pass123!",
        "first_name": "A", "last_name": "User",
        "role": "company_user", "company_ids": [c1_id],
    }, headers=headers)

    # Login as company user
    login_r = await client.post("/api/v1/auth/login", json={
        "email": "a@companya.com", "password": "Pass123!",
    })
    user_token = login_r.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # Should see CompanyA
    r1 = await client.get(f"/api/v1/companies/{c1_id}", headers=user_headers)
    assert r1.status_code == 200

    # Should NOT see CompanyB
    r2 = await client.get(f"/api/v1/companies/{c2_id}", headers=user_headers)
    assert r2.status_code == 403


@pytest.mark.asyncio
async def test_tb_user_read_only(client: AsyncClient):
    admin_token = await get_admin_token(client)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create TB read-only user
    await client.post("/api/v1/users", json={
        "email": "viewer@tb.com", "password": "View123!",
        "first_name": "View", "last_name": "User", "role": "tb_user",
    }, headers=admin_headers)

    login_r = await client.post("/api/v1/auth/login", json={
        "email": "viewer@tb.com", "password": "View123!",
    })
    viewer_token = login_r.json()["access_token"]
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

    # Can list companies (read)
    r = await client.get("/api/v1/companies", headers=viewer_headers)
    assert r.status_code == 200

    # Cannot create company (write)
    r = await client.post("/api/v1/companies", json={"name": "Blocked"}, headers=viewer_headers)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_dashboard_stats(client: AsyncClient):
    token = await get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    r = await client.get("/api/v1/dashboard/stats", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert "total_companies" in data
    assert "total_tools" in data


@pytest.mark.asyncio
async def test_functions_seeded(client: AsyncClient):
    token = await get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    r = await client.get("/api/v1/dashboard/functions", headers=headers)
    assert r.status_code == 200
    fns = r.json()
    assert len(fns) == 9
    names = [f["name"] for f in fns]
    assert "r_and_d" in names
    assert "customer_support" in names
