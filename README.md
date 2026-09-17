# AI Adoption Intelligence Hub

**A multi-tenant dashboard that tells a private equity firm what AI is actually being used across
its portfolio — adoption, performance, governance and spend — across 57+ operating companies.**

A PE firm holding dozens of companies has a portfolio-level question its portfolio companies cannot
answer for it: *where is AI genuinely creating value, where is spend duplicated, and where is
something being used that should worry us?* Each company reports separately, in its own format, on
its own cadence. Nobody has the consolidated picture.

This is a genericised reference implementation. Client and employer identifiers, and all portfolio
company data, have been removed.

---

## The problem

Portfolio-level AI oversight fails on data collection, not analysis.

| Reality | Consequence |
|---|---|
| 57+ operating companies, each independent | No shared system to query; the firm has no direct telemetry |
| Board reporting arrives as spreadsheets, per company, per quarter | Consolidation is manual and stale before it is finished |
| Every company names tools, categories and spend differently | Totals cannot be summed without normalisation |
| Governance posture varies wildly | The firm's aggregate risk exposure is unknown |
| Spend is duplicated across companies | Multiple portfolio companies buy the same tool at list price |
| Adoption ≠ value | Licence counts are reported; realised outcomes are not |

The result is an operating partner making portfolio-level decisions from a spreadsheet that is one
quarter out of date and not comparable across companies.

---

## The solution

A multi-tenant platform: standardised intake from each operating company, normalised into a common
model, surfaced as a portfolio dashboard with per-company drill-down.

```
  ┌────────────┐ ┌────────────┐ ┌────────────┐        57+ operating
  │ Company A  │ │ Company B  │ │ Company N  │        companies
  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
        │ standardised reporting template │
        └──────────────┬──────────────────┘
                       ▼
        ┌──────────────────────────────┐
        │   INGESTION & NORMALISATION  │  tool names, categories,
        │                              │  spend units, periods
        └──────────────┬───────────────┘
                       ▼
        ┌──────────────────────────────┐
        │   MULTI-TENANT DATA MODEL    │  tenant isolation with
        │   (PostgreSQL + Alembic)     │  portfolio-level rollup
        └──────────────┬───────────────┘
                       ▼
   ┌───────────────────┴────────────────────┐
   ▼            ▼             ▼             ▼
┌────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐
│ADOPTION│ │PERFORMANCE│ │GOVERNANCE │ │  SPEND   │
│ which  │ │ is it     │ │ policy,   │ │ cost,    │
│ tools, │ │ working?  │ │ risk,     │ │ overlap, │
│ where  │ │           │ │ controls  │ │ leverage │
└────────┘ └──────────┘ └───────────┘ └──────────┘
             │
             ▼
   React 18 + TypeScript dashboard
   portfolio view  ·  per-company drill-down
```

### Why this shape

**Multi-tenancy is the architecture, not a feature.** Each operating company is a tenant with
isolated data; the firm sees the aggregate. Getting this boundary right at the data model is what
makes the platform acceptable to portfolio company management — they are not exposing their detail
to each other.

**Normalisation at ingestion, not at reporting time.** Companies report in their own vocabulary. If
normalisation is deferred to the dashboard, every query re-solves the same mapping problem and
totals silently disagree. Normalising once at intake makes portfolio sums trustworthy.

**Four distinct lenses, one model.** Adoption, performance, governance and spend are different
questions asked by different people — an operating partner, a CTO, a risk committee, a CFO. They
share a data model but need separate surfaces.

**Spend overlap is a first-class output.** The clearest, fastest ROI in portfolio AI oversight is
noticing that eleven companies independently bought the same tool — and that the firm can negotiate
once on behalf of all of them.

**Standardised intake template.** The unglamorous part that makes everything else work: if each
company reports against a common template, consolidation becomes mechanical rather than a quarterly
project.

---

## Results

| Dimension | Before | After |
|---|---|---|
| Consolidation | Manual spreadsheet merge, quarterly | Automated on ingestion |
| Comparability | Each company's own taxonomy | Normalised common model |
| Freshness | One quarter stale | Current as of last submission |
| Spend visibility | Per company, in isolation | Portfolio-wide, with overlap detection |
| Governance posture | Unknown in aggregate | Tracked and comparable across companies |
| Drill-down | Request it from the company | Available in the dashboard |

### Business benefits

- **Procurement leverage becomes visible and actionable.** Overlapping tool spend across 57
  companies is the firm's single largest immediate saving, and it is invisible without consolidation.
- **Operating partners get a current portfolio view** instead of a quarterly retrospective, which
  changes AI oversight from reporting to management.
- **Aggregate governance risk becomes measurable.** The firm can answer what its exposure looks like
  across the portfolio — a question the board asks and previously nobody could answer.
- **Adoption is separated from value.** Tracking performance alongside adoption stops licence counts
  being mistaken for outcomes.
- **Portfolio companies keep their autonomy.** Tenant isolation means participation does not require
  exposing detail to peers.

---

## Architecture

| Layer | Technology | Responsibility |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind | Portfolio dashboard, per-company drill-down |
| **Backend** | FastAPI, Python 3.12 | REST API, tenant routing |
| **ORM** | SQLAlchemy 2.0 (async) | Multi-tenant data access |
| **Migrations** | Alembic | Schema evolution |
| **Database** | PostgreSQL | Tenant-isolated storage with portfolio rollup |
| **Runtime** | Docker Compose | Local and deployed |

```
backend/
├── app/
│   ├── main.py            FastAPI application
│   ├── config.py          environment configuration
│   └── database.py        async SQLAlchemy, tenant scoping
├── alembic/               schema migrations
├── tests/test_api.py      API tests
└── clean-up-db.py         maintenance tooling
frontend/src/              React dashboard
docker-compose.yml         full local stack
```

---

## Quick start

```bash
cp .env.template .env
docker-compose up --build
# Frontend http://localhost:3000 · API http://localhost:8000/docs
```

No portfolio company data ships with this repository. Ingestion expects a standardised reporting
template per operating company — supply your own.

---

## License

MIT — see [LICENSE](LICENSE).

> Reference implementation. Client and employer identifiers and all portfolio company reporting data
> have been removed.
