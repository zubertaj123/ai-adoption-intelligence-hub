import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.login(email, password);
      login(data.user, data.access_token, data.refresh_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-tb-black">
      {/* Top accent bar */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-purple to-brand-green z-50" />

      <div className="w-full max-w-md">
        <div className="brand-card p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="text-2xl font-bold tracking-[3px] uppercase bg-gradient-to-r from-brand-purple to-brand-green bg-clip-text text-transparent">
              the private equity firm
            </div>
            <div className="text-sm text-brand-muted mt-2 tracking-[2px] uppercase">
              Intelligence Hub
            </div>
            <div className="w-12 h-0.5 bg-brand-green mx-auto mt-4" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="section-label block mb-2">Email</label>
              <input
                type="email"
                className="tb-input w-full"
                placeholder="your.email@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="mb-6">
              <label className="section-label block mb-2">Password</label>
              <input
                type="password"
                className="tb-input w-full"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="mb-4 p-3 rounded bg-[rgba(255,60,60,0.1)] border border-[rgba(255,60,60,0.25)] text-[#FF6060] text-xs">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="tb-btn w-full py-3 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Demo hint */}
          <div className="mt-6 pt-4 border-t border-brand-border">
            <div className="text-xxs text-brand-muted text-center">
              Default: admin@examplepe.com / TBAdmin2026!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
