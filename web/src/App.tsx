import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, ProtectedRoute, useAuth } from './auth/AuthProvider';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ItemsPage } from './pages/ItemsPage';
import { ItemDetailPage } from './pages/ItemDetailPage';

function Navigation() {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  return (
    <header
      style={{
        backgroundColor: '#1f2937',
        color: '#fff',
        padding: '0.75rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #374151',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.025em' }}>
          Operations Under Pressure
        </span>
        <nav style={{ display: 'flex', gap: '1rem' }}>
          <Link
            to="/dashboard"
            style={{
              color: location.pathname === '/dashboard' ? '#60a5fa' : '#d1d5db',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: '0.9rem',
            }}
          >
            Dashboard
          </Link>
          <Link
            to="/items"
            style={{
              color: location.pathname.startsWith('/items') ? '#60a5fa' : '#d1d5db',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: '0.9rem',
            }}
          >
            Work Items
          </Link>
        </nav>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.85rem' }}>
        <span>
          <strong>{user.name}</strong> <span style={{ color: '#9ca3af' }}>({user.email})</span>
        </span>
        <button
          onClick={logout}
          style={{
            padding: '0.35rem 0.75rem',
            backgroundColor: '#374151',
            color: '#e5e7eb',
            border: '1px solid #4b5563',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}

function LoginWrapper() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div style={{ padding: '2rem' }}>Loading...</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

export function App() {
  return (
    <AuthProvider>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb' }}>
        <Navigation />
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/login" element={<LoginWrapper />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/items"
              element={
                <ProtectedRoute>
                  <ItemsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/items/:id"
              element={
                <ProtectedRoute>
                  <ItemDetailPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}
