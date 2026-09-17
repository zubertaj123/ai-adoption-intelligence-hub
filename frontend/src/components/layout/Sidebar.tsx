import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useUIStore } from '@/stores/authStore';
import {
  LayoutDashboard, Wrench, Users, BarChart3, LineChart, FileText,
  Clock, Upload, Shield, Activity, Settings, Building2, Sun, Moon
} from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
  icon: any;
  section: string;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Command Center', path: '/', icon: LayoutDashboard, section: 'Overview', roles: ['tb_admin', 'tb_user', 'company_user'] },
  { label: 'Companies', path: '/companies', icon: Building2, section: 'Portfolio', roles: ['tb_admin', 'tb_user'] },
  { label: 'Governance Council', path: '/governance', icon: Users, section: 'Governance', roles: ['tb_admin', 'tb_user', 'company_user'] },
  { label: 'Tool Inventory', path: '/tools', icon: Wrench, section: 'Inventory', roles: ['tb_admin', 'tb_user', 'company_user'] },
  { label: 'Time to Value', path: '/ttv', icon: Clock, section: 'Inventory', roles: ['tb_admin', 'tb_user', 'company_user'] },
  { label: 'Metrics Framework', path: '/metrics', icon: BarChart3, section: 'Performance', roles: ['tb_admin', 'tb_user', 'company_user'] },
  { label: 'Graphs & Visuals', path: '/charts', icon: LineChart, section: 'Performance', roles: ['tb_admin', 'tb_user', 'company_user'] },
  { label: 'Board Report', path: '/board-report', icon: FileText, section: 'Reporting', roles: ['tb_admin', 'tb_user', 'company_user'] },
  { label: 'Upload Data', path: '/upload', icon: Upload, section: 'Data Management', roles: ['tb_admin', 'company_user'] },
  { label: 'User Management', path: '/users', icon: Shield, section: 'Administration', roles: ['tb_admin'] },
  { label: 'Audit Log', path: '/audit', icon: Activity, section: 'Administration', roles: ['tb_admin', 'tb_user'] },
  // { label: 'Settings', path: '/settings', icon: Settings, section: 'Administration', roles: ['tb_admin'] },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useUIStore();

  const visibleItems = NAV_ITEMS.filter(item => user && item.roles.includes(user.role));
  const sections: Record<string, NavItem[]> = {};
  visibleItems.forEach(item => {
    if (!sections[item.section]) sections[item.section] = [];
    sections[item.section].push(item);
  });

  return (
    <aside className="w-sidebar bg-tb-surface flex flex-col flex-shrink-0 border-r border-brand-border h-screen overflow-hidden">
      
      {/* HEADER */}
      <div className="px-5 pt-6 pb-5 border-b border-brand-border flex-shrink-0">
        <div className="text-[13px] font-bold tracking-[2.5px] uppercase text-brand-text">the private equity firm</div>
        <div className="text-xxs text-brand-muted tracking-[2px] uppercase mt-1">Intelligence Hub</div>
        <div className="w-7 h-0.5 bg-brand-green mt-3" />
      </div>

      {/* SCROLLABLE NAVIGATION */}
      <nav className="flex-1 overflow-y-auto py-3">
        {Object.entries(sections).map(([section, items]) => (
          <div key={section}>
            <div className="section-label px-5 pt-4 pb-1.5">{section}</div>
            {items.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <div key={item.path} className={`nav-item ${isActive ? 'active' : ''} cursor-pointer`}
                     onClick={() => navigate(item.path)}>
                  <Icon size={14} /><span>{item.label}</span>
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* FROZEN FOOTER: Now shows username text permanently alongside the toggle */}
      {user && (
        <div className="px-5 py-4 border-t border-brand-border flex-shrink-0 mt-auto bg-tb-surface z-10 flex items-center justify-between">
          
          {/* User Name Area */}
          <div className="flex flex-col overflow-hidden pr-2">
            <span className="text-sm font-medium text-brand-text truncate">
              {user.first_name} {user.last_name}
            </span>
          </div>

          {/* Theme Toggle Button */}
          <button onClick={toggleTheme}
            className="p-1.5 rounded hover:bg-[rgba(255,255,255,0.06)] text-brand-muted hover:text-tb-dim transition-colors flex-shrink-0"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          
        </div>
      )}
    </aside>
  );
}