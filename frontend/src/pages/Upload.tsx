import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadApi, companiesApi } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import { Upload, FileSpreadsheet, Check, AlertCircle, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function UploadPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [companyId, setCompanyId] = useState(user?.company_ids[0] || '');
  const [file, setFile] = useState<File | null>(null);
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);

  const { data: companies } = useQuery({
    queryKey: ['companies-upload'],
    queryFn: () => companiesApi.list({ page_size: 100 }).then(r => r.data.items),
    enabled: user?.role === 'tb_admin',
  });

  const { data: jobs } = useQuery({
    queryKey: ['upload-jobs', companyId],
    queryFn: () => uploadApi.jobs(companyId).then(r => r.data),
    enabled: !!companyId,
  });

  const uploadMutation = useMutation({
    mutationFn: () => uploadApi.upload(companyId, file!),
    onSuccess: async (res) => {
      const job = res.data;
      setPreviewJobId(job.id);
      if (job.status === 'preview') {
        const preview = await uploadApi.preview(job.id);
        setPreviewData(preview.data.summary);
      }
      toast.success('Template parsed successfully');
      queryClient.invalidateQueries({ queryKey: ['upload-jobs'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Upload failed'),
  });

  const commitMutation = useMutation({
    mutationFn: () => uploadApi.commit(previewJobId!),
    onSuccess: (res) => {
      toast.success(`Committed ${res.data.processed_records} records`);
      setPreviewJobId(null);
      setPreviewData(null);
      setFile(null);
      queryClient.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Commit failed'),
  });

  const STATUS_COLORS: Record<string, string> = {
    pending: 'text-brand-amber', processing: 'text-brand-amber',
    preview: 'text-[#A55FFF]', committed: 'text-brand-green', failed: 'text-[#FF6060]',
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/v1/upload/template/download');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'TB_Board_Reporting_Template_Blank.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download template');
      console.error('Download error:', error);
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-brand-border">
        <div>
          <h2 className="text-lg font-light tracking-[2px] uppercase text-brand-text">Upload Data</h2>
          <p className="text-xs text-brand-muted mt-1">Import AI tool data from the TB Board Reporting Excel template</p>
        </div>
        <button className="tb-btn-outline flex items-center gap-2" onClick={handleDownloadTemplate}>
          <Download size={14} /> Download Template
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upload Section */}
        <div className="brand-card">
          <div className="section-label mb-4">Upload Template</div>

          {user?.role === 'tb_admin' && companies && (
            <div className="mb-4">
              <label className="section-label block mb-1.5">Company</label>
              <select className="tb-select w-full" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                <option value="">Select company...</option>
                {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div className="border-2 border-dashed border-brand-border2 rounded-md p-8 text-center hover:border-[rgba(0,214,123,0.4)] transition-colors">
            <input type="file" accept=".xlsx,.xls" className="hidden" id="file-input"
                   onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <label htmlFor="file-input" className="cursor-pointer">
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet size={24} className="text-brand-green" />
                  <div>
                    <div className="text-sm text-tb-dim">{file.name}</div>
                    <div className="text-xxs text-brand-muted">{(file.size / 1024).toFixed(1)} KB</div>
                  </div>
                </div>
              ) : (
                <>
                  <Upload size={32} className="text-brand-muted mx-auto mb-3" />
                  <div className="text-sm text-tb-dim">Click to select .xlsx file</div>
                  <div className="text-xxs text-brand-muted mt-1">TB Board Reporting template format</div>
                </>
              )}
            </label>
          </div>

          <button className="tb-btn w-full mt-4" disabled={!file || !companyId || uploadMutation.isPending}
                  onClick={() => uploadMutation.mutate()}>
            {uploadMutation.isPending ? 'Parsing...' : 'Upload & Parse'}
          </button>

          {/* Preview */}
          {previewData && (
            <div className="mt-4 p-4 rounded bg-tb-surface2 border border-brand-border2 animate-slide-in">
              <div className="section-label mb-3 text-[#A55FFF]">Preview</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-brand-muted">Tools found:</span><span className="text-brand-green font-semibold">{previewData.tools?.length || 0}</span></div>
                <div className="flex justify-between"><span className="text-brand-muted">Functions parsed:</span><span>{previewData.functions_parsed || 0}</span></div>
                <div className="flex justify-between"><span className="text-brand-muted">Adoption records:</span><span>{previewData.adoption_records || 0}</span></div>
                <div className="flex justify-between"><span className="text-brand-muted">Goals:</span><span>{previewData.goals_count || 0}</span></div>
                <div className="flex justify-between"><span className="text-brand-muted">Governance contacts:</span><span>{previewData.governance_contacts || 0}</span></div>
                {previewData.tools && (
                  <div className="mt-2 pt-2 border-t border-brand-border">
                    <div className="text-xxs text-brand-muted mb-1">Tools:</div>
                    <div className="flex flex-wrap gap-1">
                      {previewData.tools.map((t: string) => (
                        <span key={t} className="badge badge-sm">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {previewData.errors?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-brand-border">
                    <div className="text-xxs text-[#FF6060]">
                      {previewData.errors.map((e: string, i: number) => <div key={i}>⚠ {e}</div>)}
                    </div>
                  </div>
                )}
              </div>
              <button className="tb-btn w-full mt-4" onClick={() => commitMutation.mutate()}
                      disabled={commitMutation.isPending}>
                {commitMutation.isPending ? 'Committing...' : 'Commit to Database'}
              </button>
            </div>
          )}
        </div>

        {/* Upload History */}
        <div className="brand-card">
          <div className="section-label mb-4">Upload History</div>
          {!jobs || jobs.length === 0 ? (
            <div className="text-brand-muted text-sm text-center py-10">No uploads yet</div>
          ) : (
            <div className="space-y-3">
              {jobs.map((j: any) => (
                <div key={j.id} className="p-3 rounded bg-tb-surface2 border border-brand-border">
                  <div className="flex items-center gap-2">
                    {j.status === 'committed' ?
                      <Check size={14} className="text-brand-green" /> :
                      j.status === 'failed' ?
                      <AlertCircle size={14} className="text-[#FF6060]" /> :
                      <FileSpreadsheet size={14} className="text-brand-muted" />
                    }
                    <span className="text-sm text-tb-dim flex-1 truncate">{j.filename}</span>
                    <span className={`text-xxs font-bold uppercase ${STATUS_COLORS[j.status] || 'text-brand-muted'}`}>{j.status}</span>
                  </div>
                  {j.total_records && (
                    <div className="text-xxs text-brand-muted mt-1 ml-6">
                      {j.processed_records || j.total_records} records • {new Date(j.created_at).toLocaleDateString()}
                    </div>
                  )}
                  {j.error_message && (
                    <div className="text-xxs text-[#FF6060] mt-1 ml-6">{j.error_message}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}