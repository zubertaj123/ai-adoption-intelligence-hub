# the private equity firm AI Intelligence Hub — Frontend

React 18 + TypeScript + Vite + Tailwind CSS dashboard with the TB design system.

## Quick Start
```bash
npm install
npm run dev
# → http://localhost:5173
```

Expects backend running at `http://localhost:8000` (proxied via Vite).

## Pages

| Page | Route | Roles |
|------|-------|-------|
| Dashboard | `/` | All |
| Companies | `/companies` | Admin, TB User |
| Tool Inventory | `/tools` | All |
| Adoption Metrics | `/adoption` | All |
| Governance | `/governance` | All |
| Time to Value | `/ttv` | All |
| Charts | `/charts` | All |
| Board Report | `/board-report` | All |
| Upload Data | `/upload` | Admin, Company User |
| User Management | `/users` | Admin only |
| Audit Log | `/audit` | Admin, TB User |
| Settings | `/settings` | Admin only |

## RBAC
- Route guards prevent unauthorized navigation
- `RoleGate` component hides UI elements per role
- API client automatically attaches JWT and handles refresh

## Build for Production
```bash
npm run build
# Output: dist/
# Deploy to Azure Static Web Apps, Nginx, or any static host
```
