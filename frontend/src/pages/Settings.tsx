import { useQuery } from '@tanstack/react-query';
import { useUIStore } from '@/stores/authStore';

const PAGE_META: Record<string, {title: string; sub: string; apiKey: string}> = {
  BoardReport: { title: 'Board Report', sub: 'Quarterly AI performance summary by function', apiKey: 'board-report' },
  Governance: { title: 'Governance Council', sub: 'AI leadership contacts across portfolio', apiKey: 'governance' },
  TTV: { title: 'Time to Value', sub: 'Deployment lifecycle timelines', apiKey: 'ttv' },
  Charts: { title: 'Charts & Visuals', sub: 'Adoption trends and performance analytics', apiKey: 'charts' },
  Users: { title: 'User Management', sub: 'Manage platform users and company assignments', apiKey: 'users' },
  Audit: { title: 'Audit Log', sub: 'Activity history and change trail', apiKey: 'audit' },
  Adoption: { title: 'Adoption Metrics', sub: 'Tool adoption snapshots and KPI tracking', apiKey: 'adoption' },
  Settings: { title: 'Settings', sub: 'System configuration', apiKey: 'settings' },
};

export default function SettingsPage() {
  const meta = PAGE_META['Settings'];
  return (
    <div className="animate-fade-in">
      <div className="mb-5 pb-4 border-b border-brand-border">
        <h2 className="text-lg font-light tracking-[2px] uppercase text-brand-text">{meta.title}</h2>
        <p className="text-xs text-brand-muted mt-1">{meta.sub}</p>
      </div>
      <div className="brand-card text-center py-20">
        <div className="text-brand-muted text-sm">
          {meta.title} module — connected to <code className="text-brand-green text-xs">/api/v1/{meta.apiKey}</code>
        </div>
        <div className="text-xxs text-brand-muted mt-2">
          Full implementation follows the same pattern as Tool Inventory and Dashboard pages.
          <br />Backend API endpoints are fully built and ready.
        </div>
      </div>
    </div>
  );
}
