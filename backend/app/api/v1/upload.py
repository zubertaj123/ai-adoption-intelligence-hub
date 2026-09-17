"""Excel upload — parse, preview, commit pipeline."""
import os, json
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db, new_uuid, utcnow
from app.models import (UploadJob, Company, Tool, ToolFunction, AdoptionSnapshot,
                        ToolGoal, GovernanceContact, BusinessFunction)
from app.schemas import UploadJobResponse
from app.api.deps import get_current_user, check_write_access
from app.utils.excel_parser import parse_template
from app.services.audit import log_action
from app.config import get_settings

from fastapi.responses import Response
from app.utils.template_generator import generate_blank_template

router = APIRouter(prefix="/upload", tags=["Upload"])

@router.get("/template/download")
async def download_blank_template():
    """Download a blank TB Board Reporting Excel template."""
    template_bytes = generate_blank_template()
    return Response(
        content=template_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=TB_Board_Reporting_Template_Blank.xlsx"
        }
    )
 
@router.post("/{company_id}", response_model=UploadJobResponse)
async def upload_template(
    company_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_write_access(current_user, company_id)
    company = (await db.execute(select(Company).where(Company.id == company_id))).scalar_one_or_none()
    if not company:
        raise HTTPException(404, "Company not found")

    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Only .xlsx files are supported")

    settings = get_settings()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOAD_DIR, f"{company_id}_{new_uuid()[:8]}_{file.filename}")
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large (max {settings.MAX_UPLOAD_SIZE_MB}MB)")

    with open(file_path, "wb") as f:
        f.write(content)

    job = UploadJob(
        id=new_uuid(), company_id=company_id, filename=file.filename,
        file_path=file_path, file_size_bytes=len(content),
        status="processing", uploaded_by=current_user.id, created_at=utcnow(),
    )
    db.add(job)
    await db.flush()

    try:
        parsed = parse_template(file_path)
        job.status = "preview"
        job.total_records = (parsed["stats"]["tools_found"] +
                            parsed["stats"]["adoption_records"] + len(parsed["goals"]))
        job.parsed_summary = json.dumps({
            "tools": list(parsed["tools"].keys()),
            "functions_parsed": parsed["stats"]["sheets_parsed"],
            "adoption_records": parsed["stats"]["adoption_records"],
            "goals_count": len(parsed["goals"]),
            "governance_contacts": len(parsed["governance"]),
            "errors": parsed["errors"],
        })
        await db.flush()
    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)
        await db.flush()
        raise HTTPException(400, f"Failed to parse template: {str(e)}")

    await log_action(db, "upload", job.id, "upload", user_id=current_user.id,
                     user_email=current_user.email, company_id=company_id,
                     new_value=file.filename)

    return UploadJobResponse(
        id=job.id, company_id=job.company_id, filename=job.filename,
        status=job.status, total_records=job.total_records,
        created_at=job.created_at,
    )


@router.get("/{company_id}/jobs", response_model=list[UploadJobResponse])
async def list_upload_jobs(company_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    check_write_access(current_user, company_id)
    result = await db.execute(
        select(UploadJob).where(UploadJob.company_id == company_id)
        .order_by(UploadJob.created_at.desc()).limit(20)
    )
    return [UploadJobResponse(id=j.id, company_id=j.company_id, filename=j.filename,
            status=j.status, total_records=j.total_records, processed_records=j.processed_records,
            error_message=j.error_message, created_at=j.created_at, completed_at=j.completed_at)
            for j in result.scalars().all()]


@router.get("/jobs/{job_id}/preview")
async def preview_upload(job_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    job = (await db.execute(select(UploadJob).where(UploadJob.id == job_id))).scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Upload job not found")
    check_write_access(current_user, job.company_id)
    if job.status != "preview":
        raise HTTPException(400, f"Job status is '{job.status}', not 'preview'")
    return {"job_id": job.id, "summary": json.loads(job.parsed_summary) if job.parsed_summary else {}}


@router.post("/jobs/{job_id}/commit")
async def commit_upload(job_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    job = (await db.execute(select(UploadJob).where(UploadJob.id == job_id))).scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Upload job not found")
    check_write_access(current_user, job.company_id)
    if job.status != "preview":
        raise HTTPException(400, f"Job status is '{job.status}', expected 'preview'")

    try:
        parsed = parse_template(job.file_path)
        fn_map = {}
        fn_result = await db.execute(select(BusinessFunction))
        for bf in fn_result.scalars().all():
            fn_map[bf.name] = bf.id

        processed = 0
        tool_id_map = {}

        for tool_name, tool_data in parsed["tools"].items():
            existing = await db.execute(
                select(Tool).where(Tool.company_id == job.company_id, Tool.name == tool_name)
            )
            tool = existing.scalar_one_or_none()
            if tool:
                for k, v in tool_data.items():
                    if v is not None and k != "name":
                        setattr(tool, k, v)
                tool.updated_at = utcnow()
                tool.updated_by = current_user.id
            else:
                tool = Tool(id=new_uuid(), company_id=job.company_id, name=tool_name,
                           created_by=current_user.id, created_at=utcnow(), **{
                               k: v for k, v in tool_data.items() if k != "name"
                           })
                db.add(tool)
            await db.flush()
            tool_id_map[tool_name] = tool.id
            processed += 1

        for tool_name, fn_name in parsed["tool_functions"]:
            tid = tool_id_map.get(tool_name)
            fid = fn_map.get(fn_name)
            if tid and fid:
                existing = await db.execute(
                    select(ToolFunction).where(ToolFunction.tool_id == tid, ToolFunction.function_id == fid)
                )
                if not existing.scalar_one_or_none():
                    db.add(ToolFunction(id=new_uuid(), tool_id=tid, function_id=fid))

        today = date.today()
        for adoption in parsed["adoption"]:
            tid = tool_id_map.get(adoption["tool_name"])
            fid = fn_map.get(adoption["function"])
            if tid and fid:
                snap = AdoptionSnapshot(
                    id=new_uuid(), tool_id=tid, function_id=fid, company_id=job.company_id,
                    as_of_date=today, employee_pool=adoption.get("employee_pool"),
                    licenses_bought=adoption.get("licenses_bought"),
                    employees_enabled=adoption.get("employees_enabled"),
                    avg_daily_users=adoption.get("avg_daily_users"),
                    pct_licensed=adoption.get("pct_licensed"),
                    pct_enabled=adoption.get("pct_enabled"),
                    pct_daily_usage=adoption.get("pct_daily_usage"),
                    source="excel", created_by=current_user.id, created_at=utcnow(),
                )
                db.add(snap)
                processed += 1

        for goal_data in parsed["goals"]:
            tid = tool_id_map.get(goal_data["tool_name"])
            fid = fn_map.get(goal_data["function"])
            if tid and fid:
                existing = await db.execute(
                    select(ToolGoal).where(ToolGoal.tool_id == tid, ToolGoal.function_id == fid)
                )
                goal = existing.scalar_one_or_none()
                if goal:
                    for k in ["first_order_goals", "second_order_goals", "third_order_goals"]:
                        if goal_data.get(k):
                            setattr(goal, k, goal_data[k])
                    goal.updated_at = utcnow()
                else:
                    db.add(ToolGoal(
                        id=new_uuid(), tool_id=tid, function_id=fid,
                        first_order_goals=goal_data.get("first_order_goals"),
                        second_order_goals=goal_data.get("second_order_goals"),
                        third_order_goals=goal_data.get("third_order_goals"),
                        updated_by=current_user.id,
                    ))
                processed += 1

        seen_contacts = set()
        for gov in parsed["governance"]:
            fid = fn_map.get(gov["function"])
            key = (gov["name"], job.company_id)
            if key not in seen_contacts:
                seen_contacts.add(key)
                existing = await db.execute(
                    select(GovernanceContact).where(
                        GovernanceContact.company_id == job.company_id,
                        GovernanceContact.name == gov["name"]
                    )
                )
                if not existing.scalar_one_or_none():
                    db.add(GovernanceContact(
                        id=new_uuid(), company_id=job.company_id,
                        name=gov["name"], role=gov.get("role"), function_id=fid,
                        created_by=current_user.id, created_at=utcnow(),
                    ))

        company = (await db.execute(select(Company).where(Company.id == job.company_id))).scalar_one()
        if not company.initial_load_at:
            company.initial_load_at = utcnow()

        job.status = "committed"
        job.processed_records = processed
        job.completed_at = utcnow()
        await db.flush()

        await log_action(db, "upload", job_id, "create", user_id=current_user.id,
                         user_email=current_user.email, company_id=job.company_id,
                         new_value=f"Committed {processed} records from {job.filename}")

        return {"status": "committed", "processed_records": processed}

    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)
        await db.flush()
        raise HTTPException(500, f"Commit failed: {str(e)}")
