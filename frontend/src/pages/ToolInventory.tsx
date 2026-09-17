import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toolsApi, companiesApi, dashboardApi } from '@/api/client';
import { useAuthStore, useUIStore } from '@/stores/authStore';
import { STAGE_LABELS, STAGE_CLASSES, COMPLEXITY_CLASSES, PRODUCTS } from '@/lib/types';
import type { Tool, PaginatedResponse } from '@/lib/types';
import { Plus, Search, X, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const PRICING_OPTIONS = ['Per Seat', 'Per API Token', 'Usage', 'Enterprise License', 'Outcome-Based', 'Other'];
const COMPLEXITY_OPTIONS = ['Low', 'Medium', 'High'];
const FAIL_REASONS = ['Security blocked', 'Data integration issue', 'No measurable productivity gain', 'Low adoption', 'Too expensive', 'UX friction', 'Other'];

const EMPTY_FORM = {
  company_id: '', name: '', vendor: '', product: '', use_case: '',
  biz_owner_name: '', biz_owner_role: '', tech_owner_name: '', tech_owner_role: '',
  project_spend: '', annual_spend: '', pricing_model: '', token_limit: '',
  deployment_stage: 0, fail_reason: '', complexity: '', function_ids: [] as string[],
};

export default function ToolInventory() {
  const { user } = useAuthStore();
  const { globalCompanyId } = useUIStore();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [portcoFilter, setPortcoFilter] = useState<string>(globalCompanyId || '');
  const [productFilter, setProductFilter] = useState<string>('');
  const [fnFilter, setFnFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editTool, setEditTool] = useState<Tool | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data, isLoading } = useQuery<PaginatedResponse<Tool>>({
    queryKey: ['tools', page, search, stageFilter, portcoFilter || globalCompanyId, productFilter, fnFilter],
    queryFn: () => toolsApi.list({
      page, page_size: 30, search: search || undefined,
      stage: stageFilter !== '' ? parseInt(stageFilter) : undefined,
      company_id: portcoFilter || globalCompanyId || undefined,
      product: productFilter || undefined,
      function_id: fnFilter || undefined,
    }).then(r => r.data),
  });

  const { data: companies } = useQuery({
    queryKey: ['companies-list'],
    queryFn: () => companiesApi.list({ page_size: 100 }).then(r => r.data.items),
    enabled: user?.role !== 'company_user',
  });

  const { data: functions } = useQuery({
    queryKey: ['functions'],
    queryFn: () => dashboardApi.functions().then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => toolsApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tools'] }); closeModal(); toast.success('Tool created'); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to create tool'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => toolsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tools'] }); closeModal(); toast.success('Tool updated'); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to update tool'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => toolsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tools'] }); toast.success('Tool removed'); },
  });

  const canWrite = user?.role === 'tb_admin' || user?.role === 'company_user';

  const openAdd = () => {
    setEditTool(null);
    setForm({ ...EMPTY_FORM, company_id: user?.role === 'company_user' ? user.company_ids[0] || '' : '' });
    setShowModal(true);
  };

  const openEdit = (t: Tool) => {
    setEditTool(t);
    setForm({
      company_id: t.company_id, name: t.name, vendor: t.vendor || '', product: t.product || '',
      use_case: t.use_case || '', biz_owner_name: t.biz_owner_name || '', biz_owner_role: t.biz_owner_role || '',
      tech_owner_name: t.tech_owner_name || '', tech_owner_role: t.tech_owner_role || '',
      project_spend: t.project_spend ? String(t.project_spend) : '', annual_spend: t.annual_spend ? String(t.annual_spend) : '',
      pricing_model: t.pricing_model || '', token_limit: t.token_limit || '',
      deployment_stage: t.deployment_stage, fail_reason: t.fail_reason || '',
      complexity: t.complexity || '', function_ids: [],
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditTool(null); setForm({ ...EMPTY_FORM }); };

  const handleSave = () => {
    if (!form.name.trim()) return toast.error('Tool name is required');
    if (!editTool && !form.company_id) return toast.error('Company is required');

    const payload: any = {
      name: form.name, vendor: form.vendor || undefined, product: form.product || undefined,
      use_case: form.use_case || undefined, biz_owner_name: form.biz_owner_name || undefined,
      biz_owner_role: form.biz_owner_role || undefined, tech_owner_name: form.tech_owner_name || undefined,
      tech_owner_role: form.tech_owner_role || undefined,
      project_spend: form.project_spend ? parseFloat(form.project_spend) : undefined,
      annual_spend: form.annual_spend ? parseFloat(form.annual_spend) : undefined,
      pricing_model: form.pricing_model || undefined, token_limit: form.token_limit || undefined,
      deployment_stage: form.deployment_stage, fail_reason: form.deployment_stage === 4 ? form.fail_reason : undefined,
      complexity: form.complexity || undefined, function_ids: form.function_ids,
    };

    if (editTool) {
      updateMutation.mutate({ id: editTool.id, data: payload });
    } else {
      createMutation.mutate({ ...payload, company_id: form.company_id });
    }
  };

  const FN_BADGE: Record<string, string> = {
    'R&D': 'badge-rd', 'Support': 'badge-sup', 'Customer Support': 'badge-sup',
    'S&M': 'badge-sm', 'Sales': 'badge-sm', 'Marketing': 'badge-sm',
    'G&A': 'badge-ga', 'Finance & Legal': 'badge-ga', 'People & Culture (HR)': 'badge-ga',
    'Professional Services': 'badge-sup', 'IT': 'badge-rd',
    'Customer Success & Renewals': 'badge-sup',
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-brand-border">
        <div>
          <h2 className="text-lg font-light tracking-[2px] uppercase text-brand-text">Tool Inventory</h2>
          <p className="text-xs text-brand-muted mt-1">{data?.total || 0} tools across portfolio</p>
        </div>
        {canWrite && (
          <button className="tb-btn flex items-center gap-2" onClick={openAdd}>
            <Plus size={14} /> Add Tool
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
          <input className="tb-input w-full pl-8" placeholder="Search tools..." value={search}
                 onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {user?.role !== 'company_user' && companies && (
          <select className="tb-select" value={portcoFilter}
                  onChange={(e) => { setPortcoFilter(e.target.value); setPage(1); }}>
            <option value="">All Companies</option>
            {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select className="tb-select" value={productFilter}
                onChange={(e) => { setProductFilter(e.target.value); setPage(1); }}>
          <option value="">All Products</option>
          {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {functions && (
          <select className="tb-select" value={fnFilter}
                  onChange={(e) => { setFnFilter(e.target.value); setPage(1); }}>
            <option value="">All Functions</option>
            {functions.map((f: any) => <option key={f.id} value={f.id}>{f.display_name}</option>)}
          </select>
        )}
        <select className="tb-select" value={stageFilter}
                onChange={(e) => { setStageFilter(e.target.value); setPage(1); }}>
          <option value="">All Stages</option>
          {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto brand-card p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border2">
              {['Tool', 'PortCo', 'Product', 'Function', 'Use Case', 'Biz Owner', 'Tech Owner',
                'Annual Cost', 'Pricing', 'Complexity', 'Stage'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xxs font-semibold tracking-[1.5px] uppercase text-brand-muted whitespace-nowrap">{h}</th>
              ))}
              {canWrite && <th className="px-3 py-2.5"></th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={12} className="text-center py-10 text-brand-muted">Loading...</td></tr>
            ) : !data?.items.length ? (
              <tr><td colSpan={12} className="text-center py-10 text-brand-muted">No tools found.</td></tr>
            ) : data.items.map((t) => (
              <tr key={t.id} className="border-b border-brand-border hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="px-3 py-2.5"><strong className="text-brand-text text-sm">{t.name}</strong></td>
                <td className="px-3 py-2.5 text-brand-green text-sm">{t.portco_name}</td>
                <td className="px-3 py-2.5 text-sm text-tb-dim">{t.product || '—'}</td>
                <td className="px-3 py-2.5">
                  {t.function_names.map(fn => (
                    <span key={fn} className={`badge ${FN_BADGE[fn] || 'badge-sm'} mr-1`}>{fn}</span>
                  ))}
                </td>
                <td className="px-3 py-2.5 text-brand-muted text-xs max-w-[150px] truncate">{t.use_case || '—'}</td>
                <td className="px-3 py-2.5 text-xs text-tb-dim">{t.biz_owner_name || '—'}</td>
                <td className="px-3 py-2.5 text-xs text-tb-dim">{t.tech_owner_name || '—'}</td>
                <td className="px-3 py-2.5 text-sm">{t.annual_spend ? `$${(t.annual_spend / 1000).toFixed(0)}K` : '—'}</td>
                <td className="px-3 py-2.5 text-xs text-brand-muted">{t.pricing_model || '—'}</td>
                <td className="px-3 py-2.5">
                  <span className={COMPLEXITY_CLASSES[t.complexity || ''] || 'text-brand-muted'}>{t.complexity || '—'}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`badge ${STAGE_CLASSES[t.deployment_stage]}`}>{STAGE_LABELS[t.deployment_stage]}</span>
                  {t.deployment_stage === 4 && t.fail_reason && (
                    <div className="text-xxs text-[#FF6060] mt-1">↳ {t.fail_reason}</div>
                  )}
                </td>
                {canWrite && (
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <button className="text-brand-muted hover:text-brand-green px-1" onClick={() => openEdit(t)}><Pencil size={13} /></button>
                      <button className="text-brand-muted hover:text-[#FF6060] px-1"
                              onClick={() => { if (confirm('Remove this tool?')) deleteMutation.mutate(t.id); }}>
                        <X size={13} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <span className="text-xxs text-brand-muted">Page {page} of {data.total_pages}</span>
          <div className="flex gap-2">
            <button className="tb-btn-outline text-xxs px-3 py-1" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="tb-btn-outline text-xxs px-3 py-1" disabled={page === data.total_pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}

      {/* ─── Add/Edit Modal ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={closeModal}>
          <div className="brand-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">{editTool ? 'Edit Tool' : 'Add Tool'}</h3>
              <button className="text-brand-muted hover:text-tb-dim" onClick={closeModal}><X size={18} /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Company (only for add, admin only) */}
              {!editTool && user?.role === 'tb_admin' && companies && (
                <div className="md:col-span-2">
                  <label className="section-label block mb-1">Company *</label>
                  <select className="tb-select w-full" value={form.company_id}
                          onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}>
                    <option value="">Select company...</option>
                    {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="section-label block mb-1">Tool Name *</label>
                <input className="tb-input w-full" placeholder="e.g., GitHub Copilot" value={form.name}
                       onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="section-label block mb-1">Vendor</label>
                <input className="tb-input w-full" placeholder="e.g., GitHub" value={form.vendor}
                       onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} />
              </div>
              <div>
                <label className="section-label block mb-1">Product</label>
                <input className="tb-input w-full" placeholder="e.g., Copilot Enterprise" value={form.product}
                      onChange={e => setForm(f => ({ ...f, product: e.target.value }))} />
              </div>
              <div>
                <label className="section-label block mb-1">Complexity</label>
                <select className="tb-select w-full" value={form.complexity}
                        onChange={e => setForm(f => ({ ...f, complexity: e.target.value }))}>
                  <option value="">Select...</option>
                  {COMPLEXITY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="section-label block mb-1">Use Case</label>
                <textarea className="tb-input w-full" rows={2} placeholder="Describe the primary use case..."
                          value={form.use_case} onChange={e => setForm(f => ({ ...f, use_case: e.target.value }))} />
              </div>

              <div>
                <label className="section-label block mb-1">Business Owner</label>
                <input className="tb-input w-full" placeholder="Name" value={form.biz_owner_name}
                       onChange={e => setForm(f => ({ ...f, biz_owner_name: e.target.value }))} />
              </div>
              <div>
                <label className="section-label block mb-1">Biz Owner Role</label>
                <input className="tb-input w-full" placeholder="e.g., VP Engineering" value={form.biz_owner_role}
                       onChange={e => setForm(f => ({ ...f, biz_owner_role: e.target.value }))} />
              </div>
              <div>
                <label className="section-label block mb-1">Tech Owner</label>
                <input className="tb-input w-full" placeholder="Name" value={form.tech_owner_name}
                       onChange={e => setForm(f => ({ ...f, tech_owner_name: e.target.value }))} />
              </div>
              <div>
                <label className="section-label block mb-1">Tech Owner Role</label>
                <input className="tb-input w-full" placeholder="e.g., DevOps Lead" value={form.tech_owner_role}
                       onChange={e => setForm(f => ({ ...f, tech_owner_role: e.target.value }))} />
              </div>

              <div>
                <label className="section-label block mb-1">Project Spend ($000s)</label>
                <input className="tb-input w-full" type="number" placeholder="150" value={form.project_spend}
                       onChange={e => setForm(f => ({ ...f, project_spend: e.target.value }))} />
              </div>
              <div>
                <label className="section-label block mb-1">Annual Spend ($000s)</label>
                <input className="tb-input w-full" type="number" placeholder="200" value={form.annual_spend}
                       onChange={e => setForm(f => ({ ...f, annual_spend: e.target.value }))} />
              </div>
              <div>
                <label className="section-label block mb-1">Pricing Model</label>
                <select className="tb-select w-full" value={form.pricing_model}
                        onChange={e => setForm(f => ({ ...f, pricing_model: e.target.value }))}>
                  <option value="">Select...</option>
                  {PRICING_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="section-label block mb-1">Token Limit</label>
                <input className="tb-input w-full" placeholder="e.g., N/A" value={form.token_limit}
                       onChange={e => setForm(f => ({ ...f, token_limit: e.target.value }))} />
              </div>

              <div>
                <label className="section-label block mb-1">Deployment Stage</label>
                <select className="tb-select w-full" value={form.deployment_stage}
                        onChange={e => setForm(f => ({ ...f, deployment_stage: parseInt(e.target.value) }))}>
                  {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {form.deployment_stage === 4 && (
                <div>
                  <label className="section-label block mb-1">Fail Reason</label>
                  <select className="tb-select w-full" value={form.fail_reason}
                          onChange={e => setForm(f => ({ ...f, fail_reason: e.target.value }))}>
                    <option value="">Select reason...</option>
                    {FAIL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              {/* Function assignment */}
              {functions && functions.length > 0 && (
                <div className="md:col-span-2">
                  <label className="section-label block mb-1">Functions</label>
                  <div className="flex flex-wrap gap-2">
                    {functions.map((fn: any) => (
                      <label key={fn.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border cursor-pointer text-xxs transition-colors ${
                        form.function_ids.includes(fn.id)
                          ? 'border-brand-green bg-[rgba(0,214,123,0.1)] text-brand-green'
                          : 'border-brand-border2 text-brand-muted hover:border-tb-dim'
                      }`}>
                        <input type="checkbox" className="hidden" checked={form.function_ids.includes(fn.id)}
                               onChange={() => setForm(f => ({
                                 ...f, function_ids: f.function_ids.includes(fn.id)
                                   ? f.function_ids.filter(id => id !== fn.id)
                                   : [...f.function_ids, fn.id]
                               }))} />
                        {fn.display_name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-5 justify-end border-t border-brand-border pt-4">
              <button className="tb-btn-outline" onClick={closeModal}>Cancel</button>
              <button className="tb-btn" onClick={handleSave}
                      disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editTool ? 'Update Tool' : 'Add Tool'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}