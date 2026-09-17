"""
SQLAlchemy ORM models — uses only types that map 1:1 to Snowflake.
No JSONB, no arrays, no PostgreSQL enums, no auto-increment.
"""
from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, Date, Text, DECIMAL,
    ForeignKey, UniqueConstraint, CheckConstraint, BigInteger
)
from sqlalchemy.orm import relationship
from app.database import Base, new_uuid, utcnow

UUID_COL = lambda: Column(String(36), primary_key=True, default=new_uuid)
TS_COL = lambda: Column(DateTime(timezone=True), default=utcnow)
TS_UPD = lambda: Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class User(Base):
    __tablename__ = "users"

    id = UUID_COL()
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False)  # tb_admin, tb_user, company_user
    avatar_url = Column(String(500))
    is_active = Column(Boolean, default=True)
    last_login_at = Column(DateTime(timezone=True))
    created_at = TS_COL()
    updated_at = TS_UPD()
    created_by = Column(String(36), ForeignKey("users.id"))

    companies = relationship("UserCompany", back_populates="user", lazy="selectin", foreign_keys="UserCompany.user_id")

    __table_args__ = (
        CheckConstraint("role IN ('tb_admin','tb_user','company_user')", name="ck_user_role"),
    )

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def company_ids(self):
        return [uc.company_id for uc in self.companies]


class UserCompany(Base):
    __tablename__ = "user_companies"

    id = UUID_COL()
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    assigned_at = TS_COL()
    assigned_by = Column(String(36), ForeignKey("users.id"))

    user = relationship("User", back_populates="companies", foreign_keys=[user_id])
    company = relationship("Company", back_populates="user_assignments")

    __table_args__ = (UniqueConstraint("user_id", "company_id", name="uq_user_company"),)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = UUID_COL()
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = TS_COL()
    revoked_at = Column(DateTime(timezone=True))


class Company(Base):
    __tablename__ = "companies"

    id = UUID_COL()
    name = Column(String(200), unique=True, nullable=False, index=True)
    display_name = Column(String(200))
    sector = Column(String(100))
    description = Column(Text)
    logo_url = Column(String(500))
    website = Column(String(300))
    employee_count = Column(Integer)
    hq_location = Column(String(200))
    initial_load_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    created_at = TS_COL()
    updated_at = TS_UPD()
    created_by = Column(String(36), ForeignKey("users.id"))

    tools = relationship("Tool", back_populates="company", lazy="selectin")
    governance_contacts = relationship("GovernanceContact", back_populates="company")
    user_assignments = relationship("UserCompany", back_populates="company")


class BusinessFunction(Base):
    __tablename__ = "business_functions"

    id = UUID_COL()
    name = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(100))
    display_order = Column(Integer, nullable=False)
    icon = Column(String(10))
    badge_class = Column(String(30))
    gradient_from = Column(String(7))
    gradient_to = Column(String(7))


class Tool(Base):
    __tablename__ = "tools"

    id = UUID_COL()
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    product = Column(String(50))              # Product 1–10
    vendor = Column(String(200))
    use_case = Column(Text)
    biz_owner_name = Column(String(200))
    biz_owner_role = Column(String(100))
    tech_owner_name = Column(String(200))
    tech_owner_role = Column(String(100))
    project_spend = Column(DECIMAL(12, 2))
    annual_spend = Column(DECIMAL(12, 2))
    pricing_model = Column(String(50))
    token_limit = Column(String(50))
    deployment_stage = Column(Integer, default=0)
    fail_reason = Column(String(200))
    complexity = Column(String(20))
    is_active = Column(Boolean, default=True)
    created_at = TS_COL()
    updated_at = TS_UPD()
    created_by = Column(String(36), ForeignKey("users.id"))
    updated_by = Column(String(36), ForeignKey("users.id"))

    company = relationship("Company", back_populates="tools", lazy="selectin")
    functions = relationship("ToolFunction", back_populates="tool", lazy="selectin")
    adoption_snapshots = relationship("AdoptionSnapshot", back_populates="tool", lazy="selectin")
    goals = relationship("ToolGoal", back_populates="tool", lazy="selectin")
    ttv = relationship("TimeToValue", back_populates="tool", uselist=False, lazy="selectin")

    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_company_tool"),
        CheckConstraint("deployment_stage BETWEEN 0 AND 4", name="ck_tool_stage"),
        CheckConstraint("pricing_model IN ('Per Seat','Per API Token','Usage','Enterprise License','Outcome-Based','Other') OR pricing_model IS NULL", name="ck_pricing"),
        CheckConstraint("complexity IN ('Low','Medium','High') OR complexity IS NULL", name="ck_complexity"),
    )


class ToolFunction(Base):
    __tablename__ = "tool_functions"

    id = UUID_COL()
    tool_id = Column(String(36), ForeignKey("tools.id", ondelete="CASCADE"), nullable=False)
    function_id = Column(String(36), ForeignKey("business_functions.id"), nullable=False)
    use_case_override = Column(Text)
    biz_owner_override = Column(String(200))
    tech_owner_override = Column(String(200))

    tool = relationship("Tool", back_populates="functions")
    function = relationship("BusinessFunction", lazy="selectin")

    __table_args__ = (UniqueConstraint("tool_id", "function_id", name="uq_tool_function"),)


class AdoptionSnapshot(Base):
    __tablename__ = "adoption_snapshots"

    id = UUID_COL()
    tool_id = Column(String(36), ForeignKey("tools.id", ondelete="CASCADE"), nullable=False, index=True)
    function_id = Column(String(36), ForeignKey("business_functions.id"), nullable=False)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)
    as_of_date = Column(Date, nullable=False)
    employee_pool = Column(Integer)
    licenses_bought = Column(Integer)
    employees_enabled = Column(Integer)
    avg_daily_users = Column(Integer)
    pct_licensed = Column(DECIMAL(7, 2))
    pct_enabled = Column(DECIMAL(7, 2))
    pct_daily_usage = Column(DECIMAL(7, 2))
    source = Column(String(20), default="manual")
    notes = Column(Text)
    created_at = TS_COL()
    created_by = Column(String(36), ForeignKey("users.id"))

    tool = relationship("Tool", back_populates="adoption_snapshots", lazy="selectin")
    function = relationship("BusinessFunction", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("tool_id", "function_id", "as_of_date", name="uq_adoption_snap"),
        CheckConstraint("source IN ('excel','manual','api')", name="ck_adoption_source"),
    )


class KpiTarget(Base):
    __tablename__ = "kpi_targets"

    id = UUID_COL()
    tool_id = Column(String(36), ForeignKey("tools.id", ondelete="CASCADE"), nullable=False)
    function_id = Column(String(36), ForeignKey("business_functions.id"), nullable=False)
    kpi_name = Column(String(50), nullable=False)
    baseline_value = Column(DECIMAL(10, 2))
    target_value = Column(DECIMAL(10, 2))
    target_date = Column(Date)
    set_by = Column(String(36), ForeignKey("users.id"))
    created_at = TS_COL()
    updated_at = TS_UPD()

    __table_args__ = (
        UniqueConstraint("tool_id", "function_id", "kpi_name", name="uq_kpi_target"),
        CheckConstraint("kpi_name IN ('pct_licensed','pct_enabled','pct_daily_usage')", name="ck_kpi_name"),
    )


class ToolGoal(Base):
    __tablename__ = "tool_goals"

    id = UUID_COL()
    tool_id = Column(String(36), ForeignKey("tools.id", ondelete="CASCADE"), nullable=False)
    function_id = Column(String(36), ForeignKey("business_functions.id"), nullable=False)
    first_order_goals = Column(Text)
    second_order_goals = Column(Text)
    third_order_goals = Column(Text)
    updated_at = TS_UPD()
    updated_by = Column(String(36), ForeignKey("users.id"))

    tool = relationship("Tool", back_populates="goals", lazy="selectin")
    function = relationship("BusinessFunction", lazy="selectin")

    __table_args__ = (UniqueConstraint("tool_id", "function_id", name="uq_tool_goal"),)


class GovernanceContact(Base):
    __tablename__ = "governance_contacts"

    id = UUID_COL()
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    title = Column(String(200))
    role = Column(String(100))
    email = Column(String(255))
    phone = Column(String(50))
    function_id = Column(String(36), ForeignKey("business_functions.id"))
    is_primary = Column(Boolean, default=False)
    created_at = TS_COL()
    updated_at = TS_UPD()
    created_by = Column(String(36), ForeignKey("users.id"))

    company = relationship("Company", back_populates="governance_contacts", lazy="selectin")
    function = relationship("BusinessFunction", lazy="selectin")


class TimeToValue(Base):
    __tablename__ = "time_to_value"

    id = UUID_COL()
    tool_id = Column(String(36), ForeignKey("tools.id", ondelete="CASCADE"), nullable=False, unique=True)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False)
    pilot_start = Column(Date)
    pilot_end = Column(Date)
    security_approval = Column(Date)
    deploy_date = Column(Date)
    first_benefit = Column(Date)
    notes = Column(Text)
    created_at = TS_COL()
    updated_at = TS_UPD()
    updated_by = Column(String(36), ForeignKey("users.id"))

    tool = relationship("Tool", back_populates="ttv", lazy="selectin")


class UploadJob(Base):
    __tablename__ = "upload_jobs"

    id = UUID_COL()
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False)
    filename = Column(String(500), nullable=False)
    file_path = Column(String(1000))
    file_size_bytes = Column(BigInteger)
    status = Column(String(20), default="pending")
    total_records = Column(Integer)
    processed_records = Column(Integer)
    error_message = Column(Text)
    parsed_summary = Column(Text)  # JSON string — not JSONB (Snowflake compat)
    uploaded_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = TS_COL()
    completed_at = Column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("status IN ('pending','processing','preview','committed','failed')", name="ck_upload_status"),
    )


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = UUID_COL()
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(String(36), nullable=False)
    action = Column(String(20), nullable=False)
    field_changed = Column(String(100))
    old_value = Column(String(1000))
    new_value = Column(String(1000))
    company_id = Column(String(36), index=True)
    user_id = Column(String(36))
    user_email = Column(String(255))
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    created_at = TS_COL()

    __table_args__ = (
        CheckConstraint("action IN ('create','update','delete','upload','login','export')", name="ck_audit_action"),
    )


class Notification(Base):
    __tablename__ = "notifications"

    id = UUID_COL()
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text)
    type = Column(String(20), default="info")
    is_read = Column(Boolean, default=False)
    link = Column(String(500))
    created_at = TS_COL()

    __table_args__ = (
        CheckConstraint("type IN ('info','success','warning','error')", name="ck_notif_type"),
    )


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)
    description = Column(String(500))
    updated_at = TS_UPD()
    updated_by = Column(String(36), ForeignKey("users.id"))
