import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, companiesApi } from '@/api/client';
import { Plus, Search, Shield, Eye, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const ROLE_BADGES: Record<string, { class: string; icon: any }> = {
  tb_admin: { class: 'bg-[rgba(0,214,123,0.12)] text-brand-green border border-[rgba(0,214,123,0.3)]', icon: Shield },
  tb_user: { class: 'bg-[rgba(89,0,208,0.15)] text-[#A55FFF] border border-[rgba(89,0,208,0.3)]', icon: Eye },
  company_user: { class: 'bg-[rgba(0,168,98,0.12)] text-tb-teal border border-[rgba(0,168,98,0.25)]', icon: Building2 },
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', role: 'company_user', company_ids: [] as string[] });

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, roleFilter],
    queryFn: () => usersApi.list({ page_size: 100, search: search || undefined, role: roleFilter || undefined }).then(r => r.data),
  });

  const { data: companies } = useQuery({
    queryKey: ['companies-users'], queryFn: () => companiesApi.list({ page_size: 100 }).then(r => r.data.items),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => usersApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setShowAdd(false); toast.success('User created'); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-brand-border">
        <div>
          <h2 className="text-lg font-light tracking-[2px] uppercase text-brand-text">User Management</h2>
          <p className="text-xs text-brand-muted mt-1">{data?.total || 0} users</p>
        </div>
        <button className="tb-btn flex items-center gap-2" onClick={() => setShowAdd(!showAdd)}><Plus size={14} /> Add User</button>
      </div>

      {showAdd && (
        <div className="brand-card mb-4 animate-slide-in">
          <div className="section-label mb-3">New User</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="tb-input" placeholder="Email *" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <input className="tb-input" type="password" placeholder="Password *" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <input className="tb-input" placeholder="First Name *" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
            <input className="tb-input" placeholder="Last Name *" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
            <select className="tb-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="company_user">Company User</option>
              <option value="tb_user">TB User (Read-Only)</option>
              <option value="tb_admin">TB Admin</option>
            </select>
            {form.role === 'company_user' && companies && (
              <select className="tb-select" value={form.company_ids[0] || ''} onChange={e => setForm(f => ({ ...f, company_ids: e.target.value ? [e.target.value] : [] }))}>
                <option value="">Assign Company *</option>
                {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <button className="tb-btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="tb-btn" onClick={() => createMutation.mutate(form)}>Create User</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
          <input className="tb-input w-full pl-8" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="tb-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          <option value="tb_admin">TB Admin</option>
          <option value="tb_user">TB User</option>
          <option value="company_user">Company User</option>
        </select>
      </div>

      <div className="brand-card p-0 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border2">
              {['User', 'Email', 'Role', 'Companies', 'Last Login', 'Status'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xxs font-semibold tracking-[1.5px] uppercase text-brand-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="text-center py-10 text-brand-muted">Loading...</td></tr>
            : !data?.items.length ? <tr><td colSpan={6} className="text-center py-10 text-brand-muted">No users</td></tr>
            : data.items.map((u: any) => {
              const rb = ROLE_BADGES[u.role] || ROLE_BADGES.company_user;
              return (
                <tr key={u.id} className="border-b border-brand-border hover:bg-[rgba(255,255,255,0.015)]">
                  <td className="px-4 py-2.5 font-medium text-sm">{u.first_name} {u.last_name}</td>
                  <td className="px-4 py-2.5 text-xs text-tb-dim">{u.email}</td>
                  <td className="px-4 py-2.5"><span className={`badge ${rb.class}`}>{u.role.replace('_', ' ')}</span></td>
                  <td className="px-4 py-2.5 text-xs text-brand-muted">{u.company_ids?.length || '—'} assigned</td>
                  <td className="px-4 py-2.5 text-xxs text-brand-muted">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`w-2 h-2 rounded-full inline-block ${u.is_active ? 'bg-brand-green' : 'bg-brand-red'}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
