// src/pages/RoleRouter.jsx
// Automatically routes users to the right dashboard based on their role

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RoleRouter() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    const role = profile?.role || 'STUDENT';
    const routes = {
      STUDENT:     '/dashboard',
      STAFF:       '/staff-dashboard',
      COORDINATOR: '/coordinator-dashboard',
      HOD:         '/hod-dashboard',
      ADMIN:       '/admin',
    };
    navigate(routes[role] || '/dashboard', { replace: true });
  }, [profile, loading]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <p>Redirecting...</p>
    </div>
  );
}
