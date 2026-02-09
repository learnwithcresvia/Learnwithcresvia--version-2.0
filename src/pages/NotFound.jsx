import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f8f9fa',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <div>
        <h1 style={{ fontSize: '6rem', margin: 0, color: '#667eea' }}>404</h1>
        <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#333' }}>Page Not Found</h2>
        <p style={{ color: '#666', marginBottom: '2rem' }}>
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          style={{
            display: 'inline-block',
            padding: '0.75rem 2rem',
            background: '#667eea',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '500'
          }}
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
