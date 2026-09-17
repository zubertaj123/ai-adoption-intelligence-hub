import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/client';
import { useUIStore } from '@/stores/authStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import type { PortfolioStats, ActivityItem } from '@/lib/types';

const STAT_CONFIG = [
  { key: 'total_companies', label: 'Portfolio Companies', sub: 'Active coverage', fmt: (v: number) => v },
  { key: 'total_tools', label: 'AI Tools Tracked', sub: 'Across portfolio', fmt: (v: number) => v },
  { key: 'deployed_tools', label: 'Fully Deployed', sub: 'Live in production', fmt: (v: number) => v },
  { key: 'total_kpis', label: 'KPIs Tracked', sub: 'Portfolio-wide', fmt: (v: number) => v },
  { key: 'total_annual_spend', label: 'Annual AI Spend', sub: 'Portfolio total', fmt: (v: number) => `$${(v / 1e6).toFixed(1)}M` },
  { key: 'avg_adoption_pct', label: 'Avg Adoption', sub: 'Daily usage rate', fmt: (v: number) => `${Math.round(v)}%` },
];

const STAGE_COLORS = ['#F0A500', '#A55FFF', '#00A862', '#00D67B', '#FF6060'];
const CHART_COLORS = ['#00D67B', '#5900D0', '#00A862', '#A55FFF', '#F0A500', '#E03060', '#8844EE', '#FF6060', '#CCCCCC'];

export default function Dashboard() {
  const { globalCompanyId } = useUIStore();

  const { data: stats } = useQuery<PortfolioStats>({
    queryKey: ['dashboard-stats', globalCompanyId],
    queryFn: () => dashboardApi.stats(globalCompanyId || undefined).then(r => r.data),
  });

  const { data: activity } = useQuery<ActivityItem[]>({
    queryKey: ['dashboard-activity', globalCompanyId],
    queryFn: () => dashboardApi.activity({ limit: 8, company_id: globalCompanyId || undefined }).then(r => r.data),
  });

  const { data: spendByFn } = useQuery({
    queryKey: ['spend-by-fn', globalCompanyId],
    queryFn: () => dashboardApi.spendByFunction(globalCompanyId || undefined).then(r => r.data),
  });

  const { data: stageDist } = useQuery({
    queryKey: ['stage-dist', globalCompanyId],
    queryFn: () => dashboardApi.stageDistribution(globalCompanyId || undefined).then(r => r.data),
  });

  return (
    <div className="animate-fade-in">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-brand-border border border-brand-border rounded-md overflow-hidden mb-5">
        {STAT_CONFIG.map((s, i) => (
          <div key={s.key} className="bg-tb-surface p-4 relative overflow-hidden">
            <div className="section-label">{s.label}</div>
            <div className={`text-2xl font-light mt-1.5 mb-0.5 tracking-tight ${i % 2 === 0 ? 'text-brand-green' : 'text-[#A55FFF]'}`}>
              {stats ? s.fmt((stats as any)[s.key]) : '—'}
            </div>
            <div className="text-xxs text-brand-muted">{s.sub}</div>
            <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${i % 2 === 0 ? 'bg-brand-green' : 'bg-brand-purple'}`} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Spend by Function Chart */}
        <div className="brand-card">
          <div className="section-label mb-4">Spend by Function</div>
          {spendByFn && spendByFn.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={spendByFn} layout="vertical" margin={{ left: 80, right: 16, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fill: '#666', fontSize: 10 }}
                       tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="function" tick={{ fill: '#CCC', fontSize: 10 }} width={76} />
                <Tooltip formatter={(v: number) => [`$${(v / 1000).toFixed(0)}K`, 'Spend']}
                         contentStyle={{ background: '#1E1E1E', border: '1px solid #303030', fontSize: 11 }} />
                <Bar dataKey="total_spend" radius={[0, 3, 3, 0]}>
                  {spendByFn.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="text-brand-muted text-sm text-center py-10">No spend data yet</div>}
        </div>

        {/* Stage Distribution */}
        <div className="brand-card">
          <div className="section-label mb-4">Deployment Stage Distribution</div>
          {stageDist && stageDist.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={stageDist} dataKey="count" nameKey="label" cx="50%" cy="50%"
                       innerRadius={40} outerRadius={70} paddingAngle={2}>
                    {stageDist.map((_: any, i: number) => <Cell key={i} fill={STAGE_COLORS[stageDist[i].stage]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1E1E1E', border: '1px solid #303030', fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {stageDist.map((s: any) => (
                  <div key={s.stage} className="flex items-center gap-1.5 text-xxs text-tb-dim">
                    <span className="w-2 h-2 rounded-sm" style={{ background: STAGE_COLORS[s.stage] }} />
                    {s.label}: {s.count}
                  </div>
                ))}
              </div>
            </>
          ) : <div className="text-brand-muted text-sm text-center py-10">No tools yet</div>}
        </div>

        {/* Activity Feed */}
        <div className="brand-card">
          <div className="section-label mb-4">Recent Activity</div>
          {activity && activity.length > 0 ? (
            <div className="space-y-0">
              {activity.map((a) => (
                <div key={a.id} className="flex gap-3 py-2.5 border-b border-brand-border last:border-0 items-start">
                  <div className="w-1.5 h-1.5 bg-brand-green rounded-full mt-1.5 flex-shrink-0 animate-pulse-dot" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-tb-dim truncate">{a.description}</div>
                    <div className="flex gap-3 mt-0.5">
                      {a.company_name && <span className="text-xxs text-brand-green font-semibold">{a.company_name}</span>}
                      <span className="text-xxs text-brand-muted">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="text-brand-muted text-sm text-center py-10">No activity yet</div>}
        </div>
      </div>
    </div>
  );
}
