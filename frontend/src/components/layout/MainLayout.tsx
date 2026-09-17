import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function MainLayout() {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden bg-tb-black">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-tb-black">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 bg-tb-black">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
