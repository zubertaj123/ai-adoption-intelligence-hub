import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, companiesApi } from '@/api/client';
import { Download, FileText } from 'lucide-react';

const PERIODS = [
  { value: 'Q2 2026', label: 'Q2 2026' },
  { value: 'Q1 2026', label: 'Q1 2026' },
  { value: 'Q4 2025', label: 'Q4 2025' },
];

function generateReportHTML(data: any, period: string, companyName: string) {
  if (!data?.sections) return '';

  const sections = data.sections.map((s: any) => {
    const kpiCards = (s.kpis || []).slice(0, 2).map((k: any) => `
      <div style="padding:28px;background:#0D0D0D">
        <div style="font-size:16px;color:#CCC;margin-bottom:16px">
          <span style="color:#00D67B;font-weight:500">${k.company_name || ''}</span>
          ${k.company_name ? ' · ' : ''}${k.kpi_name}
        </div>
        <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px">
          <div style="text-align:center">
            <div style="font-size:28px;font-weight:300;color:#fff">${k.baseline}%</div>
            <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1.5px">Baseline</div>
          </div>
          <span style="color:#303030;font-size:22px">→</span>
          <div style="text-align:center">
            <div style="font-size:28px;font-weight:300;color:#00D67B">${k.current}%</div>
            <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1.5px">Current</div>
          </div>
          <span style="color:#303030;font-size:22px">→</span>
          <div style="text-align:center">
            <div style="font-size:28px;font-weight:300;color:#A55FFF">${k.target}%</div>
            <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1.5px">Goal</div>
          </div>
        </div>
        <div style="background:#303030;height:4px;border-radius:2px">
          <div style="background:linear-gradient(90deg,#5900D0,#00D67B);width:${k.progress}%;height:4px;border-radius:2px"></div>
        </div>
        <div style="font-size:12px;color:#666;margin-top:6px">${k.progress}% of target — as of ${k.as_of_date}</div>
      </div>`).join('');

    const goalItems = (s.goals || []).map((g: any) => `
      <div style="margin-bottom:12px">
        <div style="font-size:15px;color:#00D67B;font-weight:500">${g.tool_name}</div>
        ${g.first_order ? `<div style="font-size:14px;color:#CCC;margin-top:4px">Near-term: ${g.first_order}</div>` : ''}
        ${g.second_order ? `<div style="font-size:13px;color:#888;margin-top:2px">Mid-term: ${g.second_order}</div>` : ''}
      </div>`).join('');

    return `
      <div style="margin-bottom:32px;page-break-inside:avoid">
        <div style="padding:14px 20px;border-radius:8px 8px 0 0;font-size:13px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#fff;background:linear-gradient(90deg,${s.gradient_from},${s.gradient_to})">
          ${s.icon || ''} ${s.function_name}
        </div>
        <div style="border:1px solid #252525;border-top:none;border-radius:0 0 8px 8px;background:#0D0D0D">
          ${kpiCards ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#252525">${kpiCards}</div>` : '<div style="padding:30px;text-align:center;color:#666">No KPIs configured.</div>'}
          ${goalItems ? `<div style="border-top:1px solid #252525;padding:24px"><div style="font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:2.5px;margin-bottom:12px">Goals</div>${goalItems}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>TB Board Report — ${period}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Figtree',sans-serif;background:#000;color:#fff;padding:48px}
  @media print{body{padding:24px}@page{margin:0.5in;size:A4}}
</style></head><body>
<div style="text-align:center;margin-bottom:48px">
  <div style="font-size:14px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#666;margin-bottom:8px">the private equity firm</div>
  <div style="font-size:32px;font-weight:300;letter-spacing:3px;text-transform:uppercase">Board Report</div>
  <div style="width:48px;height:2px;background:linear-gradient(90deg,#5900D0,#00D67B);margin:16px auto"></div>
  <div style="font-size:14px;color:#666;margin-top:12px">
    Quarterly AI performance summary — <span style="color:#00D67B;font-weight:600">${period}</span> · <span style="color:#A55FFF">${companyName}</span>
  </div>
</div>
${sections}
</body></html>`;
}

export default function BoardReportPage() {
  const [companyFilter, setCompanyFilter] = useState('');
  const [period, setPeriod] = useState('Q2 2026');

  const { data: companies } = useQuery({
    queryKey: ['companies-board'],
    queryFn: () => companiesApi.list({ page_size: 100 }).then(r => r.data.items),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['board-report', companyFilter],
    queryFn: () => dashboardApi.boardReport(companyFilter || undefined).then(r => r.data),
  });

  const selectedCompany = companyFilter
    ? companies?.find((c: any) => c.id === companyFilter)?.name || 'Portfolio'
    : 'All Portfolio';

  const handleExportPDF = () => {
    const html = generateReportHTML(data, period, selectedCompany);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  const handleDownloadHTML = () => {
    const html = generateReportHTML(data, period, selectedCompany);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TB_Board_Report_${period.replace(' ', '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-brand-border">
        <div>
          <h2 className="text-lg font-light tracking-[2px] uppercase text-brand-text">Board Reporting Template</h2>
          <p className="text-xs text-brand-muted mt-1">Quarterly AI performance summary — key 2 KPIs per function</p>
        </div>
        <div className="flex gap-2">
          <button className="tb-btn-outline flex items-center gap-2" onClick={handleExportPDF}>
            <Download size={14} /> Export PDF
          </button>
          <button className="tb-btn flex items-center gap-2" onClick={handleDownloadHTML}>
            <FileText size={14} /> Download HTML
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-brand-muted uppercase tracking-wider">Period:</span>
          <span className="text-sm text-brand-green font-semibold">{period}</span>
          <select className="tb-select" value={period} onChange={e => setPeriod(e.target.value)}>
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-brand-muted uppercase tracking-wider">PortCo:</span>
          <select className="tb-select" value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}>
            <option value="">All Portfolio</option>
            {companies?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Report Content — IN-APP VIEW with larger text */}
      {isLoading ? (
        <div className="text-brand-muted text-center py-20">Loading...</div>
      ) : !data?.sections?.length ? (
        <div className="text-brand-muted text-center py-20">No report data</div>
      ) : data.sections.map((section: any) => (
        <div key={section.function_name} className="mb-5">
          <div className="text-xs font-bold tracking-[2px] uppercase text-white p-3 rounded-t-md"
               style={{ background: `linear-gradient(90deg, ${section.gradient_from}, ${section.gradient_to})` }}>
            {section.icon && <span className="mr-2">{section.icon}</span>}
            {section.function_name}
          </div>

          <div className="bg-tb-surface border border-brand-border border-t-0 rounded-b-md">
            {!section.kpis?.length ? (
              <div className="text-brand-muted text-sm text-center py-8">No KPIs configured.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-brand-border">
                {section.kpis.slice(0, 2).map((kpi: any, i: number) => (
                  <div key={i} className="bg-tb-surface p-6">
                    <div className="text-sm text-tb-dim mb-4">
                      {kpi.company_name && <span className="text-brand-green font-medium">{kpi.company_name}</span>}
                      {kpi.company_name && ' · '}{kpi.kpi_name}
                    </div>
                    <div className="flex gap-4 items-center mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-light">{kpi.baseline}%</div>
                        <div className="text-xs text-brand-muted uppercase tracking-wider">Baseline</div>
                      </div>
                      <span className="text-brand-border2 text-xl">→</span>
                      <div className="text-center">
                        <div className="text-2xl font-light text-brand-green">{kpi.current}%</div>
                        <div className="text-xs text-brand-muted uppercase tracking-wider">Current</div>
                      </div>
                      <span className="text-brand-border2 text-xl">→</span>
                      <div className="text-center">
                        <div className="text-2xl font-light text-[#A55FFF]">{kpi.target}%</div>
                        <div className="text-xs text-brand-muted uppercase tracking-wider">Goal</div>
                      </div>
                    </div>
                    <div className="progress-track"><div className="progress-fill" style={{ width: `${kpi.progress}%` }} /></div>
                    <div className="text-xs text-brand-muted mt-2">{kpi.progress}% of target — as of {kpi.as_of_date}</div>
                  </div>
                ))}
              </div>
            )}

            {section.goals?.length > 0 && (
              <div className="border-t border-brand-border p-5">
                <div className="section-label mb-3">Goals</div>
                {section.goals.map((g: any, i: number) => (
                  <div key={i} className="mb-3">
                    <span className="text-sm text-brand-green font-medium">{g.tool_name}</span>
                    {g.first_order && <div className="text-xs text-tb-dim mt-1">Near-term: {g.first_order}</div>}
                    {g.second_order && <div className="text-xs text-brand-muted mt-0.5">Mid-term: {g.second_order}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}