"""
the private equity firm AI Intelligence Hub — FastAPI Application
Docker + Azure App Service ready. Health check at /health.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
import time, logging, structlog

from app.config import get_settings
from app.database import engine, Base, AsyncSessionLocal, new_uuid, utcnow
from app.models import User, BusinessFunction
from app.core.security import hash_password
from app.api.v1 import api_router

settings = get_settings()
logger = structlog.get_logger()

# ─── Business function seed data ───
FUNCTION_SEEDS = [
    {"name": "customer_support", "display_name": "Customer Support", "display_order": 1,
     "icon": "◎", "badge_class": "b-sup", "gradient_from": "#1A0060", "gradient_to": "#5900D0"},
    {"name": "sales", "display_name": "Sales", "display_order": 2,
     "icon": "◈", "badge_class": "b-sm", "gradient_from": "#5900D0", "gradient_to": "#00D67B"},
    {"name": "marketing", "display_name": "Marketing", "display_order": 3,
     "icon": "◈", "badge_class": "b-sm", "gradient_from": "#5900D0", "gradient_to": "#00D67B"},
    {"name": "r_and_d", "display_name": "R&D", "display_order": 4,
     "icon": "⚙", "badge_class": "b-rd", "gradient_from": "#004D30", "gradient_to": "#00D67B"},
    {"name": "finance_legal", "display_name": "Finance & Legal", "display_order": 5,
     "icon": "◆", "badge_class": "b-ga", "gradient_from": "#00303A", "gradient_to": "#00A862"},
    {"name": "people_culture", "display_name": "People & Culture (HR)", "display_order": 6,
     "icon": "◆", "badge_class": "b-ga", "gradient_from": "#00303A", "gradient_to": "#00A862"},
    {"name": "professional_services", "display_name": "Professional Services", "display_order": 7,
     "icon": "◎", "badge_class": "b-sup", "gradient_from": "#1A0060", "gradient_to": "#5900D0"},
    {"name": "it", "display_name": "IT", "display_order": 8,
     "icon": "⚙", "badge_class": "b-rd", "gradient_from": "#004D30", "gradient_to": "#00D67B"},
    {"name": "customer_success", "display_name": "Customer Success & Renewals", "display_order": 9,
     "icon": "◎", "badge_class": "b-sup", "gradient_from": "#1A0060", "gradient_to": "#5900D0"},
]


async def seed_initial_data():
    """Create initial admin user and business functions on first run."""
    async with AsyncSessionLocal() as session:
        try:
            # Seed business functions
            existing = await session.execute(select(BusinessFunction))
            if not existing.scalars().first():
                for fn in FUNCTION_SEEDS:
                    session.add(BusinessFunction(id=new_uuid(), **fn))
                logger.info("Seeded 9 business functions")

            # Seed initial admin
            admin = await session.execute(
                select(User).where(User.email == settings.INITIAL_ADMIN_EMAIL)
            )
            if not admin.scalars().first():
                session.add(User(
                    id=new_uuid(),
                    email=settings.INITIAL_ADMIN_EMAIL,
                    password_hash=hash_password(settings.INITIAL_ADMIN_PASSWORD),
                    first_name=settings.INITIAL_ADMIN_FIRST_NAME,
                    last_name=settings.INITIAL_ADMIN_LAST_NAME,
                    role="tb_admin",
                    created_at=utcnow(),
                ))
                logger.info("Created initial admin user", email=settings.INITIAL_ADMIN_EMAIL)

            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error("Seed data failed", error=str(e))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables + seed data. Shutdown: dispose engine."""
    logger.info("Starting application", environment=settings.ENVIRONMENT)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_initial_data()
    yield
    await engine.dispose()
    logger.info("Application shutdown")


# ─── App Factory ───
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# ─── CORS ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)


# ─── Request timing middleware ───
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = round((time.time() - start) * 1000, 2)
    response.headers["X-Response-Time"] = f"{elapsed}ms"
    if elapsed > 2000:
        logger.warning("Slow request", path=request.url.path, duration_ms=elapsed)
    return response


# ─── Global exception handler ───
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", path=request.url.path, error=str(exc))
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ─── Health check (Azure App Service requires this) ───
@app.get("/health", tags=["System"])
async def health_check():
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "healthy", "version": settings.APP_VERSION,
                "environment": settings.ENVIRONMENT, "database": "connected"}
    except Exception as e:
        return JSONResponse(status_code=503, content={
            "status": "unhealthy", "database": "disconnected", "error": str(e)
        })


@app.get("/", tags=["System"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
    }


# ─── Mount API v1 ───
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
