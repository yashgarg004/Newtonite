import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ErrorBanner } from '../components/ErrorBanner';
import { ApiError } from '../api/client';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('alice@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<ApiError | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '4rem auto', padding: '2rem', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: 0 }}>Operations Under Pressure</h2>
      <p style={{ color: '#4b5563', fontSize: '0.9rem' }}>Sign in with seeded user credentials to access the operations console.</p>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 500, fontSize: '0.9rem' }}>
          Email:
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', border: '1px solid #d1d5db', borderRadius: '4px' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 500, fontSize: '0.9rem' }}>
          Password:
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', border: '1px solid #d1d5db', borderRadius: '4px' }} />
        </label>
        <button type="submit" disabled={isPending} style={{ padding: '0.75rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: isPending ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
          {isPending ? 'Logging in...' : 'Sign In'}
        </button>
      </form>
      <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
        <strong>Seeded Test Users (password: password123):</strong>
        <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0 0' }}>
          <li><code>alice@example.com</code> (Admin)</li>
          <li><code>bob@example.com</code> (Lead)</li>
          <li><code>charlie@example.com</code> (Member)</li>
          <li><code>diana@example.com</code> (Viewer)</li>
        </ul>
      </div>
    </div>
  );
}