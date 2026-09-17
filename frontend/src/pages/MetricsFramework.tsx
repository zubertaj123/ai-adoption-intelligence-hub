import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adoptionApi, companiesApi, dashboardApi } from '@/api/client';
import { useAuthStore, useUIStore } from '@/stores/authStore';
import { Pencil, X } from 'lucide-react';
import { toast } from 'sonner';

const KPI_TYPES = ['All', 'Adoption', 'Velocity', 'Quality', 'ROI', 'SDLC'] as const;

const KPI_TYPE_BADGES: Record<string, string> = {
  Adoption: 'bg-[rgba(0,214,123,0.12)] text-brand-green border border-[rgba(0,214,123,0.3)]',
  Velocity: 'bg-[rgba(89,0,208,0.15)] text-[#A55FFF] border border-[rgba(89,0,208,0.3)]',
  Quality: 'bg-[rgba(240,165,0,0.12)] text-brand-amber border border-[rgba(240,165,0,0.3)]',
  ROI: 'bg-[rgba(224,48,96,0.12)] text-brand-red border border-[rgba(224,48,96,0.3)]',
  SDLC: 'bg-[rgba(0,168,98,0.12)] text-tb-teal border border-[rgba(0,168,98,0.25)]',
};

interface MetricRow {
  id: string;
  snapshot_id: string;
  tool_id: string;
  tool_name: string;
  function_id: string;
  company_id: string;
  portco_name: string;
  function_name: string;
  kpi_type: string;
  specific_kpi: string;
  baseline: number;
  current: number;
  target: number;
  progress: number;
  unit: string;
  // Raw adoption values for editing
  employee_pool: number | null;
  licenses_bought: number | null;
  employees_enabled: number | null;
  avg_daily_users: number | null;
}

export default function MetricsFramework() {
  const { user } = useAuthStore();
  const { globalCompanyId } = useUIStore();
  const queryClient = useQueryClient();
  const [companyFilter, setCompanyFilter] = useState(globalCompanyId || '');
  const [kpiTypeFilter, setKpiTypeFilter] = useState('All');
  const [fnFilter, setFnFilter] = useState('');
  const [editRow, setEditRow] = useState<MetricRow | null>(null);
  const [editForm, setEditForm] = useState({ employee_pool: '', licenses_bought: '', employees_enabled: '', avg_daily_users: '' });

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['metrics-snapshots', companyFilter || globalCompanyId],
    queryFn: () => adoptionApi.list({
      page_size: 500,
      company_id: companyFilter || globalCompanyId || undefined,
    }).then(r => r.data),
  });

  const { data: companies } = useQuery({
    queryKey: ['companies-metrics'],
    queryFn: () => companiesApi.list({ page_size: 100 }).then(r => r.data.items),
    enabled: user?.role !== 'company_user',
  });

  const { data: functions } = useQuery({
    queryKey: ['functions-metrics'],
    queryFn: () => dashboardApi.functions().then(r => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => adoptionApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics-snapshots'] });
      setEditRow(null);
      toast.success('Adoption metrics updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to update'),
  });

  const canWrite = user?.role === 'tb_admin' || user?.role === 'company_user';

  // Transform adoption snapshots into Metrics Framework rows
  const metrics: MetricRow[] = [];
  if (snapshots?.items) {
    snapshots.items.forEach((s: any) => {
      const base = {
        snapshot_id: s.id,
        tool_id: s.tool_id,
        tool_name: s.tool_name || 'Unknown',
        function_id: s.function_id,
        company_id: s.company_id,
        portco_name: s.company_name || '—',
        function_name: s.function_name || '—',
        kpi_type: 'Adoption',
        unit: '%',
        employee_pool: s.employee_pool,
        licenses_bought: s.licenses_bought,
        employees_enabled: s.employees_enabled,
        avg_daily_users: s.avg_daily_users,
      };

      if (s.pct_licensed != null) {
        const current = Number(s.pct_licensed);
        const target = 100;
        metrics.push({ ...base, id: s.id + '-lic', specific_kpi: '% Licensed', baseline: 0, current, target,
          progress: Math.min(100, Math.round((current / target) * 100)) });
      }
      if (s.pct_enabled != null) {
        const current = Number(s.pct_enabled);
        const target = 100;
        metrics.push({ ...base, id: s.id + '-ena', specific_kpi: '% Enabled', baseline: 0, current, target,
          progress: Math.min(100, Math.round((current / target) * 100)) });
      }
      if (s.pct_daily_usage != null) {
        const current = Number(s.pct_daily_usage);
        const target = 100;
        metrics.push({ ...base, id: s.id + '-use', specific_kpi: '% Daily Usage', baseline: 0, current, target,
          progress: Math.min(100, Math.round((current / target) * 100)) });
      }
    });
  }

  // Apply filters
  const filtered = metrics.filter(m => {
    if (kpiTypeFilter !== 'All' && m.kpi_type !== kpiTypeFilter) return false;
    if (fnFilter && m.function_name !== fnFilter) return false;
    return true;
  });

  // Deduplicate: only show one row per snapshot (first KPI), but keep all for display
  // Actually, show all 3 KPIs per snapshot
  const avgProgress = filtered.length > 0
    ? Math.round(filtered.reduce((sum, m) => sum + m.progress, 0) / filtered.length)
    : 0;

  const openEdit = (m: MetricRow) => {
    setEditRow(m);
    setEditForm({
      employee_pool: m.employee_pool != null ? String(m.employee_pool) : '',
      licenses_bought: m.licenses_bought != null ? String(m.licenses_bought) : '',
      employees_enabled: m.employees_enabled != null ? String(m.employees_enabled) : '',
      avg_daily_users: m.avg_daily_users != null ? String(m.avg_daily_users) : '',
    });
  };

  const handleUpdate = () => {
    if (!editRow) return;
    const today = new Date().toISOString().split('T')[0];
    updateMutation.mutate({
      tool_id: editRow.tool_id,
      function_id: editRow.function_id,
      as_of_date: today,
      employee_pool: editForm.employee_pool ? parseInt(editForm.employee_pool) : null,
      licenses_bought: editForm.licenses_bought ? parseInt(editForm.licenses_bought) : null,
      employees_enabled: editForm.employees_enabled ? parseInt(editForm.employees_enabled) : null,
      avg_daily_users: editForm.avg_daily_users ? parseInt(editForm.avg_daily_users) : null,
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-brand-border">
        <div>
          <h2 className="text-lg font-light tracking-[2px] uppercase text-brand-text">Metrics Framework</h2>
          <p className="text-xs text-brand-muted mt-1">KPI tracking with historical time-series — baseline, current, target</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-light text-brand-green">{avgProgress}%</div>
          <div className="text-xxs text-brand-muted">Avg Progress</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {user?.role !== 'company_user' && companies && (
          <select className="tb-select" value={companyFilter}
                  onChange={e => setCompanyFilter(e.target.value)}>
            <option value="">All Companies</option>
            {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select className="tb-select" value={kpiTypeFilter}
                onChange={e => setKpiTypeFilter(e.target.value)}>
          {KPI_TYPES.map(t => <option key={t} value={t}>{t === 'All' ? 'All KPI Types' : t}</option>)}
        </select>
        {functions && (
          <select className="tb-select" value={fnFilter}
                  onChange={e => setFnFilter(e.target.value)}>
            <option value="">All Functions</option>
            {functions.map((f: any) => <option key={f.id} value={f.display_name}>{f.display_name}</option>)}
          </select>
        )}
        <div className="ml-auto text-xxs text-brand-muted">{filtered.length} KPIs</div>
      </div>

      {/* Table */}
      <div className="brand-card p-0 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border2">
              {['Tool', 'PortCo', 'Fn', 'KPI Type', 'Specific KPI', 'Baseline', 'Current', 'Target', 'Progress'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xxs font-semibold tracking-[1.5px] uppercase text-brand-muted whitespace-nowrap">{h}</th>
              ))}
              {canWrite && <th className="px-3 py-2.5"></th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} className="text-center py-10 text-brand-muted">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-10 text-brand-muted">
                  {kpiTypeFilter !== 'All' && kpiTypeFilter !== 'Adoption'
                    ? `No ${kpiTypeFilter} KPIs configured yet. This data will come from future Metrics Framework inputs.`
                    : 'No metrics data. Upload company templates to populate.'}
                </td>
              </tr>
            ) : filtered.map(m => (
              <tr key={m.id} className="border-b border-brand-border hover:bg-[rgba(255,255,255,0.015)]">
                <td className="px-3 py-2.5 text-sm font-medium">{m.tool_name}</td>
                <td className="px-3 py-2.5 text-sm text-brand-green">{m.portco_name}</td>
                <td className="px-3 py-2.5"><span className="badge badge-sm">{m.function_name}</span></td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block px-2 py-0.5 rounded text-xxs font-bold uppercase tracking-wider ${KPI_TYPE_BADGES[m.kpi_type] || ''}`}>
                    {m.kpi_type}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-sm text-tb-dim">{m.specific_kpi}</td>
                <td className="px-3 py-2.5 text-xs text-brand-muted">{m.baseline}{m.unit}</td>
                <td className="px-3 py-2.5 text-sm text-brand-green font-medium">{m.current}{m.unit}</td>
                <td className="px-3 py-2.5 text-sm text-[#A55FFF]">{m.target}{m.unit}</td>
                <td className="px-3 py-2.5 w-40">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 progress-track">
                      <div className="progress-fill" style={{ width: `${m.progress}%` }} />
                    </div>
                    <span className="text-xxs text-brand-muted w-8 text-right">{m.progress}%</span>
                  </div>
                </td>
                {canWrite && (
                  <td className="px-3 py-2.5">
                    <button className="text-brand-muted hover:text-brand-green" onClick={() => openEdit(m)}>
                      <Pencil size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Edit Modal ─── */}
      {editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setEditRow(null)}>
          <div className="brand-card p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Update Adoption Metrics</h3>
              <button className="text-brand-muted hover:text-tb-dim" onClick={() => setEditRow(null)}><X size={18} /></button>
            </div>

            <div className="mb-4 p-3 rounded bg-tb-surface2 border border-brand-border">
              <div className="text-sm text-brand-green font-medium">{editRow.tool_name}</div>
              <div className="text-xxs text-brand-muted mt-1">{editRow.portco_name} · {editRow.function_name}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="section-label block mb-1">Employee Pool</label>
                <input className="tb-input w-full" type="number" value={editForm.employee_pool}
                       onChange={e => setEditForm(f => ({ ...f, employee_pool: e.target.value }))} />
              </div>
              <div>
                <label className="section-label block mb-1">Licenses Bought</label>
                <input className="tb-input w-full" type="number" value={editForm.licenses_bought}
                       onChange={e => setEditForm(f => ({ ...f, licenses_bought: e.target.value }))} />
              </div>
              <div>
                <label className="section-label block mb-1">Employees Enabled</label>
                <input className="tb-input w-full" type="number" value={editForm.employees_enabled}
                       onChange={e => setEditForm(f => ({ ...f, employees_enabled: e.target.value }))} />
              </div>
              <div>
                <label className="section-label block mb-1">Avg Daily Users</label>
                <input className="tb-input w-full" type="number" value={editForm.avg_daily_users}
                       onChange={e => setEditForm(f => ({ ...f, avg_daily_users: e.target.value }))} />
              </div>
            </div>

            <div className="text-xxs text-brand-muted mt-3">
              This creates a new adoption snapshot as of today. Previous data is preserved for trend tracking.
            </div>

            <div className="flex gap-2 mt-4 justify-end border-t border-brand-border pt-4">
              <button className="tb-btn-outline" onClick={() => setEditRow(null)}>Cancel</button>
              <button className="tb-btn" onClick={handleUpdate} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Update Metrics'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}