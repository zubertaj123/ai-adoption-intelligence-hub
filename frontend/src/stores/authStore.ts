import { create } from 'zustand';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
  hasRole: (...roles: string[]) => boolean;
  canAccessCompany: (companyId: string) => boolean;
  canWrite: (companyId?: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),

  login: (user, accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user, isAuthenticated: true }),

  hasRole: (...roles) => {
    const { user } = get();
    return !!user && roles.includes(user.role);
  },

  canAccessCompany: (companyId) => {
    const { user } = get();
    if (!user) return false;
    if (user.role === 'tb_admin' || user.role === 'tb_user') return true;
    return user.company_ids.includes(companyId);
  },

  canWrite: (companyId?) => {
    const { user } = get();
    if (!user) return false;
    if (user.role === 'tb_admin') return true;
    if (user.role === 'tb_user') return false;
    if (!companyId) return false;
    return user.company_ids.includes(companyId);
  },
}));

// ─── UI Store with theme ───
type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('tb_theme') as Theme | null;
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  if (theme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
  localStorage.setItem('tb_theme', theme);
}

// Apply on load
applyTheme(getInitialTheme());

interface UIState {
  sidebarOpen: boolean;
  globalCompanyId: string | null;
  theme: Theme;
  toggleSidebar: () => void;
  setGlobalCompany: (id: string | null) => void;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: true,
  globalCompanyId: null,
  theme: getInitialTheme(),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setGlobalCompany: (id) => set({ globalCompanyId: id }),

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    set({ theme: next });
  },
  setTheme: (t) => {
    applyTheme(t);
    set({ theme: t });
  },
}));
