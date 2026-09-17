from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.companies import router as companies_router
from app.api.v1.tools import router as tools_router
from app.api.v1.adoption import router as adoption_router
from app.api.v1.governance_ttv_goals import gov_router, ttv_router, goals_router
from app.api.v1.upload import router as upload_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.audit import router as audit_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(companies_router)
api_router.include_router(tools_router)
api_router.include_router(adoption_router)
api_router.include_router(gov_router)
api_router.include_router(ttv_router)
api_router.include_router(goals_router)
api_router.include_router(upload_router)
api_router.include_router(dashboard_router)
api_router.include_router(audit_router)
