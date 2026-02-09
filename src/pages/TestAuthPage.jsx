import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function TestAuthPage() {
  const { user, profile, signIn, signUp, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await signUp(email, password);
      if (error) {
        setError(error.message);
      } else {
        setSuccess('Sign up successful! Please check your email to confirm your account.');
        setEmail('');
        setPassword('');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      } else {
        setSuccess('Sign in successful!');
        setEmail('');
        setPassword('');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Signin error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await signOut();
      if (error) {
        setError(error.message);
      } else {
        setSuccess('Signed out successfully!');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Signout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🧪 Authentication Test Page</h1>
      
      {/* Current Auth Status */}
      <div style={{ 
        padding: '1rem', 
        marginBottom: '2rem', 
        backgroundColor: user ? '#d4edda' : '#f8d7da',
        border: `1px solid ${user ? '#c3e6cb' : '#f5c6cb'}`,
        borderRadius: '4px'
      }}>
        <h3>Current Status:</h3>
        {user ? (
          <>
            <p>✅ <strong>Logged In</strong></p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>User ID:</strong> {user.id}</p>
            
            {/* Debug: Show profile state */}
            <hr style={{ margin: '1rem 0' }} />
            <p><strong>Profile Status:</strong> {profile ? '✅ Loaded' : '❌ Not Loaded'}</p>
            
            {profile ? (
              <>
                <p><strong>Name:</strong> {profile.name || '(not set)'}</p>
                <p><strong>Role:</strong> {profile.role || '(not set)'}</p>
                <p><strong>Department:</strong> {profile.department || '(not set)'}</p>
                <p><strong>Year:</strong> {profile.year || '(not set)'}</p>
                <p><strong>XP:</strong> {profile.xp ?? 0}</p>
                <p><strong>Streak:</strong> {profile.streak ?? 0}</p>
              </>
            ) : (
              <p style={{ color: '#856404', backgroundColor: '#fff3cd', padding: '0.5rem', borderRadius: '4px' }}>
                ⚠️ Profile not loaded. Check console for errors.
              </p>
            )}
            
            {/* Debug: Show raw profile object */}
            <details style={{ marginTop: '1rem' }}>
              <summary style={{ cursor: 'pointer', color: '#666' }}>
                🔍 View Raw Data (for debugging)
              </summary>
              <pre style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '1rem', 
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '12px'
              }}>
                {JSON.stringify({ user, profile }, null, 2)}
              </pre>
            </details>
            
            <button 
              onClick={handleSignOut}
              disabled={loading}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Signing out...' : 'Sign Out'}
            </button>
          </>
        ) : (
          <p>❌ <strong>Not Logged In</strong></p>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          color: '#721c24'
        }}>
          ❌ {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '4px',
          color: '#155724'
        }}>
          ✅ {success}
        </div>
      )}

      {/* Auth Forms */}
      {!user && (
        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: '1fr 1fr' }}>
          {/* Sign Up Form */}
          <div style={{ border: '1px solid #ddd', padding: '1.5rem', borderRadius: '8px' }}>
            <h2>Sign Up</h2>
            <form onSubmit={handleSignUp}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Email:
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Password:
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
                <small style={{ color: '#666' }}>Min 6 characters</small>
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '1rem'
                }}
              >
                {loading ? 'Signing up...' : 'Sign Up'}
              </button>
            </form>
          </div>

          {/* Sign In Form */}
          <div style={{ border: '1px solid #ddd', padding: '1.5rem', borderRadius: '8px' }}>
            <h2>Sign In</h2>
            <form onSubmit={handleSignIn}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Email:
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Password:
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '1rem'
                }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
        <h3>📝 Testing Instructions:</h3>
        <ol style={{ marginLeft: '1.5rem' }}>
          <li>Use the <strong>Sign Up</strong> form to create a new account</li>
          <li>Check your email for a confirmation link from Supabase</li>
          <li>Click the confirmation link to activate your account</li>
          <li>Use the <strong>Sign In</strong> form to log in</li>
          <li>Check the status box above to see your profile data</li>
          <li>Open browser console (F12) to see detailed logs</li>
        </ol>
      </div>
    </div>
  );
}
