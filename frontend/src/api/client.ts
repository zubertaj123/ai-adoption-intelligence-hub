import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      const refresh = localStorage.getItem('refresh_token');
      if (refresh && !error.config._retry) {
        error.config._retry = true;
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refresh_token: refresh });
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);
          error.config.headers.Authorization = `Bearer ${data.access_token}`;
          return api(error.config);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ───
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  refresh: (token: string) => api.post('/auth/refresh', { refresh_token: token }),
};

// ─── Users ───
export const usersApi = {
  list: (params?: any) => api.get('/users', { params }),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

// ─── Companies ───
export const companiesApi = {
  list: (params?: any) => api.get('/companies', { params }),
  get: (id: string) => api.get(`/companies/${id}`),
  create: (data: any) => api.post('/companies', data),
  update: (id: string, data: any) => api.patch(`/companies/${id}`, data),
  delete: (id: string) => api.delete(`/companies/${id}`),
};

// ─── Tools ───
export const toolsApi = {
  list: (params?: any) => api.get('/tools', { params }),
  get: (id: string) => api.get(`/tools/${id}`),
  create: (data: any) => api.post('/tools', data),
  update: (id: string, data: any) => api.patch(`/tools/${id}`, data),
  updateStage: (id: string, stage: number) => api.patch(`/tools/${id}/stage`, null, { params: { stage } }),
  delete: (id: string) => api.delete(`/tools/${id}`),
};

// ─── Adoption ───
export const adoptionApi = {
  list: (params?: any) => api.get('/adoption', { params }),
  create: (data: any) => api.post('/adoption', data),
  history: (toolId: string, functionId?: string) =>
    api.get(`/adoption/history/${toolId}`, { params: { function_id: functionId } }),
};

// ─── Governance ───
export const governanceApi = {
  list: (params?: any) => api.get('/governance', { params }),
  create: (data: any) => api.post('/governance', data),
  update: (id: string, data: any) => api.patch(`/governance/${id}`, data),
  delete: (id: string) => api.delete(`/governance/${id}`),
};

// ─── TTV ───
export const ttvApi = {
  list: (params?: any) => api.get('/ttv', { params }),
  create: (data: any) => api.post('/ttv', data),
  update: (id: string, data: any) => api.patch(`/ttv/${id}`, data),
};

// ─── Goals ───
export const goalsApi = {
  list: (params?: any) => api.get('/goals', { params }),
  create: (data: any) => api.post('/goals', data),
  update: (id: string, data: any) => api.patch(`/goals/${id}`, data),
};

// ─── Upload ───
export const uploadApi = {
  upload: (companyId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/upload/${companyId}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  jobs: (companyId: string) => api.get(`/upload/${companyId}/jobs`),
  preview: (jobId: string) => api.get(`/upload/jobs/${jobId}/preview`),
  commit: (jobId: string) => api.post(`/upload/jobs/${jobId}/commit`),
};

// ─── Dashboard ───
export const dashboardApi = {
  stats: (companyId?: string) => api.get('/dashboard/stats', { params: { company_id: companyId } }),
  activity: (params?: any) => api.get('/dashboard/activity', { params }),
  spendByFunction: (companyId?: string) => api.get('/dashboard/spend-by-function', { params: { company_id: companyId } }),
  spendByCompany: () => api.get('/dashboard/spend-by-company'),
  adoptionByFunction: (companyId?: string) => api.get('/dashboard/adoption-by-function', { params: { company_id: companyId } }),
  stageDistribution: (companyId?: string) => api.get('/dashboard/stage-distribution', { params: { company_id: companyId } }),
  boardReport: (companyId?: string) => api.get('/dashboard/board-report', { params: { company_id: companyId } }),
  functions: () => api.get('/dashboard/functions'),
};

// ─── Audit ───
export const auditApi = {
  list: (params?: any) => api.get('/audit', { params }),
};

export default api;
