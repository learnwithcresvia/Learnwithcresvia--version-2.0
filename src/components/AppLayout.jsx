// src/components/AppLayout.jsx
// Global sidebar nav — wraps every authenticated page.
// Drop-in: just wrap page content with <AppLayout> in App.jsx.

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme, ThemeToggle } from '../hooks/useTheme';

const STAFF_ROLES = ['ADMIN', 'DIRECTOR', 'HOD', 'STAFF', 'COORDINATOR'];

// ── Nav items per role ────────────────────────────────────────────────────────
function getNavItems(role) {
  const student = [
    { icon: '🏠', label: 'Dashboard',    to: '/dashboard' },
    { icon: '📖', label: 'Study Hub',    to: '/study-hub' },
    { icon: '💻', label: 'Practice',     to: '/practice-hub' },
    { icon: '⚔️', label: 'Battle',       to: '/battle-arena' },
    { icon: '🏆', label: 'Leaderboard',  to: '/leaderboard' },
    { icon: '📢', label: 'Notices',      to: '/announcements' },
  ];
  const staff = [
    { icon: '📊', label: 'Dashboard',    to: role === 'HOD' ? '/hod-dashboard' : '/staff-dashboard' },
    { icon: '📚', label: 'Study Hub',    to: '/study-hub/manage' },
    { icon: '🤖', label: 'AI Generate',  to: '/ai-question-generator' },
    { icon: '📢', label: 'Notices',      to: '/announcements' },
  ];
  const admin = [
    { icon: '👑', label: 'Admin',        to: '/admin' },
    { icon: '📚', label: 'Study Hub',    to: '/study-hub/manage' },
    { icon: '🤖', label: 'AI Generate',  to: '/ai-question-generator' },
    { icon: '📢', label: 'Notices',      to: '/announcements' },
  ];
  const director = [
    { icon: '📈', label: 'Dashboard',    to: '/director-dashboard' },
    { icon: '📚', label: 'Study Hub',    to: '/study-hub/manage' },
    { icon: '📢', label: 'Notices',      to: '/announcements' },
  ];

  if (role === 'ADMIN')    return admin;
  if (role === 'DIRECTOR') return director;
  if (STAFF_ROLES.includes(role)) return staff;
  return student;
}

export default function AppLayout({ children }) {
  const { user, profile, signOut } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [expanded,     setExpanded]     = useState(false);
  const [profileOpen,  setProfileOpen]  = useState(false);
  const profileRef = useRef(null);

  // Close profile popover on outside click
  useEffect(() => {
    function handler(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleSignOut() {
    try { await Promise.race([signOut(), new Promise(r => setTimeout(r, 1500))]); } catch {}
    window.location.href = '/login';
  }

  if (!user || !profile) return <>{children}</>;

  const navItems = getNavItems(profile.role);
  const W = expanded ? 220 : 52;

  // ── Colours ──────────────────────────────────────────────────────────────────
  const bg      = isDark ? '#141720' : '#ffffff';
  const border  = isDark ? '#1e2433' : '#e5e7eb';
  const textPri = isDark ? '#e2e8f0' : '#1e293b';
  const textMut = isDark ? '#4a5568' : '#94a3b8';
  const hover   = isDark ? 'rgba(102,126,234,0.1)' : 'rgba(79,70,229,0.07)';
  const active  = isDark ? 'rgba(102,126,234,0.18)' : 'rgba(79,70,229,0.12)';
  const activeC = '#667eea';

  const initials = (profile.name || profile.email || '?')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const roleColors = {
    STUDENT: '#48bb78', STAFF: '#667eea', HOD: '#9f7aea',
    COORDINATOR: '#ed8936', ADMIN: '#f56565', DIRECTOR: '#38b2ac',
  };
  const roleColor = roleColors[profile.role] || '#667eea';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: isDark ? '#0f1117' : '#f8fafc' }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: W, minHeight: '100vh', background: bg, borderRight: `1px solid ${border}`,
        display: 'flex', flexDirection: 'column', position: 'fixed', left: 0, top: 0, bottom: 0,
        zIndex: 40, transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden', flexShrink: 0,
      }}>

        {/* Logo / Toggle */}
        <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: `1px solid ${border}`, flexShrink: 0, gap: 10, cursor: 'pointer' }}
          onClick={() => setExpanded(e => !e)}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>🎓</div>
          {expanded && <span style={{ color: textPri, fontWeight: 800, fontSize: '0.9rem', whiteSpace: 'nowrap', fontFamily: '"Inter",Arial,sans-serif' }}>LearnWithCresvia</span>}
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '8px 6px', overflowY: 'auto', overflowX: 'hidden' }}>
          {navItems.map(item => {
            const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
            return (
              <Link key={item.to} to={item.to}
                title={!expanded ? item.label : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                  borderRadius: 9, marginBottom: 2, textDecoration: 'none', transition: 'all 0.15s',
                  background: isActive ? active : 'transparent',
                  color: isActive ? activeC : textMut,
                  fontWeight: isActive ? 700 : 500,
                }
                }
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = hover; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '1.1rem', flexShrink: 0, width: 24, textAlign: 'center', lineHeight: 1 }}>{item.icon}</span>
                {expanded && <span style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', fontFamily: '"Inter",Arial,sans-serif' }}>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom — Theme + Profile */}
        <div style={{ padding: '8px 6px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>

          {/* Theme toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 4, borderRadius: 9, cursor: 'pointer' }}
            title={!expanded ? (isDark ? 'Light mode' : 'Dark mode') : undefined}>
            <ThemeToggle style={{ padding: 0, background: 'none', border: 'none', fontSize: '1.1rem', width: 24, textAlign: 'center' }} />
            {expanded && <span style={{ fontSize: '0.82rem', color: textMut, fontFamily: '"Inter",Arial,sans-serif', whiteSpace: 'nowrap' }}>{isDark ? 'Light mode' : 'Dark mode'}</span>}
          </div>

          {/* Profile button */}
          <div ref={profileRef} style={{ position: 'relative' }}>
            <div onClick={() => setProfileOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, cursor: 'pointer', background: profileOpen ? active : 'transparent', transition: 'all 0.15s' }}
              onMouseEnter={e => { if (!profileOpen) e.currentTarget.style.background = hover; }}
              onMouseLeave={e => { if (!profileOpen) e.currentTarget.style.background = profileOpen ? active : 'transparent'; }}
              title={!expanded ? (profile.name || profile.email) : undefined}
            >
              {/* Avatar */}
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg,${roleColor},${roleColor}aa)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0, border: `2px solid ${roleColor}40` }}>
                {initials}
              </div>
              {expanded && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: textPri, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: '"Inter",Arial,sans-serif' }}>
                    {profile.name || 'User'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: roleColor, fontWeight: 600, fontFamily: '"Inter",Arial,sans-serif' }}>{profile.role}</div>
                </div>
              )}
            </div>

            {/* Profile popover */}
            {profileOpen && (
              <div style={{
                position: 'absolute', bottom: '110%', left: 6, width: 230,
                background: bg, border: `1px solid ${border}`, borderRadius: 14,
                boxShadow: '0 8px 32px rgba(0,0,0,0.25)', overflow: 'hidden', zIndex: 100,
              }}>
                {/* Header */}
                <div style={{ padding: '1rem', background: `linear-gradient(135deg,${roleColor}18,${roleColor}08)`, borderBottom: `1px solid ${border}` }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg,${roleColor},${roleColor}aa)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1rem', fontWeight: 800, margin: '0 0 0.6rem' }}>
                    {initials}
                  </div>
                  <div style={{ fontWeight: 700, color: textPri, fontSize: '0.9rem', fontFamily: '"Inter",Arial,sans-serif' }}>{profile.name || '—'}</div>
                  <div style={{ fontSize: '0.75rem', color: textMut, fontFamily: '"Inter",Arial,sans-serif' }}>{profile.email}</div>
                  <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ background: roleColor + '20', color: roleColor, padding: '1px 8px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700 }}>{profile.role}</span>
                    {profile.department && <span style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', color: textMut, padding: '1px 8px', borderRadius: 20, fontSize: '0.68rem' }}>{profile.department}</span>}
                    {profile.year && <span style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', color: textMut, padding: '1px 8px', borderRadius: 20, fontSize: '0.68rem' }}>Year {profile.year}</span>}
                  </div>
                </div>

                {/* Stats (student only) */}
                {profile.role === 'STUDENT' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: `1px solid ${border}` }}>
                    {[
                      { label: 'XP', value: profile.xp || 0 },
                      { label: 'Solved', value: profile.challenges_completed || 0 },
                      { label: 'Battles', value: profile.battles_won || 0 },
                    ].map(s => (
                      <div key={s.label} style={{ padding: '0.75rem 0.5rem', textAlign: 'center', borderRight: `1px solid ${border}` }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: textPri, fontFamily: '"Inter",Arial,sans-serif' }}>{s.value}</div>
                        <div style={{ fontSize: '0.65rem', color: textMut }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div style={{ padding: '0.5rem' }}>
                  <button onClick={handleSignOut}
                    style={{ width: '100%', padding: '0.6rem', background: 'rgba(245,101,101,0.1)', color: '#f56565', border: '1px solid rgba(245,101,101,0.2)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', fontFamily: '"Inter",Arial,sans-serif' }}>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Page content — offset by sidebar width ── */}
      <div style={{ marginLeft: W, flex: 1, minWidth: 0, transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)' }}>
        {children}
      </div>

      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 2px; }
      `}</style>
    </div>
  );
}
