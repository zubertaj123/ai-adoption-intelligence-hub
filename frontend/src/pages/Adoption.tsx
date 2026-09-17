import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adoptionApi, companiesApi } from '@/api/client';
import { useAuthStore, useUIStore } from '@/stores/authStore';
import { Plus } from 'lucide-react';

export default function AdoptionPage() {
  const { user } = useAuthStore();
  const { globalCompanyId } = useUIStore();
  const [companyFilter, setCompanyFilter] = useState(globalCompanyId || '');

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['adoption', companyFilter || globalCompanyId],
    queryFn: () => adoptionApi.list({ page_size: 200, company_id: companyFilter || globalCompanyId || undefined }).then(r => r.data),
  });

  const { data: companies } = useQuery({
    queryKey: ['companies-adopt'],
    queryFn: () => companiesApi.list({ page_size: 100 }).then(r => r.data.items),
    enabled: user?.role !== 'company_user',
  });

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-brand-border">
        <div>
          <h2 className="text-lg font-light tracking-[2px] uppercase text-brand-text">Adoption Metrics</h2>
          <p className="text-xs text-brand-muted mt-1">{snapshots?.total || snapshots?.items?.length || 0} adoption snapshots</p>
        </div>
      </div>

      {user?.role !== 'company_user' && companies && (
        <div className="mb-4">
          <select className="tb-select" value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}>
            <option value="">All Companies</option>
            {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div className="brand-card p-0 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border2">
              {['Tool', 'Function', 'Pool', 'Licensed', 'Enabled', 'Daily', '% Licensed', '% Enabled', '% Usage'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xxs font-semibold tracking-[1.5px] uppercase text-brand-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center py-10 text-brand-muted">Loading...</td></tr>
            ) : !snapshots?.items?.length ? (
              <tr><td colSpan={9} className="text-center py-10 text-brand-muted">No snapshots</td></tr>
            ) : snapshots.items.map((s: any) => (
              <tr key={s.id} className="border-b border-brand-border hover:bg-[rgba(255,255,255,0.015)]">
                <td className="px-3 py-2 text-sm font-medium">{s.tool_name}</td>
                <td className="px-3 py-2"><span className="badge badge-sm">{s.function_name}</span></td>
                <td className="px-3 py-2 text-xs">{s.employee_pool ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{s.licenses_bought ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{s.employees_enabled ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{s.avg_daily_users ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-brand-green font-medium">{s.pct_licensed != null ? `${s.pct_licensed}%` : '—'}</td>
                <td className="px-3 py-2 text-xs text-[#A55FFF]">{s.pct_enabled != null ? `${s.pct_enabled}%` : '—'}</td>
                <td className="px-3 py-2 text-xs text-tb-teal font-medium">{s.pct_daily_usage != null ? `${s.pct_daily_usage}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}