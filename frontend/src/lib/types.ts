export type UserRole = 'tb_admin' | 'tb_user' | 'company_user';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  company_ids: string[];
  last_login_at?: string;
  created_at?: string;
}

export interface Company {
  id: string;
  name: string;
  display_name?: string;
  sector?: string;
  description?: string;
  website?: string;
  employee_count?: number;
  hq_location?: string;
  is_active: boolean;
  initial_load_at?: string;
  created_at?: string;
  tools_count: number;
  total_spend: number;
}

export interface Tool {
  id: string;
  company_id: string;
  portco_name?: string;
  company_name?: string;
  name: string;
  vendor?: string;
  product?: string;           // ← ADDED: Product 1–10
  use_case?: string;
  biz_owner_name?: string;
  biz_owner_role?: string;
  tech_owner_name?: string;
  tech_owner_role?: string;
  project_spend?: number;
  annual_spend?: number;
  pricing_model?: string;
  token_limit?: string;
  deployment_stage: number;
  deployment_stage_label?: string;
  fail_reason?: string;
  complexity?: string;
  is_active: boolean;
  function_names: string[];
  created_at?: string;
  updated_at?: string;
}

export interface AdoptionSnapshot {
  id: string;
  tool_id: string;
  tool_name?: string;
  function_id: string;
  function_name?: string;
  company_id: string;
  as_of_date: string;
  employee_pool?: number;
  licenses_bought?: number;
  employees_enabled?: number;
  avg_daily_users?: number;
  pct_licensed?: number;
  pct_enabled?: number;
  pct_daily_usage?: number;
  source?: string;
  notes?: string;
  created_at?: string;
}

export interface GovernanceContact {
  id: string;
  company_id: string;
  portco_name?: string;
  company_name?: string;
  name: string;
  title?: string;
  role?: string;
  email?: string;
  phone?: string;
  function_name?: string;
  is_primary: boolean;
  created_at?: string;
}

export interface TTVRecord {
  id: string;
  tool_id: string;
  tool_name?: string;
  company_id: string;
  portco_name?: string;
  company_name?: string;
  pilot_start?: string;
  pilot_end?: string;
  security_approval?: string;
  deploy_date?: string;
  first_benefit?: string;
  pilot_days?: number;
  approval_days?: number;
  deploy_lag_days?: number;
  benefit_days?: number;
  total_ttv_days?: number;
  notes?: string;
}

export interface PortfolioStats {
  total_companies: number;
  total_tools: number;
  deployed_tools: number;
  pilot_tools: number;
  failed_tools: number;
  total_annual_spend: number;
  avg_adoption_pct: number;
  total_kpis: number;
}

export interface ActivityItem {
  id: string;
  entity_type: string;
  action: string;
  description: string;
  company_name?: string;
  user_email?: string;
  created_at: string;
}

export interface BizFunction {
  id: string;
  name: string;
  display_name: string;
  display_order: number;
  icon?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const STAGE_LABELS: Record<number, string> = {
  0: 'Security Review',
  1: 'In Pilot',
  2: 'Waiting Security',
  3: 'Fully Deployed',
  4: 'Failed Pilot',
};

export const COMPLEXITY_CLASSES: Record<string, string> = {
  Low: 'text-brand-green font-semibold',
  Medium: 'text-[#A55FFF] font-semibold',
  High: 'text-[#FF6060] font-semibold',
};

export const PRODUCTS = Array.from({ length: 10 }, (_, i) => `Product ${i + 1}`);

export const STAGE_CLASSES: Record<number, string> = {
  0: 'stage-0', 1: 'stage-1', 2: 'stage-2', 3: 'stage-3', 4: 'stage-4',
};
