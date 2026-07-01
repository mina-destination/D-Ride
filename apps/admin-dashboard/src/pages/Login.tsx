import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/d-ride-logo.jpeg';
import { Lock, Key } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass">
        <div className="login-header">
          <img src={logo} alt="D-Ride" className="login-logo" />
          <h2>Admin Dashboard</h2>
          <p>Sign in to manage operations</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@dride.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="login-btn cursor-pointer transition-all duration-200" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loading ? (
              <>Signing in...</>
            ) : (
              <>
                <Lock size={16} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        {import.meta.env.DEV && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'var(--surface-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border)',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '0.4rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={14} />
              <span>Demo Credentials:</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 0.5rem' }}>
              <span><strong>Owner:</strong></span>
              <span>owner@dride.com / owner123</span>
              <span><strong>Admin:</strong></span>
              <span>admin@dride.com / admin123</span>
            </div>
          </div>
        )}

        <div className="login-footer-text">
          Operated by Destination © 2026
        </div>
      </div>
    </div>
  );
}
