import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';

export default function EmailVerification() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error

  useEffect(() => {
    verifyEmail();
  }, []);

  const verifyEmail = async () => {
    try {
      // Get token from URL
      const token = searchParams.get('token');
      const type = searchParams.get('type');

      if (!token) {
        setStatus('error');
        return;
      }

      // Verify the token
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: type || 'email',
      });

      if (error) {
        console.error('Verification error:', error);
        setStatus('error');
        return;
      }

      // Success!
      setStatus('success');
      
      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);

    } catch (error) {
      console.error('Error:', error);
      setStatus('error');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <div style={{
        background: 'white',
        padding: '3rem',
        borderRadius: '12px',
        textAlign: 'center',
        maxWidth: '500px',
      }}>
        {status === 'verifying' && (
          <>
            <div style={{ fontSize: '4rem' }}>⏳</div>
            <h2>Verifying your email...</h2>
            <p style={{ color: '#666' }}>Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '4rem' }}>✅</div>
            <h2>Email Verified!</h2>
            <p style={{ color: '#666' }}>
              Your account is now active.<br/>
              Redirecting to dashboard...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '4rem' }}>❌</div>
            <h2>Verification Failed</h2>
            <p style={{ color: '#666' }}>
              The verification link may be invalid or expired.
            </p>
            <button 
              onClick={() => navigate('/login')}
              style={{
                marginTop: '1rem',
                padding: '0.75rem 2rem',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}