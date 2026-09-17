"""
Excel template parser — reads the TB Board Reporting .xlsx format.
Handles the 10-sheet structure: Dashboard + 9 function sheets.
Each function sheet has 3 sections: Tool Inventory, Adoption Metrics, Goals.
"""
import openpyxl
from decimal import Decimal, InvalidOperation
from datetime import date

EXPECTED_FUNCTIONS = [
    "Customer Support", "Sales", "Marketing", "R&D",
    "Finance & Legal", "People & Culture (HR)",
    "Professional Services", "IT", "Customer Sucesss & Renewals"  # note: typo matches real template
]

FUNCTION_NAME_MAP = {
    "Customer Support": "customer_support",
    "Sales": "sales",
    "Marketing": "marketing",
    "R&D": "r_and_d",
    "Finance & Legal": "finance_legal",
    "People & Culture (HR)": "people_culture",
    "Professional Services": "professional_services",
    "IT": "it",
    "Customer Sucesss & Renewals": "customer_success",
    "Customer Success & Renewals": "customer_success",
}


def safe_decimal(val) -> Decimal | None:
    if val is None or val == "" or str(val).strip().upper() in ("TBD", "N/A", "0"):
        return None
    try:
        v = str(val).replace(",", "").replace("$", "").strip()
        d = Decimal(v)
        return d * 1000 if d < 10000 else d  # template uses $000s
    except (InvalidOperation, ValueError):
        return None


def safe_int(val) -> int | None:
    if val is None or val == "" or str(val).strip().upper() in ("TBD", "N/A"):
        return None
    try:
        return int(float(str(val).replace(",", "").strip()))
    except (ValueError, TypeError):
        return None


def safe_str(val) -> str | None:
    if val is None or str(val).strip() in ("0", ""):
        return None
    s = str(val).strip()
    return s if s.upper() not in ("TBD", "N/A", "0") else None


def safe_pct(val) -> float | None:
    if val is None or str(val).strip().upper() in ("TBD", "N/A", "0"):
        return None
    try:
        f = float(val)
        return round(f * 100, 2) if f <= 1.5 else round(f, 2)
    except (ValueError, TypeError):
        return None


def parse_owner(val: str | None) -> tuple[str | None, str | None]:
    if not val or str(val).strip() in ("0", ""):
        return None, None
    s = str(val).strip()
    if "(" in s and ")" in s:
        name = s[:s.index("(")].strip()
        role = s[s.index("(") + 1:s.index(")")].strip()
        return name, role
    return s, None


def normalize_pricing_model(val: str | None) -> str | None:
    """Map Excel pricing values to database constraint values."""
    if not val:
        return None

    val_clean = str(val).strip().lower()

    # Map common Excel values to database constraint values
    pricing_map = {
        'seat': 'Per Seat',
        'per seat': 'Per Seat',
        'per-seat': 'Per Seat',
        'api token': 'Per API Token',
        'per api token': 'Per API Token',
        'api': 'Per API Token',
        'token': 'Per API Token',
        'usage': 'Usage',
        'per usage': 'Usage',
        'enterprise': 'Enterprise License',
        'enterprise license': 'Enterprise License',
        'outcome': 'Outcome-Based',
        'outcome-based': 'Outcome-Based',
        'outcome based': 'Outcome-Based',
        'other': 'Other',
    }

    return pricing_map.get(val_clean, 'Other')


def infer_stage(tool_data: dict, adoption_data: dict | None) -> int:
    has_spend = tool_data.get("annual_spend") is not None
    has_adoption = adoption_data and adoption_data.get("employees_enabled") is not None
    if has_spend and has_adoption:
        return 3  # Deployed
    if has_spend:
        return 1  # In Pilot
    return 0  # Pre-Pilot


def parse_template(filepath: str) -> dict:
    """
    Parse the TB Board Reporting Excel template.
    Returns structured data ready for database insertion.
    """
    wb = openpyxl.load_workbook(filepath, data_only=True)
    result = {
        "tools": {},          # tool_name → tool data (deduplicated)
        "tool_functions": [],  # (tool_name, function_name)
        "adoption": [],        # per-tool per-function adoption data
        "goals": [],           # per-tool per-function goals
        "governance": [],      # unique owners extracted
        "spending_summary": [],
        "errors": [],
        "stats": {"sheets_parsed": 0, "tools_found": 0, "adoption_records": 0}
    }

    # Parse Dashboard spending summary (rows 50-67)
    if "Dashboard" in wb.sheetnames:
        dash = wb["Dashboard"]
        for row in range(52, min(dash.max_row + 1, 67)):
            tool_name = safe_str(dash.cell(row, 3).value)  # col C = Vendor/Tool
            if tool_name:
                result["spending_summary"].append({
                    "tool_name": tool_name,
                    "project_spend": safe_decimal(dash.cell(row, 8).value),  # col H
                    "annual_spend": safe_decimal(dash.cell(row, 9).value),   # col I
                })

    # Parse each function sheet
    for sheet_name in wb.sheetnames:
        if sheet_name == "Dashboard":
            continue

        fn_key = FUNCTION_NAME_MAP.get(sheet_name)
        if not fn_key:
            result["errors"].append(f"Unknown sheet: {sheet_name}")
            continue

        ws = wb[sheet_name]
        result["stats"]["sheets_parsed"] += 1

        # Section 1: Tool Inventory (rows 3-9, cols B-I)
        for row in range(4, min(ws.max_row + 1, 10)):
            tool_name = safe_str(ws.cell(row, 2).value)  # col B
            if not tool_name:
                continue

            biz_name, biz_role = parse_owner(ws.cell(row, 4).value)  # col D
            tech_name, tech_role = parse_owner(ws.cell(row, 5).value)  # col E

            tool_data = {
                "name": tool_name,
                "use_case": safe_str(ws.cell(row, 3).value),  # col C
                "biz_owner_name": biz_name,
                "biz_owner_role": biz_role,
                "tech_owner_name": tech_name,
                "tech_owner_role": tech_role,
                "project_spend": safe_decimal(ws.cell(row, 6).value),  # col F
                "annual_spend": safe_decimal(ws.cell(row, 7).value),   # col G
                "pricing_model": normalize_pricing_model(ws.cell(row, 8).value),      # col H
                "token_limit": safe_str(ws.cell(row, 9).value),        # col I
            }

            # Dedup: keep richest data per tool
            if tool_name not in result["tools"]:
                result["tools"][tool_name] = tool_data
                result["stats"]["tools_found"] += 1
            else:
                existing = result["tools"][tool_name]
                for k, v in tool_data.items():
                    if v is not None and existing.get(k) is None:
                        existing[k] = v

            result["tool_functions"].append((tool_name, fn_key))

            # Extract governance contacts
            for name, role, owner_type in [
                (biz_name, biz_role, "Business"),
                (tech_name, tech_role, "Technical")
            ]:
                if name:
                    result["governance"].append({
                        "name": name,
                        "role": role or owner_type,
                        "function": fn_key,
                    })

        # Section 2: Adoption Metrics (rows 13-18, cols B-I)
        for row in range(14, min(ws.max_row + 1, 20)):
            tool_name = safe_str(ws.cell(row, 2).value)  # col B
            if not tool_name:
                continue

            pool = safe_int(ws.cell(row, 3).value)
            licenses = safe_int(ws.cell(row, 4).value)
            enabled = safe_int(ws.cell(row, 5).value)
            daily = safe_int(ws.cell(row, 6).value)

            adoption = {
                "tool_name": tool_name,
                "function": fn_key,
                "employee_pool": pool,
                "licenses_bought": licenses,
                "employees_enabled": enabled,
                "avg_daily_users": daily,
                "pct_licensed": round(licenses / pool * 100, 2) if pool and licenses else None,
                "pct_enabled": round(enabled / licenses * 100, 2) if licenses and enabled else None,
                "pct_daily_usage": round(daily / enabled * 100, 2) if enabled and daily else None,
            }

            # Override with pre-calculated % if raw counts are missing
            if adoption["pct_licensed"] is None:
                adoption["pct_licensed"] = safe_pct(ws.cell(row, 7).value)
            if adoption["pct_enabled"] is None:
                adoption["pct_enabled"] = safe_pct(ws.cell(row, 8).value)
            if adoption["pct_daily_usage"] is None:
                adoption["pct_daily_usage"] = safe_pct(ws.cell(row, 9).value)

            has_data = any(v is not None for v in [pool, licenses, enabled, daily,
                           adoption["pct_licensed"], adoption["pct_enabled"], adoption["pct_daily_usage"]])
            if has_data:
                result["adoption"].append(adoption)
                result["stats"]["adoption_records"] += 1

        # Section 3: Goals (rows 22-27, cols B-E)
        for row in range(23, min(ws.max_row + 1, 28)):
            tool_name = safe_str(ws.cell(row, 2).value)
            if not tool_name:
                continue

            goals = {
                "tool_name": tool_name,
                "function": fn_key,
                "first_order_goals": safe_str(ws.cell(row, 3).value),
                "second_order_goals": safe_str(ws.cell(row, 4).value),
                "third_order_goals": safe_str(ws.cell(row, 5).value),
            }
            if any(goals[k] for k in ["first_order_goals", "second_order_goals", "third_order_goals"]):
                result["goals"].append(goals)

    # Infer deployment stages
    adoption_by_tool = {}
    for a in result["adoption"]:
        adoption_by_tool.setdefault(a["tool_name"], []).append(a)

    for tool_name, tool_data in result["tools"].items():
        adopt = adoption_by_tool.get(tool_name, [None])[0]
        tool_data["deployment_stage"] = infer_stage(tool_data, adopt)

    # Deduplicate governance contacts
    seen = set()
    deduped_gov = []
    for g in result["governance"]:
        key = (g["name"], g["function"])
        if key not in seen:
            seen.add(key)
            deduped_gov.append(g)
    result["governance"] = deduped_gov

    # Use spending summary for accurate totals
    for s in result["spending_summary"]:
        tool = result["tools"].get(s["tool_name"])
        if tool:
            if s["project_spend"] is not None:
                tool["project_spend"] = s["project_spend"]
            if s["annual_spend"] is not None:
                tool["annual_spend"] = s["annual_spend"]

    wb.close()
    return result
