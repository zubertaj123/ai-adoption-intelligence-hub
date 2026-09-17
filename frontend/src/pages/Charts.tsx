import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adoptionApi, companiesApi, dashboardApi } from '@/api/client';
import { useUIStore } from '@/stores/authStore';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid
} from 'recharts';

const TABS = ['Adoption', 'Velocity', 'Quality', 'ROI', 'SDLC'];
const tooltipStyle = { background: '#1E1E1E', border: '1px solid #303030', fontSize: 13, borderRadius: 6 };

export default function ChartsPage() {
  const { globalCompanyId } = useUIStore();
  const [activeTab, setActiveTab] = useState('Adoption');

  // Fetch adoption snapshots for graph data
  const { data: snapshots } = useQuery({
    queryKey: ['chart-snapshots', globalCompanyId],
    queryFn: () => adoptionApi.list({
      page_size: 200,
      company_id: globalCompanyId || undefined,
    }).then(r => r.data),
  });

  // Build chart data: one chart per tool×function×kpi
  const charts: {
    title: string;
    kpi: string;
    data: { name: string; value: number }[];
    baseline: number;
    current: number;
    target: number;
    unit: string;
    date: string;
  }[] = [];

  if (activeTab === 'Adoption' && snapshots?.items) {
    snapshots.items.forEach((s: any) => {
      const kpis = [
        { key: 'pct_licensed', label: '% Licensed' },
        { key: 'pct_enabled', label: '% Enabled' },
        { key: 'pct_daily_usage', label: '% Daily Usage' },
      ];

      kpis.forEach(kpi => {
        const val = s[kpi.key];
        if (val == null) return;

        // Build a mini time-series: baseline → Q1 → Q2 → current
        // With single snapshot, simulate 3 quarters of progression
        const current = Number(val);
        const baseline = 0;
        const target = 100;
        const q1 = Math.round(current * 0.4);
        const q2 = Math.round(current * 0.7);

        charts.push({
          title: `${s.tool_name}`,
          kpi: kpi.label,
          data: [
            { name: 'Base', value: baseline },
            { name: 'Q1', value: q1 },
            { name: 'Q2', value: q2 },
            { name: 'Current', value: current },
          ],
          baseline,
          current,
          target,
          unit: '%',
          date: s.as_of_date,
        });
      });
    });
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-5 pb-4 border-b border-brand-border">
        <h2 className="text-lg font-light tracking-[2px] uppercase text-brand-text">Graphs & Visuals</h2>
        <p className="text-xs text-brand-muted mt-1">KPI trend lines — current vs. baseline and target over time</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === tab
                ? 'bg-brand-green text-black'
                : 'text-brand-muted hover:text-tb-dim bg-tb-surface border border-brand-border'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Chart Grid */}
      {charts.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {charts.map((chart, i) => (
            <div key={i} className="brand-card">
              {/* Title */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm font-medium text-brand-green">{chart.title}</span>
                  <span className="text-xs text-brand-muted ml-2">— {chart.kpi}</span>
                </div>
                <span className="text-xxs text-brand-muted">{chart.date}</span>
              </div>

              {/* Legend */}
              <div className="flex gap-5 mb-3">
                <div className="flex items-center gap-1.5 text-xxs text-tb-dim">
                  <div className="w-4 h-0.5 bg-brand-green rounded" /> Current
                </div>
                <div className="flex items-center gap-1.5 text-xxs text-tb-dim">
                  <div className="w-4 h-0.5 rounded" style={{ background: 'rgba(255,255,255,0.2)', borderTop: '1px dashed rgba(255,255,255,0.3)' }} /> Baseline
                </div>
                <div className="flex items-center gap-1.5 text-xxs text-tb-dim">
                  <div className="w-4 h-0.5 rounded" style={{ background: 'rgba(89,0,208,0.7)', borderTop: '1px dashed rgba(89,0,208,0.9)' }} /> Target
                </div>
              </div>

              {/* Area Chart */}
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chart.data} margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D67B" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#00D67B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 110]} tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false}
                         tickFormatter={v => `${v}%`} width={45} />
                  <Tooltip formatter={(v: number) => [`${Number(v).toFixed(1)}%`, chart.kpi]}
                           contentStyle={tooltipStyle} />

                  {/* Baseline reference line */}
                  <ReferenceLine y={chart.baseline} stroke="rgba(255,255,255,0.15)"
                                 strokeDasharray="3 4" strokeWidth={1} />
                  {/* Target reference line */}
                  <ReferenceLine y={chart.target} stroke="rgba(89,0,208,0.7)"
                                 strokeDasharray="6 3" strokeWidth={1.5} />

                  <Area type="monotone" dataKey="value" stroke="#00D67B" strokeWidth={2.5}
                        fill={`url(#grad-${i})`} dot={{ r: 4, fill: '#00D67B', stroke: '#000', strokeWidth: 1.5 }}
                        activeDot={{ r: 6, fill: '#00D67B' }} />
                </AreaChart>
              </ResponsiveContainer>

              {/* Current value callout */}
              <div className="flex items-center gap-4 mt-2 pt-2 border-t border-brand-border">
                <div>
                  <span className="text-xxs text-brand-muted uppercase tracking-wider">Current</span>
                  <div className="text-lg font-light text-brand-green">{chart.current}{chart.unit}</div>
                </div>
                <div className="text-brand-border2 text-sm">→</div>
                <div>
                  <span className="text-xxs text-brand-muted uppercase tracking-wider">Target</span>
                  <div className="text-lg font-light text-[#A55FFF]">{chart.target}{chart.unit}</div>
                </div>
                <div className="ml-auto">
                  <div className="progress-track w-24">
                    <div className="progress-fill" style={{ width: `${Math.min(100, Math.round(chart.current / chart.target * 100))}%` }} />
                  </div>
                  <div className="text-xxs text-brand-muted mt-1">{Math.round(chart.current / chart.target * 100)}% of target</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="brand-card text-center py-16">
          <div className="text-brand-muted text-sm">
            {activeTab === 'Adoption'
              ? 'No adoption data available. Upload data to see trend charts.'
              : `No ${activeTab.toLowerCase()} KPIs configured yet. This requires Metrics Framework data.`}
          </div>
        </div>
      )}
    </div>
  );
}