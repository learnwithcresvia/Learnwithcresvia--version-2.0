// src/pages/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabaseClient';

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [users,    setUsers]    = useState([]);
  const [stats,    setStats]    = useState({ total: 0, students: 0, staff: 0, admins: 0 });
  const [activity, setActivity] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('overview');
  const [changing, setChanging] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      // All users
      const { data: allUsers } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      const users = allUsers || [];
      setUsers(users);
      setStats({
        total:    users.length,
        students: users.filter(u => u.role === 'STUDENT').length,
        staff:    users.filter(u => ['STAFF','COORDINATOR','HOD'].includes(u.role)).length,
        admins:   users.filter(u => u.role === 'ADMIN').length,
      });

      // Recent activity from activity_logs if exists, else fake from profiles
      const { data: logs } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      setActivity(logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(userId, newRole) {
    setChanging(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);
    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }
    setChanging(null);
  }

  async function handleSignOut() {
    try {
      await Promise.race([
        signOut(),
        new Promise(r => setTimeout(r, 1500))
      ]);
    } catch {}
    window.location.href = '/login';
  }

  const ROLES = ['STUDENT', 'STAFF', 'COORDINATOR', 'HOD', 'ADMIN'];
  const ROLE_COLORS = {
    STUDENT: '#6366F1', STAFF: '#16A34A',
    COORDINATOR: '#D97706', HOD: '#DC2626', ADMIN: '#7C3AED',
  };

  const tabStyle = (t) => ({
    padding: '0.6rem 1.5rem', border: 'none', borderRadius: 8,
    cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
    background: tab === t ? '#6366F1' : 'white',
    color:      tab === t ? 'white'   : '#6B7280',
    transition: 'all 0.2s',
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ width: 40, height: 40, border: '4px solid #e0e0e0', borderTop: '4px solid #6366F1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ color: '#999' }}>Loading admin dashboard...</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4FF', fontFamily: 'Arial, sans-serif' }}>

      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
        <div>
          <h1 style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: 800 }}>
            🛡️ Admin Portal
          </h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem' }}>
            LearnWithCresvia — Full Platform Control
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'white', fontWeight: 500 }}>{profile?.name || profile?.email}</span>
          <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '2px 10px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700 }}>ADMIN</span>
          <button onClick={handleSignOut} style={{ padding: '0.5rem 1.25rem', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            Sign Out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1400, margin: '2rem auto', padding: '0 2rem' }}>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
          {[
            { label: 'Total Users',    value: stats.total,    icon: '👥', color: '#EEF2FF', accent: '#6366F1' },
            { label: 'Students',       value: stats.students, icon: '🎓', color: '#F0FDF4', accent: '#16A34A' },
            { label: 'Staff / HOD',    value: stats.staff,    icon: '👨‍🏫', color: '#FFFBEB', accent: '#D97706' },
            { label: 'Admins',         value: stats.admins,   icon: '🛡️', color: '#FDF4FF', accent: '#7C3AED' },
          ].map((s, i) => (
            <div key={i} style={{ background: s.color, borderRadius: 14, padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${s.accent}` }}>
              <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>{s.icon}</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#1F2937' }}>{s.value}</div>
              <div style={{ color: '#6B7280', fontSize: '0.85rem', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'white', padding: '0.5rem', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', width: 'fit-content' }}>
          {['overview', 'users', 'activity'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>
              {t === 'overview' ? '📊 Overview' : t === 'users' ? '👥 Users' : '📋 Activity'}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

            {/* Role breakdown */}
            <div style={{ background: 'white', borderRadius: 14, padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 1.25rem', color: '#1F2937', fontSize: '1.1rem' }}>👥 Users by Role</h3>
              {ROLES.map(role => {
                const count = users.filter(u => u.role === role).length;
                const pct   = users.length ? Math.round((count / users.length) * 100) : 0;
                return (
                  <div key={role} style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <span style={{ fontWeight: 600, color: ROLE_COLORS[role], fontSize: '0.9rem' }}>{role}</span>
                      <span style={{ color: '#6B7280', fontSize: '0.85rem' }}>{count} users ({pct}%)</span>
                    </div>
                    <div style={{ background: '#F3F4F6', borderRadius: 10, height: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 10, width: `${pct}%`, background: ROLE_COLORS[role], transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Department breakdown */}
            <div style={{ background: 'white', borderRadius: 14, padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 1.25rem', color: '#1F2937', fontSize: '1.1rem' }}>🏛️ Students by Department</h3>
              {['CSE','ECE','EEE','MECH','CIVIL','IT','AI-ML'].map(dept => {
                const count = users.filter(u => u.role === 'STUDENT' && u.department === dept).length;
                if (count === 0) return null;
                const students = users.filter(u => u.role === 'STUDENT');
                const pct = students.length ? Math.round((count / students.length) * 100) : 0;
                return (
                  <div key={dept} style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{dept}</span>
                      <span style={{ color: '#6B7280', fontSize: '0.85rem' }}>{count}</span>
                    </div>
                    <div style={{ background: '#F3F4F6', borderRadius: 10, height: 8 }}>
                      <div style={{ height: '100%', borderRadius: 10, width: `${pct}%`, background: 'linear-gradient(90deg,#6366F1,#7C3AED)' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Top students */}
            <div style={{ background: 'white', borderRadius: 14, padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', gridColumn: '1 / -1' }}>
              <h3 style={{ margin: '0 0 1.25rem', color: '#1F2937', fontSize: '1.1rem' }}>🏆 Top Students by XP</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '1rem' }}>
                {users.filter(u => u.role === 'STUDENT').sort((a,b) => (b.xp||0)-(a.xp||0)).slice(0,5).map((s,i) => (
                  <div key={s.id} style={{ background: '#F9FAFB', borderRadius: 10, padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem' }}>{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: '0.25rem', color: '#1F2937' }}>{s.name || 'Unknown'}</div>
                    <div style={{ color: '#6B7280', fontSize: '0.78rem' }}>{s.department}</div>
                    <div style={{ marginTop: '0.5rem', background: '#FEF3C7', color: '#D97706', padding: '2px 8px', borderRadius: 20, fontSize: '0.82rem', fontWeight: 700 }}>⭐ {s.xp||0} XP</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#1F2937' }}>All Platform Users</h3>
              <span style={{ color: '#6B7280', fontSize: '0.85rem' }}>{users.length} total</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {['Name', 'Email', 'Department', 'XP', 'Current Role', 'Change Role'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#6B7280', fontWeight: 600, fontSize: '0.85rem', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#1F2937' }}>{u.name || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#6B7280', fontSize: '0.85rem' }}>{u.email}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#6B7280' }}>{u.department || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ background: '#FEF3C7', color: '#D97706', padding: '2px 8px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600 }}>⭐ {u.xp||0}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ background: `${ROLE_COLORS[u.role]}20`, color: ROLE_COLORS[u.role], padding: '3px 10px', borderRadius: 20, fontSize: '0.82rem', fontWeight: 700 }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <select
                          value={u.role}
                          disabled={changing === u.id}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          style={{ padding: '0.3rem 0.6rem', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: '0.85rem', cursor: 'pointer', background: 'white' }}
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {changing === u.id && <span style={{ marginLeft: '0.5rem', color: '#6B7280', fontSize: '0.8rem' }}>Saving...</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {tab === 'activity' && (
          <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E5E7EB' }}>
              <h3 style={{ margin: 0 }}>Recent Activity</h3>
            </div>
            {activity.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                <p>No activity logs yet. Activity will appear here as users interact with the platform.</p>
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#9CA3AF' }}>
                  Current users: {users.map(u => u.name || u.email).join(', ')}
                </p>
              </div>
            ) : (
              <div style={{ padding: '1rem' }}>
                {activity.map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.75rem', borderBottom: '1px solid #F3F4F6', alignItems: 'flex-start' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                      {log.activity_type?.includes('login') ? '🔐' : log.activity_type?.includes('practice') ? '💻' : log.activity_type?.includes('battle') ? '⚔️' : '📌'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: '0.9rem', color: '#1F2937' }}>{log.activity_type}</div>
                      <div style={{ color: '#6B7280', fontSize: '0.8rem' }}>{JSON.stringify(log.details)}</div>
                    </div>
                    <div style={{ color: '#9CA3AF', fontSize: '0.78rem', flexShrink: 0 }}>
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
