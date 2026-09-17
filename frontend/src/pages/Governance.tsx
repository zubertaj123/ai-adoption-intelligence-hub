import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { governanceApi, companiesApi } from '@/api/client';
import { useAuthStore, useUIStore } from '@/stores/authStore';
import { Plus, Search, Mail } from 'lucide-react';
import { toast } from 'sonner';
import type { GovernanceContact } from '@/lib/types';

export default function GovernancePage() {
  const { user } = useAuthStore();
  const { globalCompanyId } = useUIStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState(globalCompanyId || '');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ company_id: '', name: '', title: '', role: '', email: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['governance', search, companyFilter || globalCompanyId],
    queryFn: () => governanceApi.list({
      page_size: 200, search: search || undefined,
      company_id: companyFilter || globalCompanyId || undefined,
    }).then(r => r.data),
  });

  const { data: companies } = useQuery({
    queryKey: ['companies-gov'], queryFn: () => companiesApi.list({ page_size: 100 }).then(r => r.data.items),
    enabled: user?.role !== 'company_user',
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => governanceApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['governance'] }); setShowAdd(false); toast.success('Contact added'); },
  });

  const canWrite = user?.role === 'tb_admin' || user?.role === 'company_user';
  const ICONS: Record<string, string> = { 'Head of AI': '★', CEO: '★', CTO: '⚙', 'Sales Ops': '◈' };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-brand-border">
        <div>
          <h2 className="text-lg font-light tracking-[2px] uppercase text-brand-text">Governance Council</h2>
          <p className="text-xs text-brand-muted mt-1">{data?.total || 0} contacts</p>
        </div>
        {canWrite && <button className="tb-btn flex items-center gap-2" onClick={() => setShowAdd(!showAdd)}><Plus size={14} /> Add Member</button>}
      </div>

      {showAdd && (
        <div className="brand-card mb-4 animate-slide-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {user?.role === 'tb_admin' && companies && (
              <select className="tb-select" value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}>
                <option value="">Select Company *</option>
                {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <input className="tb-input" placeholder="Full Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input className="tb-input" placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <input className="tb-input" placeholder="Role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
            <input className="tb-input" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <button className="tb-btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="tb-btn" onClick={() => { const cid = form.company_id || user?.company_ids[0]; if (!cid || !form.name) return toast.error('Required'); createMutation.mutate({ ...form, company_id: cid }); }}>Add</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
          <input className="tb-input w-full pl-8" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {user?.role !== 'company_user' && companies && (
          <select className="tb-select" value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}>
            <option value="">All PortCos</option>
            {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {isLoading ? <div className="text-brand-muted text-center py-20">Loading...</div>
      : !data?.items.length ? <div className="text-brand-muted text-center py-20">No members found.</div>
      : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {data.items.map((c: GovernanceContact) => (
            <div key={c.id} className="brand-card relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-0.5 ${c.role?.includes('Head') || c.role?.includes('CEO') ? 'bg-gradient-to-r from-brand-green to-brand-purple' : 'bg-brand-border2'}`} />
              <div className="text-xxs font-bold tracking-[1.5px] uppercase text-brand-muted mb-2.5">
                {ICONS[c.role || ''] || '◆'} {c.role || 'Contact'} · {c.company_name}
              </div>
              <div className="text-sm text-brand-text">{c.name}</div>
              <div className="text-xs text-brand-muted mt-1 mb-2">{c.title || '—'}</div>
              {c.email && <a href={`mailto:${c.email}`} className="text-xxs text-tb-teal hover:text-brand-green flex items-center gap-1"><Mail size={10} /> {c.email}</a>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
