import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';

export default function HomePage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
      {/* Navigation Bar */}
      <nav style={{
        padding: '1rem 2rem',
        background: 'white',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <h1 style={{ margin: 0, color: '#667eea', fontSize: '1.5rem' }}>
            🎓 LearnWithCresvia
          </h1>
        </Link>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {user ? (
            <>
              <span style={{ color: '#666' }}>{user.email}</span>
              <button
                onClick={handleSignOut}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                style={{
                  padding: '0.5rem 1rem',
                  background: 'white',
                  color: '#667eea',
                  border: '2px solid #667eea',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '0.9rem'
                }}
              >
                Login
              </Link>
              <Link
                to="/signup"
                style={{
                  padding: '0.5rem 1rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '0.9rem'
                }}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <div style={{ padding: '3rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '3rem', color: '#333', marginBottom: '1rem' }}>
            Welcome to LearnWithCresvia
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#666', maxWidth: '600px', margin: '0 auto' }}>
            Your ultimate platform for college learning and coding practice
          </p>
        </div>

        {/* Auth Status Card */}
        <div style={{
          maxWidth: '600px',
          margin: '0 auto 3rem',
          padding: '2rem',
          background: user ? '#d4edda' : '#fff3cd',
          border: `2px solid ${user ? '#c3e6cb' : '#ffeaa7'}`,
          borderRadius: '12px'
        }}>
          <h2 style={{ marginTop: 0 }}>
            {user ? '✅ You\'re Logged In!' : '👋 Welcome!'}
          </h2>
          
          {user ? (
            <div>
              <p><strong>Email:</strong> {user.email}</p>
              {profile && (
                <>
                  <p><strong>Role:</strong> {profile.role}</p>
                  <p><strong>XP:</strong> {profile.xp}</p>
                  <p><strong>Streak:</strong> {profile.streak} days</p>
                </>
              )}
              <p style={{ marginTop: '1.5rem', color: '#666' }}>
                Ready to start learning? Your dashboard is coming soon! 🚀
              </p>
            </div>
          ) : (
            <div>
              <p>Get started with LearnWithCresvia today!</p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <Link
                  to="/signup"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    textAlign: 'center',
                    fontSize: '1rem',
                    fontWeight: '500'
                  }}
                >
                  Create Account
                </Link>
                <Link
                  to="/login"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'white',
                    color: '#667eea',
                    border: '2px solid #667eea',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    textAlign: 'center',
                    fontSize: '1rem',
                    fontWeight: '500'
                  }}
                >
                  Sign In
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Features Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '2rem',
          marginTop: '3rem'
        }}>
          {[
            { icon: '💻', title: 'Interactive Coding', desc: 'Practice coding with real-time feedback' },
            { icon: '📚', title: 'Course Materials', desc: 'Access comprehensive learning resources' },
            { icon: '🏆', title: 'Track Progress', desc: 'Earn XP and maintain your streak' },
            { icon: '👥', title: 'Collaborate', desc: 'Learn together with your classmates' }
          ].map((feature, i) => (
            <div key={i} style={{
              padding: '2rem',
              background: 'white',
              borderRadius: '12px',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{feature.icon}</div>
              <h3 style={{ marginBottom: '0.5rem' }}>{feature.title}</h3>
              <p style={{ color: '#666', fontSize: '0.9rem' }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
