import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companiesApi } from '@/api/client';
import type { Company } from '@/lib/types';
import { Plus, Search, Building2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CompaniesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', sector: '', description: '', website: '', employee_count: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['companies', search],
    queryFn: () => companiesApi.list({ page_size: 100, search: search || undefined }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => companiesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setShowAdd(false);
      setForm({ name: '', sector: '', description: '', website: '', employee_count: '' });
      toast.success('Company created');
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Company deactivated');
    },
  });

  const handleCreate = () => {
    if (!form.name.trim()) return toast.error('Company name is required');
    createMutation.mutate({
      ...form,
      employee_count: form.employee_count ? parseInt(form.employee_count) : undefined,
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-brand-border">
        <div>
          <h2 className="text-lg font-light tracking-[2px] uppercase text-brand-text">Portfolio Companies</h2>
          <p className="text-xs text-brand-muted mt-1">{data?.total || 0} portfolio companies</p>
        </div>
        <button className="tb-btn flex items-center gap-2" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={14} /> Add Company
        </button>
      </div>

      {/* Add Company Form */}
      {showAdd && (
        <div className="brand-card mb-4 animate-slide-in">
          <div className="section-label mb-3">New Portfolio Company</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="tb-input" placeholder="Company Name *" value={form.name}
                   onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            <select className="tb-select" value={form.sector}
                    onChange={(e) => setForm(f => ({ ...f, sector: e.target.value }))}>
              <option value="">Select Sector...</option>
              <option value="Applications">Applications</option>
              <option value="Cybersecurity">Cybersecurity</option>
              <option value="Infrastructure">Infrastructure</option>
            </select>
            <input className="tb-input" placeholder="Website" value={form.website}
                   onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))} />
            <input className="tb-input" placeholder="Employee Count" type="number" value={form.employee_count}
                   onChange={(e) => setForm(f => ({ ...f, employee_count: e.target.value }))} />
            <textarea className="tb-input md:col-span-2" placeholder="Description" rows={2} value={form.description}
                      onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <button className="tb-btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="tb-btn" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
        <input className="tb-input w-full pl-8" placeholder="Search companies..." value={search}
               onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="text-brand-muted text-center py-20">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {data?.items.map((c: Company) => (
            <div key={c.id} className="brand-card hover:border-brand-border2 transition-colors group relative">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-green to-brand-purple rounded-t-md" />
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded bg-[rgba(0,214,123,0.12)] flex items-center justify-center flex-shrink-0">
                  <Building2 size={18} className="text-brand-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{c.name}</div>
                  {c.sector && <div className="text-xs text-tb-dim mt-0.5">{c.sector}</div>}
                </div>
                <button onClick={() => { if (confirm(`Deactivate ${c.name}?`)) deleteMutation.mutate(c.id); }}
                        className="opacity-0 group-hover:opacity-100 text-brand-muted hover:text-brand-red transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mt-3 pt-3 border-t border-brand-border flex gap-4">
                <div>
                  <div className="text-lg font-light text-brand-green">{c.tools_count}</div>
                  <div className="text-xs text-brand-muted">Tools</div>
                </div>
                <div>
                  <div className="text-lg font-light text-[#A55FFF]">
                    {c.total_spend ? `$${(c.total_spend / 1000).toFixed(0)}K` : '—'}
                  </div>
                  <div className="text-xs text-brand-muted">Annual Spend</div>
                </div>
              </div>
              {c.initial_load_at && (
                <div className="text-xs text-brand-muted mt-2">
                  Data loaded: {new Date(c.initial_load_at).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}