// src/pages/HODDashboard.jsx
// No top header — navigation handled by AppLayout sidebar.
// HOD reaches Study Hub via sidebar: 📚 Study Hub → /study-hub/manage
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../utils/supabaseClient';
import AIInsights from '../components/AIInsights';

export default function HODDashboard() {
  const { profile } = useAuth();
  const { isDark } = useTheme();

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
      .from('profiles').select('*')
      .eq('department', profile.department)
      .neq('role', 'ADMIN').neq('role', 'HOD');
    const all = data || [];
    setStudents(all.filter(u=>u.role==='STUDENT').sort((a,b)=>(b.xp||0)-(a.xp||0)));
    setStaff(all.filter(u=>['STAFF','COORDINATOR'].includes(u.role)));
    setLoading(false);
  }
  async function loadAnnouncements() {
    const { data } = await supabase.from('announcements').select('*').or(`department.eq.${profile.department},department.is.null`).order('created_at',{ascending:false}).limit(15);
    setAnnouncements(data||[]);
  }
  async function handleStaffRoleChange(userId, newRole) {
    setChangingRole(userId);
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    setStaff(prev=>prev.map(s=>s.id===userId?{...s,role:newRole}:s));
    setChangingRole(null);
  }
  async function handleRemoveStudent(studentId) {
    if (!confirm('Remove this student from your department?')) return;
    await supabase.from('profiles').update({ department: null }).eq('id', studentId);
    setStudents(prev=>prev.filter(s=>s.id!==studentId));
  }
  async function handleSendAnnouncement() {
    if (!announcement.trim()) return;
    setSending(true);
    await supabase.from('announcements').insert({ message:announcement.trim(), department:profile.department, sent_by:profile.name||profile.email, role:profile.role });
    setAnnouncement(''); await loadAnnouncements(); setSending(false);
  }

  const avgXP        = students.length ? Math.round(students.reduce((a,s)=>a+(s.xp||0),0)/students.length) : 0;
  const totalSolved  = students.reduce((a,s)=>a+(s.challenges_completed||0),0);
  const totalBattles = students.reduce((a,s)=>a+(s.battles_won||0),0);
  const filtered     = students.filter(s=>!search||s.name?.toLowerCase().includes(search.toLowerCase())||s.email?.toLowerCase().includes(search.toLowerCase()));

  // ── Theme ─────────────────────────────────────────────────────────────────────
  const bg      = isDark ? '#0f1117' : '#f8fafc';
  const surface = isDark ? '#141720' : '#ffffff';
  const border  = isDark ? '#1e2433' : '#e5e7eb';
  const textPri = isDark ? '#e2e8f0' : '#1e293b';
  const textSec = isDark ? '#a0aec0' : '#64748b';
  const textMut = isDark ? '#4a5568' : '#94a3b8';
  const surfAlt = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc';

  const card  = { background: surface, borderRadius:14, border:`1px solid ${border}`, padding:'1.5rem' };
  const th    = { padding:'0.75rem 1rem', textAlign:'left', color: textMut, fontWeight:600, fontSize:'0.78rem', borderBottom:`1px solid ${border}`, background: isDark?'rgba(255,255,255,0.02)':'#f8fafc', textTransform:'uppercase', letterSpacing:'0.05em' };
  const td    = { padding:'0.75rem 1rem', fontSize:'0.875rem', borderBottom:`1px solid ${border}`, color: textSec };
  const badge = (c) => ({ background:`${c}18`, color:c, padding:'2px 10px', borderRadius:20, fontWeight:700, fontSize:'0.75rem', border:`1px solid ${c}30` });
  const inp   = { width:'100%', padding:'0.65rem 0.875rem', border:`1.5px solid ${border}`, borderRadius:8, fontSize:'0.875rem', outline:'none', boxSizing:'border-box', background: isDark?'rgba(255,255,255,0.04)':'white', color: textPri, fontFamily:'"Inter",Arial,sans-serif' };
  const btn   = (c) => ({ padding:'0.5rem 1.1rem', background:c, color:'white', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:'0.82rem' });
  const tabBtn = (t) => ({ padding:'0.5rem 1rem', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:'0.82rem', background: tab===t ? '#667eea' : 'transparent', color: tab===t ? 'white' : textMut, transition:'all 0.15s' });

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background: bg }}>
      <div style={{ width:36, height:36, border:`3px solid ${border}`, borderTopColor:'#667eea', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background: bg, fontFamily:'"Inter",Arial,sans-serif', color: textPri }}>
      <div style={{ maxWidth:1300, margin:'0 auto', padding:'2rem' }}>

        {/* Page title */}
        <div style={{ marginBottom:'2rem' }}>
          <h1 style={{ fontSize:'1.5rem', fontWeight:800, margin:'0 0 0.25rem', color: textPri }}>🏛️ HOD Dashboard</h1>
          <p style={{ color: textSec, margin:0, fontSize:'0.875rem' }}>{profile?.department} — Head of Department · {profile?.name}</p>
        </div>

        {/* Stats strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'1rem', marginBottom:'2rem' }}>
          {[
            { label:'Students',    value: students.length, icon:'👥', color:'#6366F1' },
            { label:'Staff',       value: staff.length,    icon:'👨‍🏫', color:'#16A34A' },
            { label:'Avg XP',      value: avgXP,           icon:'⭐', color:'#D97706' },
            { label:'Total Solved',value: totalSolved,     icon:'✅', color:'#0891B2' },
            { label:'Battles Won', value: totalBattles,    icon:'⚔️', color:'#DC2626' },
          ].map((s,i) => (
            <div key={i} style={{ ...card, borderLeft:`4px solid ${s.color}`, display:'flex', alignItems:'center', gap:'0.875rem', padding:'1.1rem' }}>
              <span style={{ fontSize:'1.8rem' }}>{s.icon}</span>
              <div>
                <div style={{ fontSize:'1.6rem', fontWeight:800, color: textPri, lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:'0.72rem', color: textMut, marginTop:'0.2rem' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'0.25rem', background: surface, padding:'0.35rem', borderRadius:10, width:'fit-content', marginBottom:'1.5rem', border:`1px solid ${border}` }}>
          {[{k:'overview',l:'📊 Overview'},{k:'students',l:'👥 Students'},{k:'staff',l:'👨‍🏫 Staff'},{k:'progress',l:'💻 Practice'},{k:'battles',l:'⚔️ Battles'},{k:'announcements',l:'📢 Announce'}]
            .map(t => <button key={t.k} onClick={()=>setTab(t.k)} style={tabBtn(t.k)}>{t.l}</button>)}
        </div>

        {/* ── OVERVIEW ── */}
        {tab==='overview' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
            <AIInsights mode="staff" />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
              <div style={card}>
                <h3 style={{ margin:'0 0 1rem', color: textPri, fontSize:'0.95rem', fontWeight:700 }}>📊 Year Distribution</h3>
                {[1,2,3,4].map(yr=>{
                  const count = students.filter(s=>s.year===yr).length;
                  const pct   = students.length ? Math.round((count/students.length)*100) : 0;
                  return (
                    <div key={yr} style={{ marginBottom:'0.85rem' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.3rem', fontSize:'0.82rem' }}>
                        <span style={{ color: textPri, fontWeight:500 }}>Year {yr}</span>
                        <span style={{ color: textMut }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ background: border, borderRadius:10, height:8 }}>
                        <div style={{ height:'100%', borderRadius:10, width:`${pct}%`, background:'linear-gradient(90deg,#4F46E5,#7C3AED)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={card}>
                <h3 style={{ margin:'0 0 1rem', color: textPri, fontSize:'0.95rem', fontWeight:700 }}>🏆 Top 5 Students</h3>
                {students.slice(0,5).map((s,i)=>(
                  <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.5rem 0', borderBottom: i<4?`1px solid ${border}`:'none' }}>
                    <span style={{ fontSize:'1.1rem' }}>{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:'0.875rem', color: textPri }}>{s.name||'—'}</div>
                      <div style={{ color: textMut, fontSize:'0.72rem' }}>Year {s.year} · {s.challenges_completed||0} solved</div>
                    </div>
                    <span style={badge('#D97706')}>⭐ {s.xp||0}</span>
                  </div>
                ))}
                {students.length===0 && <p style={{ color: textMut, textAlign:'center' }}>No students yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── STUDENTS ── */}
        {tab==='students' && (
          <div style={card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <h3 style={{ margin:0, color: textPri }}>All Students ({filtered.length})</h3>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search…" style={{ ...inp, width:220 }} />
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['#','Name','Email','Year','XP','Action'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((s,i)=>(
                  <tr key={s.id} style={{ background: i%2===0?'transparent':surfAlt }}>
                    <td style={td}>{i+1}</td>
                    <td style={{ ...td, fontWeight:600, color: textPri }}>{s.name||'—'}</td>
                    <td style={{ ...td, color: textMut, fontSize:'0.78rem' }}>{s.email}</td>
                    <td style={td}>Yr {s.year||'—'}</td>
                    <td style={td}><span style={badge('#D97706')}>⭐ {s.xp||0}</span></td>
                    <td style={td}><button onClick={()=>handleRemoveStudent(s.id)} style={{ ...btn('#DC2626'), padding:'0.25rem 0.65rem', fontSize:'0.72rem' }}>Remove</button></td>
                  </tr>
                ))}
                {filtered.length===0&&<tr><td colSpan={6} style={{ padding:'2rem', textAlign:'center', color: textMut }}>No students</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ── STAFF ── */}
        {tab==='staff' && (
          <div style={card}>
            <h3 style={{ margin:'0 0 0.4rem', color: textPri }}>👨‍🏫 Staff & Coordinators</h3>
            <p style={{ margin:'0 0 1rem', color: textMut, fontSize:'0.82rem' }}>Promote Staff to Coordinator or demote as needed.</p>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['Name','Email','Current Role','Change Role'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {staff.map((s,i)=>(
                  <tr key={s.id} style={{ background: i%2===0?'transparent':surfAlt }}>
                    <td style={{ ...td, fontWeight:600, color: textPri }}>{s.name||'—'}</td>
                    <td style={{ ...td, color: textMut, fontSize:'0.78rem' }}>{s.email}</td>
                    <td style={td}><span style={badge(s.role==='COORDINATOR'?'#6366F1':'#16A34A')}>{s.role}</span></td>
                    <td style={td}>
                      <select value={s.role} disabled={changingRole===s.id} onChange={e=>handleStaffRoleChange(s.id,e.target.value)}
                        style={{ padding:'0.35rem 0.6rem', border:`1.5px solid ${border}`, borderRadius:6, fontSize:'0.82rem', cursor:'pointer', background: isDark?'#1a1d27':'white', color: textPri }}>
                        <option value="STAFF">STAFF</option>
                        <option value="COORDINATOR">COORDINATOR</option>
                      </select>
                      {changingRole===s.id&&<span style={{ marginLeft:'0.5rem', color: textMut, fontSize:'0.72rem' }}>Saving…</span>}
                    </td>
                  </tr>
                ))}
                {staff.length===0&&<tr><td colSpan={4} style={{ padding:'2rem', textAlign:'center', color: textMut }}>No staff in this department</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ── PRACTICE ── */}
        {tab==='progress' && (
          <div style={card}>
            <h3 style={{ margin:'0 0 1.25rem', color: textPri }}>💻 Practice Performance</h3>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['Rank','Name','Year','XP','Solved','Progress'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {students.map((s,i)=>{
                  const rate = s.challenges_completed>0?Math.min(100,Math.round((s.xp||0)/((s.challenges_completed||1)*10))):0;
                  return (
                    <tr key={s.id} style={{ background: i%2===0?'transparent':surfAlt }}>
                      <td style={td}>{i<3?['🥇','🥈','🥉'][i]:`#${i+1}`}</td>
                      <td style={{ ...td, fontWeight:600, color: textPri }}>{s.name||'—'}</td>
                      <td style={td}>Yr {s.year||'—'}</td>
                      <td style={td}><span style={badge('#D97706')}>⭐ {s.xp||0}</span></td>
                      <td style={td}>{s.challenges_completed||0}</td>
                      <td style={td}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                          <div style={{ flex:1, background: border, borderRadius:10, height:7 }}>
                            <div style={{ height:'100%', borderRadius:10, width:`${rate}%`, background: rate>70?'#48bb78':rate>40?'#ed8936':'#f56565' }} />
                          </div>
                          <span style={{ fontSize:'0.72rem', color: textMut, minWidth:28 }}>{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── BATTLES ── */}
        {tab==='battles' && (
          <div style={card}>
            <h3 style={{ margin:'0 0 1.25rem', color: textPri }}>⚔️ Battle Leaderboard</h3>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['Rank','Name','Year','Battles Won','XP Earned'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {[...students].sort((a,b)=>(b.battles_won||0)-(a.battles_won||0)).map((s,i)=>(
                  <tr key={s.id} style={{ background: i%2===0?'transparent':surfAlt }}>
                    <td style={td}>{i<3?['🥇','🥈','🥉'][i]:`#${i+1}`}</td>
                    <td style={{ ...td, fontWeight:600, color: textPri }}>{s.name||'—'}</td>
                    <td style={td}>Yr {s.year||'—'}</td>
                    <td style={td}><span style={badge('#6366F1')}>{s.battles_won||0} wins</span></td>
                    <td style={td}>⭐ {(s.battles_won||0)*15}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── ANNOUNCEMENTS ── */}
        {tab==='announcements' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
            <div style={{ ...card, borderTop:'3px solid #4F46E5' }}>
              <h3 style={{ margin:'0 0 0.4rem', color: textPri }}>📢 Send Announcement</h3>
              <p style={{ margin:'0 0 0.75rem', color: textMut, fontSize:'0.82rem' }}>Visible to all staff and students in {profile?.department}</p>
              <textarea value={announcement} onChange={e=>setAnnouncement(e.target.value)} rows={4} placeholder="Type your announcement…" style={{ ...inp, resize:'vertical' }} />
              <div style={{ marginTop:'0.75rem', display:'flex', justifyContent:'flex-end' }}>
                <button onClick={handleSendAnnouncement} disabled={sending||!announcement.trim()} style={btn(sending?textMut:'#4F46E5')}>{sending?'Sending…':'📢 Send to Department'}</button>
              </div>
            </div>
            <div style={card}>
              <h3 style={{ margin:'0 0 1rem', color: textPri }}>📋 Announcement History</h3>
              {announcements.length===0?(
                <div style={{ textAlign:'center', padding:'2rem', color: textMut }}>
                  <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>📭</div>
                  <p style={{ margin:0 }}>No announcements yet</p>
                </div>
              ):announcements.map((a,i)=>(
                <div key={i} style={{ background: surfAlt, borderRadius:10, padding:'1rem', marginBottom:'0.75rem', borderLeft:'3px solid #4F46E5', border:`1px solid ${border}` }}>
                  <p style={{ margin:'0 0 0.4rem', color: textPri, fontWeight:500 }}>{a.message}</p>
                  <div style={{ fontSize:'0.72rem', color: textMut }}>By {a.sent_by} ({a.role}) · {new Date(a.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
