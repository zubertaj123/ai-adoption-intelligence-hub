import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/api/client';
import MainLayout from '@/components/layout/MainLayout';
import LoginPage from '@/pages/Login';
import DashboardPage from '@/pages/Dashboard';
import CompaniesPage from '@/pages/Companies';
import ToolInventoryPage from '@/pages/ToolInventory';
import UploadPage from '@/pages/Upload';
import BoardReportPage from '@/pages/BoardReport';
import GovernancePage from '@/pages/Governance';
import TTVPage from '@/pages/TTV';
import ChartsPage from '@/pages/Charts';
import UsersPage from '@/pages/Users';
import AuditPage from '@/pages/Audit';
import MetricsFrameworkPage from '@/pages/MetricsFramework';
import SettingsPage from '@/pages/Settings';

function RoleGuard({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { user } = useAuthStore();
  if (!user || !roles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="brand-card text-center p-10">
          <div className="text-xl text-brand-red mb-2">Access Denied</div>
          <div className="text-sm text-brand-muted">You don't have permission to view this page.</div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setUser, logout } = useAuthStore();
  useEffect(() => {
    if (isAuthenticated) {
      authApi.me().then((res) => setUser(res.data)).catch(() => logout());
    }
  }, []);
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthBootstrap>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<MainLayout />}>
            {/* All roles */}
            <Route path="/" element={<DashboardPage />} />
            <Route path="/tools" element={<ToolInventoryPage />} />
            <Route path="/governance" element={<GovernancePage />} />
            <Route path="/ttv" element={<TTVPage />} />
            <Route path="/metrics" element={<MetricsFrameworkPage />} />
            <Route path="/charts" element={<ChartsPage />} />
            <Route path="/board-report" element={<BoardReportPage />} />

            {/* TB Admin + TB User */}
            <Route path="/companies" element={
              <RoleGuard roles={['tb_admin', 'tb_user']}><CompaniesPage /></RoleGuard>
            } />
            <Route path="/audit" element={
              <RoleGuard roles={['tb_admin', 'tb_user']}><AuditPage /></RoleGuard>
            } />

            {/* TB Admin + Company User */}
            <Route path="/upload" element={
              <RoleGuard roles={['tb_admin', 'company_user']}><UploadPage /></RoleGuard>
            } />

            {/* TB Admin only */}
            <Route path="/users" element={
              <RoleGuard roles={['tb_admin']}><UsersPage /></RoleGuard>
            } />
            <Route path="/settings" element={
              <RoleGuard roles={['tb_admin']}><SettingsPage /></RoleGuard>
            } />

            {/* Redirect old adoption route */}
            <Route path="/adoption" element={<Navigate to="/metrics" replace />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthBootstrap>
    </BrowserRouter>
  );
}