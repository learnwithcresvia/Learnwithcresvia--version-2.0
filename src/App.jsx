import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ProfileCompletionPage from './pages/ProfileCompletionPage';
import StudentDashboard from './pages/StudentDashboard';
import TestAuthPage from './pages/TestAuthPage';
import NotFound from './pages/NotFound';

// Protected Route Component
function ProtectedRoute({ children, requireProfile = true }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f8f9fa'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid #e0e0e0',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p style={{ color: '#666' }}>Loading...</p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireProfile && !profile?.profile_completed) {
    return <Navigate to="/complete-profile" replace />;
  }

  return children;
}

// Public Route Component
function PublicRoute({ children }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (user) {
    if (!profile?.profile_completed) {
      return <Navigate to="/complete-profile" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
          
          {/* Profile Completion */}
          <Route 
            path="/complete-profile" 
            element={
              <ProtectedRoute requireProfile={false}>
                <ProfileCompletionPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Protected Routes - Dashboard */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <StudentDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Placeholder Routes (Coming Soon) */}
          <Route 
            path="/battle-arena" 
            element={
              <ProtectedRoute>
                <div style={{ 
                  padding: '4rem 2rem', 
                  textAlign: 'center',
                  minHeight: '100vh',
                  background: '#f8f9fa'
                }}>
                  <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚔️</h1>
                  <h2 style={{ marginBottom: '1rem' }}>Battle Arena</h2>
                  <p style={{ color: '#666', marginBottom: '2rem' }}>
                    Gamified coding challenges coming soon!
                  </p>
                  <a href="/dashboard" style={{
                    display: 'inline-block',
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    fontWeight: '600'
                  }}>
                    Back to Dashboard
                  </a>
                </div>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/practice-hub" 
            element={
              <ProtectedRoute>
                <div style={{ 
                  padding: '4rem 2rem', 
                  textAlign: 'center',
                  minHeight: '100vh',
                  background: '#f8f9fa'
                }}>
                  <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</h1>
                  <h2 style={{ marginBottom: '1rem' }}>Practice Hub</h2>
                  <p style={{ color: '#666', marginBottom: '2rem' }}>
                    Learning mode with hints and unlimited retries coming soon!
                  </p>
                  <a href="/dashboard" style={{
                    display: 'inline-block',
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    fontWeight: '600'
                  }}>
                    Back to Dashboard
                  </a>
                </div>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/leaderboard" 
            element={
              <ProtectedRoute>
                <div style={{ 
                  padding: '4rem 2rem', 
                  textAlign: 'center',
                  minHeight: '100vh',
                  background: '#f8f9fa'
                }}>
                  <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏆</h1>
                  <h2 style={{ marginBottom: '1rem' }}>Leaderboard</h2>
                  <p style={{ color: '#666', marginBottom: '2rem' }}>
                    Rankings and competitive features coming soon!
                  </p>
                  <a href="/dashboard" style={{
                    display: 'inline-block',
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    fontWeight: '600'
                  }}>
                    Back to Dashboard
                  </a>
                </div>
              </ProtectedRoute>
            } 
          />
          
          {/* Test Route */}
          <Route path="/test-auth" element={<TestAuthPage />} />
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
