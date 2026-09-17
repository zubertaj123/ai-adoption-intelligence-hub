import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ttvApi, companiesApi, toolsApi } from '@/api/client';
import { useAuthStore, useUIStore } from '@/stores/authStore';
import { Plus, X, Pencil, Clock, CheckCircle, Circle } from 'lucide-react';
import { toast } from 'sonner';

const MILESTONES = [
  { key: 'pilot_start', label: 'Pilot Start', icon: '▶' },
  { key: 'pilot_end', label: 'Pilot End', icon: '■' },
  { key: 'security_approval', label: 'Security Approval', icon: '◉' },
  { key: 'deploy_date', label: 'Deployment', icon: '✓' },
  { key: 'first_benefit', label: 'First Benefit', icon: '◆' },
] as const;

const EMPTY_FORM = {
  tool_id: '',
  pilot_start: '', pilot_end: '', security_approval: '', deploy_date: '', first_benefit: '',
  notes: '',
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TTVPage() {
  const { user } = useAuthStore();
  const { globalCompanyId } = useUIStore();
  const queryClient = useQueryClient();
  const [companyFilter, setCompanyFilter] = useState(globalCompanyId || '');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: ttvList, isLoading } = useQuery({
    queryKey: ['ttv', companyFilter || globalCompanyId],
    queryFn: () => ttvApi.list({ company_id: companyFilter || globalCompanyId || undefined }).then(r => r.data),
  });

  const { data: companies } = useQuery({
    queryKey: ['companies-ttv'],
    queryFn: () => companiesApi.list({ page_size: 100 }).then(r => r.data.items),
    enabled: user?.role !== 'company_user',
  });

  const { data: tools } = useQuery({
    queryKey: ['tools-ttv', companyFilter || globalCompanyId],
    queryFn: () => toolsApi.list({
      page_size: 200,
      company_id: companyFilter || globalCompanyId || undefined,
    }).then(r => r.data.items),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => ttvApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ttv'] }); closeModal(); toast.success('Timeline created'); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => ttvApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ttv'] }); closeModal(); toast.success('Timeline updated'); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const canWrite = user?.role === 'tb_admin' || user?.role === 'company_user';

  const openAdd = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (t: any) => {
    setEditId(t.id);
    setForm({
      tool_id: t.tool_id,
      pilot_start: t.pilot_start || '',
      pilot_end: t.pilot_end || '',
      security_approval: t.security_approval || '',
      deploy_date: t.deploy_date || '',
      first_benefit: t.first_benefit || '',
      notes: t.notes || '',
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditId(null); setForm({ ...EMPTY_FORM }); };

  const handleSave = () => {
    const payload: any = {
      pilot_start: form.pilot_start || null,
      pilot_end: form.pilot_end || null,
      security_approval: form.security_approval || null,
      deploy_date: form.deploy_date || null,
      first_benefit: form.first_benefit || null,
      notes: form.notes || null,
    };

    if (editId) {
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      if (!form.tool_id) return toast.error('Please select a tool');
      createMutation.mutate({ ...payload, tool_id: form.tool_id });
    }
  };

  // Tools that already have TTV records (to filter out from add dropdown)
  const existingToolIds = new Set((ttvList || []).map((t: any) => t.tool_id));

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-brand-border">
        <div>
          <h2 className="text-lg font-light tracking-[2px] uppercase text-brand-text">Time to Value</h2>
          <p className="text-xs text-brand-muted mt-1">Deployment lifecycle from pilot start to first measurable benefit</p>
        </div>
        {canWrite && (
          <button className="tb-btn flex items-center gap-2" onClick={openAdd}>
            <Plus size={14} /> Add Timeline
          </button>
        )}
      </div>

      {/* Filters */}
      {user?.role !== 'company_user' && companies && (
        <div className="flex gap-2 mb-5">
          <select className="tb-select" value={companyFilter}
                  onChange={e => setCompanyFilter(e.target.value)}>
            <option value="">All Companies</option>
            {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {/* Timeline Cards */}
      {isLoading ? (
        <div className="text-brand-muted text-center py-20">Loading...</div>
      ) : !ttvList || ttvList.length === 0 ? (
        <div className="brand-card text-center py-16">
          <Clock size={32} className="text-brand-muted mx-auto mb-3" />
          <div className="text-sm text-brand-muted">No deployment timelines yet</div>
          <div className="text-xxs text-brand-muted mt-1">Click "Add Timeline" to track a tool's deployment lifecycle</div>
        </div>
      ) : (
        <div className="space-y-3">
          {ttvList.map((t: any) => {
            const completedCount = MILESTONES.filter(m => t[m.key]).length;
            const totalMilestones = MILESTONES.length;

            return (
              <div key={t.id} className="brand-card">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-sm font-medium">{t.tool_name}</div>
                    <div className="text-xs text-brand-green">{t.company_name}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xxs text-brand-muted">{completedCount}/{totalMilestones} milestones</span>
                    {canWrite && (
                      <button className="text-brand-muted hover:text-brand-green" onClick={() => openEdit(t)}>
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Milestone Timeline */}
                <div className="flex items-start">
                  {MILESTONES.map((m, i) => {
                    const isDone = !!t[m.key];
                    return (
                      <div key={m.key} className="flex-1 text-center relative">
                        {/* Connector line */}
                        {i > 0 && (
                          <div className="absolute top-3 left-0 right-1/2 h-px"
                               style={{ background: isDone ? 'rgba(0,214,123,0.4)' : 'var(--brand-border2)' }} />
                        )}
                        {i < MILESTONES.length - 1 && (
                          <div className="absolute top-3 left-1/2 right-0 h-px"
                               style={{ background: t[MILESTONES[i + 1]?.key] ? 'rgba(0,214,123,0.4)' : 'var(--brand-border2)' }} />
                        )}

                        {/* Dot */}
                        <div className={`w-7 h-7 rounded-full mx-auto mb-2 flex items-center justify-center text-xs relative z-10 ${
                          isDone
                            ? 'bg-[rgba(0,214,123,0.15)] border border-[rgba(0,214,123,0.4)] text-brand-green'
                            : 'bg-tb-surface2 border border-brand-border2 text-brand-muted'
                        }`}>
                          {m.icon}
                        </div>

                        {/* Label */}
                        <div className="text-xxs text-brand-muted leading-tight">{m.label}</div>
                        <div className={`text-xs font-semibold mt-0.5 ${isDone ? 'text-tb-dim' : 'text-brand-muted'}`}>
                          {fmtDate(t[m.key])}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Duration Metrics */}
                {(t.pilot_days != null || t.total_ttv_days != null) && (
                  <div className="flex gap-5 mt-4 pt-3 border-t border-brand-border flex-wrap">
                    {t.pilot_days != null && (
                      <div>
                        <span className="text-xxs text-brand-muted uppercase tracking-wider">Pilot: </span>
                        <strong className="text-brand-green">{t.pilot_days}d</strong>
                      </div>
                    )}
                    {t.approval_days != null && (
                      <div>
                        <span className="text-xxs text-brand-muted uppercase tracking-wider">Approval: </span>
                        <strong className="text-brand-green">{t.approval_days}d</strong>
                      </div>
                    )}
                    {t.deploy_lag_days != null && (
                      <div>
                        <span className="text-xxs text-brand-muted uppercase tracking-wider">Deploy Lag: </span>
                        <strong className="text-brand-green">{t.deploy_lag_days}d</strong>
                      </div>
                    )}
                    {t.benefit_days != null && (
                      <div>
                        <span className="text-xxs text-brand-muted uppercase tracking-wider">To Benefit: </span>
                        <strong className="text-brand-green">{t.benefit_days}d</strong>
                      </div>
                    )}
                    {t.total_ttv_days != null && (
                      <div>
                        <span className="text-xxs text-brand-muted uppercase tracking-wider">Total TTV: </span>
                        <strong className="text-[#A55FFF]">{t.total_ttv_days}d</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                {t.notes && (
                  <div className="text-xxs text-brand-muted mt-2 italic">{t.notes}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Add/Edit Modal ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={closeModal}>
          <div className="brand-card p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">{editId ? 'Edit Timeline' : 'Add Timeline'}</h3>
              <button className="text-brand-muted hover:text-tb-dim" onClick={closeModal}><X size={18} /></button>
            </div>

            {/* Tool Selector (add mode only) */}
            {!editId && (
              <div className="mb-4">
                <label className="section-label block mb-1">Tool *</label>
                <select className="tb-select w-full" value={form.tool_id}
                        onChange={e => setForm(f => ({ ...f, tool_id: e.target.value }))}>
                  <option value="">Select a tool...</option>
                  {tools?.filter((t: any) => !existingToolIds.has(t.id)).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name} — {t.portco_name}</option>
                  ))}
                </select>
                <div className="text-xxs text-brand-muted mt-1">Only tools without existing timelines are shown</div>
              </div>
            )}

            {/* Milestone Date Fields */}
            <div className="space-y-3">
              {MILESTONES.map(m => (
                <div key={m.key} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs bg-tb-surface2 border border-brand-border2 text-brand-muted flex-shrink-0">
                    {m.icon}
                  </div>
                  <div className="flex-1">
                    <label className="section-label block mb-1">{m.label}</label>
                    <input type="date" className="tb-input w-full"
                           value={(form as any)[m.key]}
                           onChange={e => setForm(f => ({ ...f, [m.key]: e.target.value }))} />
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="mt-3">
              <label className="section-label block mb-1">Notes</label>
              <textarea className="tb-input w-full" rows={2} placeholder="Optional notes..."
                        value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex gap-2 mt-5 justify-end border-t border-brand-border pt-4">
              <button className="tb-btn-outline" onClick={closeModal}>Cancel</button>
              <button className="tb-btn" onClick={handleSave}
                      disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Create Timeline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}