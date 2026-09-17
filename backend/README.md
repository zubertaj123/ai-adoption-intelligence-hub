# the private equity firm AI Intelligence Hub — Backend

Production-grade FastAPI backend with PostgreSQL, full RBAC, Excel ingestion pipeline, and Snowflake-ready architecture.

## Quick Start

### Docker (recommended)
```bash
cp .env.example .env
docker-compose up -d
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
# Health: http://localhost:8000/health
```

### Local Development
```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Start PostgreSQL locally or update DATABASE_URL
uvicorn app.main:app --reload --port 8000
```

### First Login
On first startup, an admin user is created automatically:
- **Email:** admin@examplepe.com
- **Password:** TBAdmin2026!

## Architecture

```
app/
├── main.py              # App factory, startup, middleware
├── config.py            # Environment-driven settings
├── database.py          # SQLAlchemy engine + session
├── models/              # ORM models (14 tables)
├── schemas/             # Pydantic request/response models
├── api/v1/              # Route handlers (13 route groups)
├── core/security.py     # JWT + password hashing
├── services/            # Cache, audit services
└── utils/               # Excel parser, KPI calculator
```

## API Routes

| Route | Description |
|-------|------------|
| `POST /api/v1/auth/login` | Login, get JWT |
| `GET /api/v1/auth/me` | Current user info |
| `CRUD /api/v1/users` | User management (admin) |
| `CRUD /api/v1/companies` | Portfolio company management |
| `CRUD /api/v1/tools` | AI tool inventory |
| `CRUD /api/v1/adoption` | Adoption snapshots + history |
| `CRUD /api/v1/governance` | Governance contacts |
| `CRUD /api/v1/ttv` | Time-to-value milestones |
| `CRUD /api/v1/goals` | Tool goals (qualitative) |
| `POST /api/v1/upload/{company_id}` | Excel template upload |
| `GET /api/v1/dashboard/*` | Stats, charts, board report |
| `GET /api/v1/audit` | Audit log |

## RBAC Roles

| Role | Access |
|------|--------|
| `tb_admin` | Full CRUD all companies, user management, uploads |
| `tb_user` | Read-only across all companies |
| `company_user` | Full CRUD within assigned company only |

## Database Migration to Snowflake

1. Install `snowflake-sqlalchemy` and `snowflake-connector-python`
2. Update `DATABASE_URL` in `.env`:
   ```
   DATABASE_URL=snowflake://user:pass@account/TB_AI_HUB/PORTFOLIO
   ```
3. Run Alembic migration to adjust dialect-specific types
4. All ORM models, queries, and API routes work unchanged

## Azure Deployment

### Azure App Service
```bash
az webapp create --name ai-hub-api --plan tb-plan --runtime "PYTHON:3.12"
az webapp config appsettings set --name ai-hub-api --settings @azure-settings.json
az webapp deployment source config-zip --name ai-hub-api --src deploy.zip
```

### Azure Container Apps
```bash
az containerapp create --name ai-hub-api --image ai-hub:latest \
  --target-port 8000 --env-vars @azure-env.yaml
```

The Dockerfile includes health check at `/health` which Azure uses for readiness probes.

## Running Tests
```bash
pip install aiosqlite  # SQLite async driver for tests
pytest tests/ -v
```
