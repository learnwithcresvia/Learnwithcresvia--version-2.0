// src/pages/LoginPage.jsx - FINAL CLEAN VERSION

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabaseClient';
import '../styles/auth.css';

// Route each role to its correct dashboard
function getDashboardRoute(role, profileCompleted) {
  if (!profileCompleted && role === 'STUDENT') return '/complete-profile';
  switch (role) {
    case 'ADMIN':       return '/admin';
    case 'DIRECTOR':    return '/director-dashboard';
    case 'HOD':         return '/hod-dashboard';
    case 'COORDINATOR': return '/coordinator-dashboard';
    case 'STAFF':       return '/staff-dashboard';
    default:            return '/dashboard';
  }
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate   = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields'); return; }

    setLoading(true);
    setError('');

    const { data, error: err } = await signIn(email, password);

    if (err) {
      setError(err.message.includes('Invalid') ? 'Wrong email or password.' : err.message);
      setLoading(false);
      return;
    }

    // Fetch profile by email to get role
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, profile_completed')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      const role      = profile?.role || 'STUDENT';
      const completed = profile?.profile_completed ?? false;
      console.log('Login role:', role, 'completed:', completed);
      navigate(getDashboardRoute(role, completed), { replace: true });
      return;
    } catch (e) {
      console.error('Profile fetch error:', e);
    }

    navigate('/dashboard', { replace: true });
  }

  return (
    <div className="auth-container">
      <div className="auth-wrapper">

        {/* Branding */}
        <div className="auth-brand">
          <div className="brand-content">
            <h1>🎓 LearnWithCresvia</h1>
            <p className="brand-tagline">College Learning & Coding Platform</p>
            <div className="brand-features">
              <div className="feature-item"><span className="feature-icon">✨</span><span>Interactive Coding Exercises</span></div>
              <div className="feature-item"><span className="feature-icon">📚</span><span>Comprehensive Course Materials</span></div>
              <div className="feature-item"><span className="feature-icon">🏆</span><span>Track Your Progress & XP</span></div>
              <div className="feature-item"><span className="feature-icon">⚔️</span><span>Battle Other Students</span></div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="auth-form-container">
          <div className="auth-form-wrapper">
            <div className="auth-header">
              <h2>Welcome Back</h2>
              <p>Sign in to continue your learning journey</p>
            </div>

            {error && (
              <div className="alert alert-error">
                <span className="alert-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                Don't have an account?{' '}
                <Link to="/signup" className="link-primary">Sign up for free</Link>
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
