"""Generate a blank TB Board Reporting Excel template for companies to fill out."""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import io

SHEETS = [
    "Dashboard",
    "Customer Support", "Sales", "Marketing", "R&D",
    "Finance & Legal", "People & Culture (HR)", "Professional Services",
    "IT", "Customer Sucesss & Renewals"
]

# Styling
HEADER_FONT = Font(bold=True, size=10, color="FFFFFF")
HEADER_FILL = PatternFill(start_color="1E1E1E", end_color="1E1E1E", fill_type="solid")
SECTION_FONT = Font(bold=True, size=11, color="00D67B")
SUBSECTION_FONT = Font(bold=True, size=10, color="5900D0")
LABEL_FONT = Font(bold=True, size=9, color="333333")
THIN_BORDER = Border(
    bottom=Side(style='thin', color='CCCCCC'),
)


def generate_blank_template(company_name: str = "") -> bytes:
    """Generate a blank TB Board Reporting template and return as bytes."""
    wb = openpyxl.Workbook()

    # ─── Dashboard Sheet ───
    ws = wb.active
    ws.title = "Dashboard"

    ws.merge_cells('B1:J1')
    ws.cell(1, 2, f"TB Board Reporting — AI Tools Template{' — ' + company_name if company_name else ''}").font = Font(bold=True, size=14)
    ws.cell(2, 2, "Complete each function tab below. This summary auto-populates.").font = Font(size=9, color="666666", italic=True)

    # Dashboard headers
    dash_headers = ["AI Tool", "Function", "Primary Use Case",
                    "Business Owner (Name + Role)", "Tech Owner (Name + Role)",
                    "Project To-date Spend ($ in 000s)", "RR Annual Tool Spend ($ in 000s)",
                    "Pricing Model (Seat, Usage, etc.)", "Token Limit ", "% Licensed"]
    for i, h in enumerate(dash_headers):
        cell = ws.cell(3, i + 2, h)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal='center', wrap_text=True)

    # Pre-fill function names in rows (5 slots per function)
    row = 4
    for fn in SHEETS[1:]:
        for j in range(5):
            ws.cell(row, 3, fn).font = Font(size=9, color="999999")
            for col in range(4, 12):
                ws.cell(row, col, "").border = THIN_BORDER
            row += 1

    # Spending summary section
    ws.cell(50, 2, "Spending Summary").font = SECTION_FONT
    for i, h in enumerate(["", "AI Tool", "Function", "", "", "", "", "Project Spend ($000s)", "Annual Spend ($000s)"]):
        if h:
            ws.cell(51, i + 1, h).font = LABEL_FONT

    # Column widths
    ws.column_dimensions['A'].width = 3
    ws.column_dimensions['B'].width = 24
    ws.column_dimensions['C'].width = 28
    ws.column_dimensions['D'].width = 40
    ws.column_dimensions['E'].width = 30
    ws.column_dimensions['F'].width = 30
    ws.column_dimensions['G'].width = 22
    ws.column_dimensions['H'].width = 22
    ws.column_dimensions['I'].width = 22
    ws.column_dimensions['J'].width = 15
    ws.column_dimensions['K'].width = 15

    # ─── Function Sheets ───
    for fn in SHEETS[1:]:
        ws = wb.create_sheet(fn)

        # Section 1: Tool Inventory
        ws.cell(2, 2, "AI Native Piloted or Deployed Tools in Portfolio").font = SECTION_FONT
        inv_headers = ["AI Tool", "Primary Use Case", "Business Owner (Name + Role)",
                       "Tech Owner (Name + Role)", "Project To-date Spend ($ in 000s)",
                       "RR Annual Tool Spend ($ in 000s)", "Pricing Model (Seat, Usage, etc.)", "Token Limit "]
        for i, h in enumerate(inv_headers):
            cell = ws.cell(3, i + 2, h)
            cell.font = HEADER_FONT
            cell.fill = HEADER_FILL
            cell.alignment = Alignment(horizontal='center', wrap_text=True)

        # Empty rows for tools (rows 4-9)
        for r in range(4, 10):
            for c in range(2, 10):
                ws.cell(r, c, "").border = THIN_BORDER

        # Section 2: Adoption Metrics
        ws.cell(11, 2, "Adoption Metrics").font = SECTION_FONT
        ws.cell(12, 2, "Adoption").font = SUBSECTION_FONT
        adopt_headers = ["AI Tool", "Employee Pool (#)", "Licenses Bought (#)",
                         "Employees Enabled (#)", "Average Daily Users (#)",
                         "% Licensed", "% Enabled", "% Average Daily Usage"]
        for i, h in enumerate(adopt_headers):
            cell = ws.cell(13, i + 2, h)
            cell.font = HEADER_FONT
            cell.fill = HEADER_FILL
            cell.alignment = Alignment(horizontal='center', wrap_text=True)

        # Empty rows for adoption (rows 14-19)
        for r in range(14, 20):
            for c in range(2, 10):
                ws.cell(r, c, "").border = THIN_BORDER

        # Section 3: Goals
        ws.cell(20, 2, "What are your goals associated with use of AI Tools?").font = SECTION_FONT
        ws.cell(21, 2, "Goals with Tool Use").font = SUBSECTION_FONT
        goal_headers = ["AI Tool", "First Order Goals (Near-term)",
                        "Second Order Goals (Medium-term)", "Third Order Goals (Long-term)"]
        for i, h in enumerate(goal_headers):
            cell = ws.cell(22, i + 2, h)
            cell.font = HEADER_FONT
            cell.fill = HEADER_FILL
            cell.alignment = Alignment(horizontal='center', wrap_text=True)

        # Empty rows for goals (rows 23-28)
        for r in range(23, 29):
            for c in range(2, 6):
                ws.cell(r, c, "").border = THIN_BORDER

        # Column widths
        ws.column_dimensions['A'].width = 3
        ws.column_dimensions['B'].width = 24
        ws.column_dimensions['C'].width = 45
        ws.column_dimensions['D'].width = 35
        ws.column_dimensions['E'].width = 35
        ws.column_dimensions['F'].width = 22
        ws.column_dimensions['G'].width = 22
        ws.column_dimensions['H'].width = 22
        ws.column_dimensions['I'].width = 18

        # Row heights for section headers
        ws.row_dimensions[2].height = 28
        ws.row_dimensions[11].height = 28
        ws.row_dimensions[20].height = 28

    # Write to bytes
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    wb.close()
    return buffer.getvalue()