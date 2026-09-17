"""
Pydantic v2 schemas for request validation and response serialization.
"""
from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime, date
from decimal import Decimal


# ─── Auth ───
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class RefreshRequest(BaseModel):
    refresh_token: str


# ─── Users ───
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: str = "company_user"
    company_ids: list[str] = []

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in ("tb_admin", "tb_user", "company_user"):
            raise ValueError("Invalid role")
        return v

class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    company_ids: list[str] | None = None

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    company_ids: list[str] = []
    last_login_at: datetime | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# ─── Companies ───
class CompanyCreate(BaseModel):
    name: str
    display_name: str | None = None
    sector: str | None = None
    description: str | None = None
    website: str | None = None
    employee_count: int | None = None
    hq_location: str | None = None

class CompanyUpdate(BaseModel):
    name: str | None = None
    display_name: str | None = None
    sector: str | None = None
    description: str | None = None
    website: str | None = None
    employee_count: int | None = None
    hq_location: str | None = None
    is_active: bool | None = None

class CompanyResponse(BaseModel):
    id: str
    name: str
    display_name: str | None = None
    sector: str | None = None
    description: str | None = None
    website: str | None = None
    employee_count: int | None = None
    hq_location: str | None = None
    is_active: bool
    initial_load_at: datetime | None = None
    created_at: datetime | None = None
    tools_count: int = 0
    total_spend: float = 0

    model_config = {"from_attributes": True}


# ─── Tools ───
class ToolCreate(BaseModel):
    company_id: str
    name: str
    vendor: str | None = None
    product: str | None = None        # ADDED
    use_case: str | None = None
    biz_owner_name: str | None = None
    biz_owner_role: str | None = None
    tech_owner_name: str | None = None
    tech_owner_role: str | None = None
    project_spend: Decimal | None = None
    annual_spend: Decimal | None = None
    pricing_model: str | None = None
    token_limit: str | None = None
    deployment_stage: int = 0
    fail_reason: str | None = None
    complexity: str | None = None
    function_ids: list[str] = []

class ToolUpdate(BaseModel):
    name: str | None = None
    vendor: str | None = None
    product: str | None = None        # ADDED
    use_case: str | None = None
    biz_owner_name: str | None = None
    biz_owner_role: str | None = None
    tech_owner_name: str | None = None
    tech_owner_role: str | None = None
    project_spend: Decimal | None = None
    annual_spend: Decimal | None = None
    pricing_model: str | None = None
    token_limit: str | None = None
    deployment_stage: int | None = None
    fail_reason: str | None = None
    complexity: str | None = None
    function_ids: list[str] | None = None

class ToolResponse(BaseModel):
    id: str
    company_id: str
    portco_name: str | None = None    # RENAMED from company_name
    name: str
    vendor: str | None = None
    product: str | None = None        # ADDED
    use_case: str | None = None
    biz_owner_name: str | None = None
    biz_owner_role: str | None = None
    tech_owner_name: str | None = None
    tech_owner_role: str | None = None
    project_spend: float | None = None
    annual_spend: float | None = None
    pricing_model: str | None = None
    token_limit: str | None = None
    deployment_stage: int = 0
    deployment_stage_label: str | None = None
    fail_reason: str | None = None
    complexity: str | None = None
    is_active: bool = True
    function_names: list[str] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


# ─── Adoption ───
class AdoptionSnapshotCreate(BaseModel):
    tool_id: str
    function_id: str
    as_of_date: date
    employee_pool: int | None = None
    licenses_bought: int | None = None
    employees_enabled: int | None = None
    avg_daily_users: int | None = None
    notes: str | None = None

class AdoptionSnapshotResponse(BaseModel):
    id: str
    tool_id: str
    tool_name: str | None = None
    function_id: str
    function_name: str | None = None
    company_id: str
    as_of_date: date
    employee_pool: int | None = None
    licenses_bought: int | None = None
    employees_enabled: int | None = None
    avg_daily_users: int | None = None
    pct_licensed: float | None = None
    pct_enabled: float | None = None
    pct_daily_usage: float | None = None
    source: str | None = None
    notes: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# ─── Governance ───
class GovernanceCreate(BaseModel):
    company_id: str
    name: str
    title: str | None = None
    role: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    function_id: str | None = None
    is_primary: bool = False

class GovernanceUpdate(BaseModel):
    name: str | None = None
    title: str | None = None
    role: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    function_id: str | None = None
    is_primary: bool | None = None

class GovernanceResponse(BaseModel):
    id: str
    company_id: str
    company_name: str | None = None
    name: str
    title: str | None = None
    role: str | None = None
    email: str | None = None
    phone: str | None = None
    function_name: str | None = None
    is_primary: bool = False
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# ─── TTV ───
class TTVCreate(BaseModel):
    tool_id: str
    pilot_start: date | None = None
    pilot_end: date | None = None
    security_approval: date | None = None
    deploy_date: date | None = None
    first_benefit: date | None = None
    notes: str | None = None

class TTVUpdate(BaseModel):
    pilot_start: date | None = None
    pilot_end: date | None = None
    security_approval: date | None = None
    deploy_date: date | None = None
    first_benefit: date | None = None
    notes: str | None = None

class TTVResponse(BaseModel):
    id: str
    tool_id: str
    tool_name: str | None = None
    company_id: str
    company_name: str | None = None
    pilot_start: date | None = None
    pilot_end: date | None = None
    security_approval: date | None = None
    deploy_date: date | None = None
    first_benefit: date | None = None
    pilot_days: int | None = None
    approval_days: int | None = None
    deploy_lag_days: int | None = None
    benefit_days: int | None = None
    total_ttv_days: int | None = None
    notes: str | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


# ─── Goals ───
class GoalCreate(BaseModel):
    tool_id: str
    function_id: str
    first_order_goals: str | None = None
    second_order_goals: str | None = None
    third_order_goals: str | None = None

class GoalUpdate(BaseModel):
    first_order_goals: str | None = None
    second_order_goals: str | None = None
    third_order_goals: str | None = None

class GoalResponse(BaseModel):
    id: str
    tool_id: str
    function_id: str
    first_order_goals: str | None = None
    second_order_goals: str | None = None
    third_order_goals: str | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


# ─── KPI Targets ───
class KpiTargetCreate(BaseModel):
    tool_id: str
    function_id: str
    kpi_name: str
    baseline_value: Decimal | None = None
    target_value: Decimal | None = None
    target_date: date | None = None

class KpiTargetResponse(BaseModel):
    id: str
    tool_id: str
    function_id: str
    kpi_name: str
    baseline_value: float | None = None
    target_value: float | None = None
    target_date: date | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# ─── Dashboard ───
class PortfolioStats(BaseModel):
    total_companies: int = 0
    total_tools: int = 0
    deployed_tools: int = 0
    pilot_tools: int = 0
    failed_tools: int = 0
    total_annual_spend: float = 0
    avg_adoption_pct: float = 0
    total_kpis: int = 0

class ActivityItem(BaseModel):
    id: str
    entity_type: str
    action: str
    description: str
    company_name: str | None = None
    user_email: str | None = None
    created_at: datetime


# ─── Upload ───
class UploadJobResponse(BaseModel):
    id: str
    company_id: str
    filename: str
    status: str
    total_records: int | None = None
    processed_records: int | None = None
    error_message: str | None = None
    created_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


# ─── Pagination ───
class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int


# Forward ref resolution
TokenResponse.model_rebuild()
