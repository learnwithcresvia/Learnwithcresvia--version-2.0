// src/pages/HODDashboard.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabaseClient';

export default function HODDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [tab,           setTab]           = useState('overview');
  const [students,      setStudents]      = useState([]);
  const [staff,         setStaff]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [announcement,  setAnnouncement]  = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [sending,       setSending]       = useState(false);
  const [changingRole,  setChangingRole]  = useState(null);

  useEffect(() => { if (profile) { loadData(); loadAnnouncements(); } else setLoading(false); }, [profile]);

  async function loadData() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('department', profile.department)
      .neq('role', 'ADMIN')
      .neq('role', 'HOD');
    const all = data || [];
    setStudents(all.filter(u => u.role === 'STUDENT').sort((a,b) => (b.xp||0)-(a.xp||0)));
    setStaff(all.filter(u => ['STAFF','COORDINATOR'].includes(u.role)));
    setLoading(false);
  }

  async function loadAnnouncements() {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('department', profile.department)
      .order('created_at', { ascending: false })
      .limit(15);
    setAnnouncements(data || []);
  }

  async function handleStaffRoleChange(userId, newRole) {
    setChangingRole(userId);
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    setStaff(prev => prev.map(s => s.id === userId ? { ...s, role: newRole } : s));
    setChangingRole(null);
  }

  async function handleRemoveStudent(studentId) {
    if (!window.confirm('Remove this student from your department?')) return;
    await supabase.from('profiles').update({ department: null }).eq('id', studentId);
    setStudents(prev => prev.filter(s => s.id !== studentId));
  }

  async function handleSendAnnouncement() {
    if (!announcement.trim()) return;
    setSending(true);
    await supabase.from('announcements').insert({
      message: announcement.trim(),
      department: profile.department,
      sent_by: profile.name || profile.email,
      role: profile.role,
    });
    setAnnouncement('');
    await loadAnnouncements();
    setSending(false);
  }

  async function handleSignOut() {
    try { await Promise.race([signOut(), new Promise(r => setTimeout(r, 1500))]); } catch {}
    window.location.href = '/login';
  }

  const avgXP       = students.length ? Math.round(students.reduce((a,s) => a+(s.xp||0),0)/students.length) : 0;
  const totalSolved  = students.reduce((a,s) => a+(s.challenges_completed||0), 0);
  const totalBattles = students.reduce((a,s) => a+(s.battles_won||0), 0);
  const filtered     = students.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()));

  const C = {
    page:  { minHeight: '100vh', background: '#F0F4FF', fontFamily: 'Arial, sans-serif' },
    card:  { background: 'white', borderRadius: 14, padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' },
    th:    { padding: '0.75rem 1rem', textAlign: 'left', color: '#6B7280', fontWeight: 600, fontSize: '0.82rem', borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' },
    td:    { padding: '0.75rem 1rem', fontSize: '0.88rem', borderBottom: '1px solid #F3F4F6', color: '#374151' },
    badge: (color) => ({ background: color+'20', color, padding: '2px 10px', borderRadius: 20, fontWeight: 700, fontSize: '0.78rem' }),
    input: { width: '100%', padding: '0.6rem 0.9rem', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' },
    btn:   (color) => ({ padding: '0.55rem 1.1rem', background: color, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }),
  };

  const tabBtn = (t) => ({
    padding: '0.55rem 1.1rem', border: 'none', borderRadius: 8, cursor: 'pointer',
    fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.15s',
    background: tab === t ? '#667eea' : 'transparent',
    color:      tab === t ? 'white'   : '#6B7280',
  });

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}><p>Loading...</p></div>;

  return (
    <div style={C.page}>

      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, color: 'white', fontSize: '1.4rem', fontWeight: 800 }}>🏛️ HOD Dashboard</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem' }}>
            {profile?.department} — Head of Department · {profile?.name}
          </p>
        </div>
        <button onClick={handleSignOut} style={{ padding: '0.5rem 1.25rem', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          Sign Out
        </button>
      </header>

      <div style={{ maxWidth: 1350, margin: '2rem auto', padding: '0 2rem' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '1rem', marginBottom: '1.75rem' }}>
          {[
            { label: 'Students',     value: students.length, icon: '👥', color: '#6366F1' },
            { label: 'Staff',        value: staff.length,    icon: '👨‍🏫', color: '#16A34A' },
            { label: 'Avg XP',       value: avgXP,           icon: '⭐', color: '#D97706' },
            { label: 'Total Solved', value: totalSolved,     icon: '✅', color: '#0891B2' },
            { label: 'Battles Won',  value: totalBattles,    icon: '⚔️', color: '#DC2626' },
          ].map((s,i) => (
            <div key={i} style={{ ...C.card, borderLeft: `4px solid ${s.color}`, display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.1rem' }}>
              <span style={{ fontSize: '1.8rem' }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1F2937' }}>{s.value}</div>
                <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', background: 'white', padding: '0.4rem', borderRadius: 10, width: 'fit-content', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {[
            { key: 'overview',      label: '📊 Overview' },
            { key: 'students',      label: '👥 Students' },
            { key: 'staff',         label: '👨‍🏫 Staff' },
            { key: 'progress',      label: '💻 Practice' },
            { key: 'battles',       label: '⚔️ Battles' },
            { key: 'announcements', label: '📢 Announce' },
          ].map(t => <button key={t.key} onClick={() => setTab(t.key)} style={tabBtn(t.key)}>{t.label}</button>)}
        </div>

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={C.card}>
              <h3 style={{ margin: '0 0 1rem' }}>📊 Year Distribution</h3>
              {[1,2,3,4].map(yr => {
                const count = students.filter(s => s.year === yr).length;
                const pct   = students.length ? Math.round((count/students.length)*100) : 0;
                return (
                  <div key={yr} style={{ marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 500 }}>Year {yr}</span>
                      <span style={{ color: '#6B7280' }}>{count} students ({pct}%)</span>
                    </div>
                    <div style={{ background: '#F3F4F6', borderRadius: 10, height: 10 }}>
                      <div style={{ height: '100%', borderRadius: 10, width: `${pct}%`, background: 'linear-gradient(90deg,#4F46E5,#7C3AED)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={C.card}>
              <h3 style={{ margin: '0 0 1rem' }}>🏆 Top 5 Students</h3>
              {students.slice(0,5).map((s,i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: i<4?'1px solid #F3F4F6':'none' }}>
                  <span style={{ fontSize: '1.1rem' }}>{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{s.name||'—'}</div>
                    <div style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>Year {s.year} · {s.challenges_completed||0} solved</div>
                  </div>
                  <span style={C.badge('#D97706')}>⭐ {s.xp||0}</span>
                </div>
              ))}
              {students.length === 0 && <p style={{ color: '#9CA3AF', textAlign: 'center' }}>No students yet</p>}
            </div>
          </div>
        )}

        {/* ── Students ── */}
        {tab === 'students' && (
          <div style={C.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>All Students — {profile?.department} ({filtered.length})</h3>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search..." style={{ ...C.input, width: 240 }} />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Rank','Name','Email','Year','XP','Solved','Battles','Action'].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((s,i) => (
                  <tr key={s.id} style={{ background: i%2===0?'white':'#F9FAFB' }}>
                    <td style={C.td}>{i<3?['🥇','🥈','🥉'][i]:`#${i+1}`}</td>
                    <td style={{ ...C.td, fontWeight: 600 }}>{s.name||'—'}</td>
                    <td style={{ ...C.td, color: '#6B7280', fontSize: '0.8rem' }}>{s.email}</td>
                    <td style={C.td}>Yr {s.year||'—'}</td>
                    <td style={C.td}><span style={C.badge('#D97706')}>⭐ {s.xp||0}</span></td>
                    <td style={C.td}>{s.challenges_completed||0}</td>
                    <td style={C.td}>{s.battles_won||0}</td>
                    <td style={C.td}>
                      <button onClick={() => handleRemoveStudent(s.id)} style={{ ...C.btn('#DC2626'), padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}>Remove</button>
                    </td>
                  </tr>
                ))}
                {filtered.length===0 && <tr><td colSpan={8} style={{ padding:'2rem', textAlign:'center', color:'#9CA3AF' }}>No students</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Staff Management (HOD exclusive) ── */}
        {tab === 'staff' && (
          <div style={C.card}>
            <h3 style={{ margin: '0 0 0.5rem' }}>👨‍🏫 Staff & Coordinators</h3>
            <p style={{ margin: '0 0 1rem', color: '#6B7280', fontSize: '0.85rem' }}>As HOD you can promote Staff to Coordinator or demote as needed.</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Name','Email','Current Role','Change Role'].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
              <tbody>
                {staff.map((s,i) => (
                  <tr key={s.id} style={{ background: i%2===0?'white':'#F9FAFB' }}>
                    <td style={{ ...C.td, fontWeight: 600 }}>{s.name||'—'}</td>
                    <td style={{ ...C.td, color: '#6B7280', fontSize: '0.82rem' }}>{s.email}</td>
                    <td style={C.td}>
                      <span style={C.badge(s.role==='COORDINATOR'?'#6366F1':'#16A34A')}>{s.role}</span>
                    </td>
                    <td style={C.td}>
                      <select
                        value={s.role}
                        disabled={changingRole===s.id}
                        onChange={e => handleStaffRoleChange(s.id, e.target.value)}
                        style={{ padding: '0.35rem 0.6rem', border: '1.5px solid #E5E7EB', borderRadius: 6, fontSize: '0.85rem', cursor: 'pointer' }}
                      >
                        <option value="STAFF">STAFF</option>
                        <option value="COORDINATOR">COORDINATOR</option>
                      </select>
                      {changingRole===s.id && <span style={{ marginLeft: '0.5rem', color:'#9CA3AF', fontSize:'0.78rem' }}>Saving...</span>}
                    </td>
                  </tr>
                ))}
                {staff.length===0 && <tr><td colSpan={4} style={{ padding:'2rem', textAlign:'center', color:'#9CA3AF' }}>No staff in this department</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Practice Progress ── */}
        {tab === 'progress' && (
          <div style={C.card}>
            <h3 style={{ margin: '0 0 1.25rem' }}>💻 Practice Performance</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Rank','Name','Year','XP','Solved','Progress'].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
              <tbody>
                {students.map((s,i) => {
                  const rate = s.challenges_completed>0 ? Math.min(100, Math.round((s.xp||0)/((s.challenges_completed||1)*10))) : 0;
                  return (
                    <tr key={s.id} style={{ background: i%2===0?'white':'#F9FAFB' }}>
                      <td style={C.td}>{i<3?['🥇','🥈','🥉'][i]:`#${i+1}`}</td>
                      <td style={{ ...C.td, fontWeight:600 }}>{s.name||'—'}</td>
                      <td style={C.td}>Yr {s.year||'—'}</td>
                      <td style={C.td}><span style={C.badge('#D97706')}>⭐ {s.xp||0}</span></td>
                      <td style={C.td}>{s.challenges_completed||0}</td>
                      <td style={C.td}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                          <div style={{ flex:1, background:'#E5E7EB', borderRadius:10, height:8 }}>
                            <div style={{ height:'100%', borderRadius:10, width:`${rate}%`, background:rate>70?'#16A34A':rate>40?'#D97706':'#DC2626' }} />
                          </div>
                          <span style={{ fontSize:'0.75rem', color:'#6B7280', width:30 }}>{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Battles ── */}
        {tab === 'battles' && (
          <div style={C.card}>
            <h3 style={{ margin: '0 0 1.25rem' }}>⚔️ Battle Leaderboard</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Rank','Name','Year','Battles Won','XP Earned'].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
              <tbody>
                {[...students].sort((a,b) => (b.battles_won||0)-(a.battles_won||0)).map((s,i) => (
                  <tr key={s.id} style={{ background: i%2===0?'white':'#F9FAFB' }}>
                    <td style={C.td}>{i<3?['🥇','🥈','🥉'][i]:`#${i+1}`}</td>
                    <td style={{ ...C.td, fontWeight:600 }}>{s.name||'—'}</td>
                    <td style={C.td}>Yr {s.year||'—'}</td>
                    <td style={C.td}><span style={C.badge('#6366F1')}>{s.battles_won||0} wins</span></td>
                    <td style={C.td}>⭐ {(s.battles_won||0)*15}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Announcements ── */}
        {tab === 'announcements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ ...C.card, borderTop: '3px solid #4F46E5' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>📢 Send Announcement</h3>
              <p style={{ margin: '0 0 0.75rem', color: '#6B7280', fontSize: '0.85rem' }}>Visible to all staff and students in {profile?.department}</p>
              <textarea
                value={announcement}
                onChange={e => setAnnouncement(e.target.value)}
                placeholder="Type your announcement..."
                rows={4}
                style={{ ...C.input, resize: 'vertical', fontFamily: 'Arial' }}
              />
              <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleSendAnnouncement} disabled={sending||!announcement.trim()} style={C.btn(sending?'#9CA3AF':'#4F46E5')}>
                  {sending ? 'Sending...' : '📢 Send to Department'}
                </button>
              </div>
            </div>
            <div style={C.card}>
              <h3 style={{ margin: '0 0 1rem' }}>📋 Announcement History</h3>
              {announcements.length===0 ? (
                <div style={{ textAlign:'center', padding:'2rem', color:'#9CA3AF' }}>
                  <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>📭</div>
                  <p style={{ margin:0 }}>No announcements yet</p>
                </div>
              ) : announcements.map((a,i) => (
                <div key={i} style={{ background:'#F9FAFB', borderRadius:10, padding:'1rem', marginBottom:'0.75rem', borderLeft:'3px solid #4F46E5' }}>
                  <p style={{ margin:'0 0 0.4rem', color:'#1F2937', fontWeight:500 }}>{a.message}</p>
                  <div style={{ fontSize:'0.75rem', color:'#9CA3AF' }}>By {a.sent_by} ({a.role}) · {new Date(a.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
