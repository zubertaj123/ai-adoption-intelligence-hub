import { useAuthStore } from '@/stores/authStore';
import { LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Command Center',
  '/companies': 'Portfolio Companies',
  '/governance': 'Governance Council',
  '/tools': 'Tool Inventory',
  '/ttv': 'Time to Value',
  '/metrics': 'Metrics Framework',
  '/charts': 'Graphs & Visuals',
  '/board-report': 'Board Report',
  '/upload': 'Upload Data',
  '/users': 'User Management',
  '/audit': 'Audit Log',
  '/settings': 'Settings',
};

export default function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();

  const title = PAGE_TITLES[location.pathname] || 'Intelligence Hub';
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="bg-tb-surface border-b border-brand-border px-7 flex items-center justify-between sticky top-0.5 z-10 h-[54px] flex-shrink-0">
      <div>
        <div className="text-[11px] font-bold tracking-[2px] uppercase text-brand-text">{title}</div>
        <div className="text-xxs text-brand-muted mt-0.5">Centralized AI Intelligence across the the private equity firm portfolio</div>
      </div>
      <div className="flex items-center gap-3.5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-brand-green rounded-full animate-pulse-dot" />
          <span className="text-xxs text-brand-muted">
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <button onClick={handleLogout} className="text-brand-muted hover:text-brand-red transition-colors" title="Logout">
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}