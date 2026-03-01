// src/pages/DirectorDashboard.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabaseClient';

export default function DirectorDashboard() {
  const { profile, signOut } = useAuth();
  const [tab,           setTab]           = useState('overview');
  const [allProfiles,   setAllProfiles]   = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [title,         setTitle]         = useState('');
  const [message,       setMessage]       = useState('');
  const [targetDept,    setTargetDept]    = useState('ALL');
  const [sending,       setSending]       = useState(false);
  const [sent,          setSent]          = useState(false);

  const DEPTS = ['ALL','CSE','ECE','EEE','MECH','CIVIL','IT','AI-ML'];
  const TARGETS = [
    { value:'ALL',         label:'🌐 Entire College (Everyone)' },
    { value:'STAFF_ONLY',  label:'👨‍🏫 All Staff & Coordinators only' },
    { value:'HOD_ONLY',   label:'👔 All HODs only' },
    { value:'CSE',        label:'🏛️ CSE Department' },
    { value:'ECE',        label:'🏛️ ECE Department' },
    { value:'EEE',        label:'🏛️ EEE Department' },
    { value:'MECH',       label:'🏛️ MECH Department' },
    { value:'CIVIL',      label:'🏛️ CIVIL Department' },
    { value:'IT',         label:'🏛️ IT Department' },
    { value:'AI-ML',      label:'🏛️ AI-ML Department' },
  ];

  useEffect(() => { if (profile) loadData(); else setLoading(false); }, [profile]);

  async function loadData() {
    const [{ data: people }, { data: ann }] = await Promise.all([
      supabase.from('profiles').select('*').neq('role','ADMIN').neq('role','DIRECTOR'),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(30),
    ]);
    setAllProfiles(people || []);
    setAnnouncements(ann || []);
    setLoading(false);
  }

  async function handleSend() {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    // department null = college-wide, STAFF_ONLY/HOD_ONLY = special targets
    await supabase.from('announcements').insert({
      title:      title.trim(),
      message:    message.trim(),
      department: ['ALL','STAFF_ONLY','HOD_ONLY'].includes(targetDept) ? null : targetDept,
      target:     targetDept === 'ALL' ? null : targetDept,
      sent_by:    profile.name || profile.email,
      role:       'DIRECTOR',
    });
    setTitle(''); setMessage(''); setSent(true);
    setTimeout(() => setSent(false), 3000);
    await loadData();
    setSending(false);
  }

  async function handleSignOut() {
    try { await Promise.race([signOut(), new Promise(r => setTimeout(r, 1500))]); } catch {}
    window.location.href = '/login';
  }

  const students    = allProfiles.filter(p => p.role === 'STUDENT');
  const hods        = allProfiles.filter(p => p.role === 'HOD');
  const staff       = allProfiles.filter(p => ['STAFF','COORDINATOR'].includes(p.role));
  const deptStats   = ['CSE','ECE','EEE','MECH','CIVIL','IT','AI-ML'].map(d => ({
    dept: d,
    students: students.filter(s => s.department === d).length,
    avgXP: (() => { const s = students.filter(x => x.department === d); return s.length ? Math.round(s.reduce((a,x) => a+(x.xp||0),0)/s.length) : 0; })(),
  })).filter(d => d.students > 0);

  const C = {
    page:  { minHeight:'100vh', background:'#F0F4FF', fontFamily:'Arial,sans-serif' },
    card:  { background:'white', borderRadius:14, padding:'1.5rem', boxShadow:'0 2px 12px rgba(0,0,0,0.07)' },
    th:    { padding:'0.75rem 1rem', textAlign:'left', color:'#6B7280', fontWeight:600, fontSize:'0.82rem', borderBottom:'1px solid #E5E7EB', background:'#F9FAFB' },
    td:    { padding:'0.75rem 1rem', fontSize:'0.88rem', borderBottom:'1px solid #F3F4F6', color:'#374151' },
    badge: (c) => ({ background:c+'20', color:c, padding:'2px 10px', borderRadius:20, fontWeight:700, fontSize:'0.78rem' }),
    input: { width:'100%', padding:'0.65rem 0.9rem', border:'1.5px solid #E5E7EB', borderRadius:8, fontSize:'0.9rem', outline:'none', boxSizing:'border-box' },
    btn:   (c) => ({ padding:'0.6rem 1.25rem', background:c, color:'white', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:'0.88rem' }),
  };
  const tabBtn = (t) => ({ padding:'0.55rem 1.1rem', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:'0.85rem', transition:'all 0.15s', background:tab===t?'#4F46E5':'transparent', color:tab===t?'white':'#6B7280' });

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}><p>Loading...</p></div>;

  return (
    <div style={C.page}>
      <header style={{ background:'linear-gradient(135deg,#1E1B4B,#4F46E5)', padding:'1rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ margin:0, color:'white', fontSize:'1.4rem', fontWeight:800 }}>🎓 Director Dashboard</h1>
          <p style={{ margin:0, color:'rgba(255,255,255,0.7)', fontSize:'0.82rem' }}>College-wide Oversight · All Departments</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
          <span style={C.badge('#A5B4FC')}>DIRECTOR</span>
          <button onClick={handleSignOut} style={{ padding:'0.5rem 1.25rem', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.4)', color:'white', borderRadius:8, cursor:'pointer', fontWeight:600 }}>Sign Out</button>
        </div>
      </header>

      <div style={{ maxWidth:1350, margin:'2rem auto', padding:'0 2rem' }}>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'1.75rem' }}>
          {[
            { label:'Total Students', value:students.length,     icon:'👥', color:'#6366F1' },
            { label:'Departments',    value:deptStats.length,    icon:'🏛️', color:'#16A34A' },
            { label:'HODs',           value:hods.length,         icon:'👔', color:'#D97706' },
            { label:'Staff',          value:staff.length,        icon:'👨‍🏫', color:'#0891B2' },
          ].map((s,i) => (
            <div key={i} style={{ ...C.card, borderLeft:`4px solid ${s.color}`, display:'flex', alignItems:'center', gap:'0.75rem', padding:'1.1rem' }}>
              <span style={{ fontSize:'1.8rem' }}>{s.icon}</span>
              <div>
                <div style={{ fontSize:'1.6rem', fontWeight:800, color:'#1F2937' }}>{s.value}</div>
                <div style={{ fontSize:'0.78rem', color:'#6B7280' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'0.35rem', background:'white', padding:'0.4rem', borderRadius:10, width:'fit-content', marginBottom:'1.5rem', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          {[{key:'overview',label:'📊 Overview'},{key:'hods',label:'👔 HODs'},{key:'broadcast',label:'📢 Broadcast'},{key:'history',label:'📋 History'}]
            .map(t => <button key={t.key} onClick={() => setTab(t.key)} style={tabBtn(t.key)}>{t.label}</button>)}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
            <div style={C.card}>
              <h3 style={{ margin:'0 0 1rem' }}>🏛️ Department Performance</h3>
              {deptStats.map(d => (
                <div key={d.dept} style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'0.6rem 0', borderBottom:'1px solid #F3F4F6' }}>
                  <span style={{ fontWeight:700, width:60, color:'#4F46E5' }}>{d.dept}</span>
                  <div style={{ flex:1, background:'#F3F4F6', borderRadius:10, height:10 }}>
                    <div style={{ height:'100%', borderRadius:10, width:`${Math.min(100,(d.students/Math.max(...deptStats.map(x=>x.students)))*100)}%`, background:'linear-gradient(90deg,#4F46E5,#7C3AED)' }} />
                  </div>
                  <span style={{ fontSize:'0.82rem', color:'#6B7280', width:80 }}>{d.students} students</span>
                  <span style={C.badge('#D97706')}>⭐ {d.avgXP}</span>
                </div>
              ))}
              {deptStats.length === 0 && <p style={{ color:'#9CA3AF', textAlign:'center' }}>No department data yet</p>}
            </div>
            <div style={C.card}>
              <h3 style={{ margin:'0 0 1rem' }}>📢 Recent Broadcasts</h3>
              {announcements.filter(a => !a.department).slice(0,5).map((a,i) => (
                <div key={i} style={{ padding:'0.75rem', borderRadius:8, background:'#F9FAFB', marginBottom:'0.5rem', borderLeft:'3px solid #4F46E5' }}>
                  <div style={{ fontWeight:600, fontSize:'0.88rem' }}>{a.title || a.message.substring(0,40)}</div>
                  <div style={{ fontSize:'0.75rem', color:'#9CA3AF', marginTop:2 }}>by {a.sent_by} · {new Date(a.created_at).toLocaleDateString()}</div>
                </div>
              ))}
              {announcements.filter(a=>!a.department).length===0 && <p style={{ color:'#9CA3AF', textAlign:'center' }}>No broadcasts yet</p>}
            </div>
          </div>
        )}

        {/* HODs */}
        {tab === 'hods' && (
          <div style={C.card}>
            <h3 style={{ margin:'0 0 1rem' }}>👔 All HODs</h3>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['Name','Email','Department','Students in Dept'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
              <tbody>
                {hods.map((h,i) => (
                  <tr key={h.id} style={{ background:i%2===0?'white':'#F9FAFB' }}>
                    <td style={{ ...C.td, fontWeight:600 }}>{h.name||'—'}</td>
                    <td style={{ ...C.td, color:'#6B7280' }}>{h.email}</td>
                    <td style={C.td}><span style={C.badge('#4F46E5')}>{h.department||'—'}</span></td>
                    <td style={C.td}>{students.filter(s=>s.department===h.department).length} students</td>
                  </tr>
                ))}
                {hods.length===0 && <tr><td colSpan={4} style={{ padding:'2rem', textAlign:'center', color:'#9CA3AF' }}>No HODs found</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Broadcast */}
        {tab === 'broadcast' && (
          <div style={{ ...C.card, borderTop:'3px solid #4F46E5', maxWidth:700 }}>
            <h3 style={{ margin:'0 0 0.5rem' }}>📢 Broadcast Announcement</h3>
            <p style={{ margin:'0 0 1.5rem', color:'#6B7280', fontSize:'0.85rem' }}>
              Send to the entire college or a specific department. All students and staff will see this.
            </p>
            <div style={{ marginBottom:'1rem' }}>
              <label style={{ display:'block', fontWeight:600, fontSize:'0.82rem', color:'#6B7280', marginBottom:4 }}>Title</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Announcement title" style={C.input} />
            </div>
            <div style={{ marginBottom:'1rem' }}>
              <label style={{ display:'block', fontWeight:600, fontSize:'0.82rem', color:'#6B7280', marginBottom:4 }}>Target</label>
              <select value={targetDept} onChange={e=>setTargetDept(e.target.value)} style={C.input}>
                {TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:'1.25rem' }}>
              <label style={{ display:'block', fontWeight:600, fontSize:'0.82rem', color:'#6B7280', marginBottom:4 }}>Message</label>
              <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Type your message to the college..." rows={5} style={{ ...C.input, resize:'vertical', fontFamily:'Arial' }} />
            </div>
            <button onClick={handleSend} disabled={sending||!title.trim()||!message.trim()} style={C.btn(sending?'#9CA3AF':'#4F46E5')}>
              {sending ? 'Sending...' : `📢 Broadcast to ${
                targetDept==='ALL'       ? 'Entire College' :
                targetDept==='STAFF_ONLY'? 'All Staff' :
                targetDept==='HOD_ONLY'  ? 'All HODs' :
                targetDept + ' Department'
              }`}
            </button>
            {sent && <p style={{ color:'#16A34A', marginTop:'0.75rem', fontWeight:600 }}>✅ Broadcast sent successfully!</p>}
          </div>
        )}

        {/* History */}
        {tab === 'history' && (
          <div style={C.card}>
            <h3 style={{ margin:'0 0 1rem' }}>📋 All Announcements</h3>
            {announcements.length===0 ? (
              <p style={{ textAlign:'center', color:'#9CA3AF', padding:'2rem' }}>No announcements yet</p>
            ) : announcements.map((a,i) => (
              <div key={i} style={{ padding:'1rem', borderRadius:10, background:'#F9FAFB', marginBottom:'0.75rem', borderLeft:`3px solid ${a.department?'#16A34A':'#4F46E5'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    {a.title && <div style={{ fontWeight:700, marginBottom:'0.25rem' }}>{a.title}</div>}
                    <p style={{ margin:0, fontSize:'0.88rem', color:'#374151' }}>{a.message}</p>
                  </div>
                  <span style={C.badge(a.target==='STAFF_ONLY'?'#D97706':a.target==='HOD_ONLY'?'#7C3AED':a.department?'#16A34A':'#4F46E5')}>{a.target==='STAFF_ONLY'?'👨‍🏫 Staff Only':a.target==='HOD_ONLY'?'👔 HODs Only':a.department||'🌐 College-wide'}</span>
                </div>
                <div style={{ fontSize:'0.75rem', color:'#9CA3AF', marginTop:'0.5rem' }}>By {a.sent_by} ({a.role}) · {new Date(a.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
