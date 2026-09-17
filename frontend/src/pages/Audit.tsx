import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/api/client';
import { formatDistanceToNow } from 'date-fns';

const ACTION_COLORS: Record<string, string> = {
  create: 'text-brand-green', update: 'text-[#A55FFF]', delete: 'text-[#FF6060]',
  upload: 'text-brand-amber', login: 'text-tb-dim', export: 'text-tb-teal',
};

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, entityType, action],
    queryFn: () => auditApi.list({ page, page_size: 50, entity_type: entityType || undefined, action: action || undefined }).then(r => r.data),
  });

  return (
    <div className="animate-fade-in">
      <div className="mb-5 pb-4 border-b border-brand-border">
        <h2 className="text-lg font-light tracking-[2px] uppercase text-brand-text">Audit Log</h2>
        <p className="text-xs text-brand-muted mt-1">{data?.total || 0} events</p>
      </div>

      <div className="flex gap-2 mb-4">
        <select className="tb-select" value={entityType} onChange={e => { setEntityType(e.target.value); setPage(1); }}>
          <option value="">All Entities</option>
          {['user', 'company', 'tool', 'adoption', 'governance', 'ttv', 'upload'].map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="tb-select" value={action} onChange={e => { setAction(e.target.value); setPage(1); }}>
          <option value="">All Actions</option>
          {['create', 'update', 'delete', 'upload', 'login', 'export'].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="brand-card p-0 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border2">
              {['Time', 'Action', 'Entity', 'Detail', 'User', 'Company'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xxs font-semibold tracking-[1.5px] uppercase text-brand-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="text-center py-10 text-brand-muted">Loading...</td></tr>
            : !data?.items.length ? <tr><td colSpan={6} className="text-center py-10 text-brand-muted">No events</td></tr>
            : data.items.map((e: any) => (
              <tr key={e.id} className="border-b border-brand-border hover:bg-[rgba(255,255,255,0.015)]">
                <td className="px-4 py-2 text-xxs text-brand-muted whitespace-nowrap">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</td>
                <td className="px-4 py-2"><span className={`text-xxs font-bold uppercase ${ACTION_COLORS[e.action] || 'text-tb-dim'}`}>{e.action}</span></td>
                <td className="px-4 py-2 text-xs text-tb-dim">{e.entity_type}</td>
                <td className="px-4 py-2 text-xs text-brand-muted max-w-[300px] truncate">
                  {e.field_changed ? `${e.field_changed}: ${e.old_value || '—'} → ${e.new_value || '—'}` : e.new_value || '—'}
                </td>
                <td className="px-4 py-2 text-xxs text-brand-muted">{e.user_email || '—'}</td>
                <td className="px-4 py-2 text-xxs text-brand-green">{e.company_id ? '●' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total_pages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <span className="text-xxs text-brand-muted">Page {data.page} of {data.total_pages}</span>
          <div className="flex gap-2">
            <button className="tb-btn-outline text-xxs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <button className="tb-btn-outline text-xxs" disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
