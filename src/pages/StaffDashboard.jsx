// src/pages/StaffDashboard.jsx
// No top header — navigation handled by AppLayout sidebar.
// Staff reach Study Hub via sidebar: 📚 Study Hub → /study-hub/manage
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../utils/supabaseClient';
import AIInsights from '../components/AIInsights';

const GROUP_COLORS = ['#667eea','#16A34A','#D97706','#DC2626','#0891B2','#7C3AED','#DB2777'];

export default function StaffDashboard() {
  const { profile } = useAuth();
  const { isDark } = useTheme();
  const isCoordinator = profile?.role === 'COORDINATOR';

  const [tab,           setTab]           = useState('overview');
  const [students,      setStudents]      = useState([]);
  const [groups,        setGroups]        = useState([]);
  const [selGroup,      setSelGroup]      = useState(null);
  const [resources,     setResources]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [announcement,  setAnnouncement]  = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [sending,       setSending]       = useState(false);

  const [addEmail, setAddEmail] = useState('');
  const [addName,  setAddName]  = useState('');
  const [addYear,  setAddYear]  = useState('');
  const [addMsg,   setAddMsg]   = useState('');
  const [adding,   setAdding]   = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting,    setInviting]    = useState(false);
  const [inviteMsg,   setInviteMsg]   = useState('');

  const [newGroupName,  setNewGroupName]  = useState('');
  const [newGroupDesc,  setNewGroupDesc]  = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#667eea');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [resType,   setResType]   = useState('link');
  const [resTitle,  setResTitle]  = useState('');
  const [resUrl,    setResUrl]    = useState('');
  const [resDesc,   setResDesc]   = useState('');
  const [resDL,     setResDL]     = useState('');
  const [addingRes, setAddingRes] = useState(false);

  useEffect(() => {
    if (profile) { loadStudents(); loadGroups(); loadAnnouncements(); } else setLoading(false);
  }, [profile]);

  async function loadStudents() {
    const { data } = await supabase.from('profiles').select('id,name,email,xp,challenges_completed,battles_won,year,created_at').eq('role','STUDENT').eq('department',profile.department).order('xp',{ascending:false});
    setStudents(data||[]); setLoading(false);
  }
  async function loadGroups() {
    const { data } = await supabase.from('study_groups').select('*, group_members(count)').eq('department',profile.department).order('created_at',{ascending:false});
    setGroups(data||[]);
  }
  async function loadResources(groupId) {
    const { data } = await supabase.from('group_resources').select('*').eq('group_id',groupId).order('created_at',{ascending:false});
    setResources(data||[]);
  }
  async function loadAnnouncements() {
    const { data } = await supabase.from('announcements').select('*').or(`department.eq.${profile.department},department.is.null`).order('created_at',{ascending:false}).limit(10);
    setAnnouncements(data||[]);
  }

  async function handleAddStudent() {
    if (!addEmail.trim()||!addName.trim()||!addYear) { setAddMsg('Fill all fields'); return; }
    setAdding(true); setAddMsg('');
    const { data: existing } = await supabase.from('profiles').select('id').eq('email',addEmail.trim().toLowerCase()).maybeSingle();
    if (existing) {
      await supabase.from('profiles').update({ department:profile.department, role:'STUDENT', year:parseInt(addYear), name:addName.trim() }).eq('id',existing.id);
      setAddMsg('✅ Student added!'); await loadStudents(); setAddEmail(''); setAddName(''); setAddYear('');
    } else { setAddMsg('⚠️ No account found. Use invite below.'); }
    setAdding(false);
  }
  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true); setInviteMsg('');
    try {
      await supabase.from('student_invites').insert({ email:inviteEmail.trim().toLowerCase(), department:profile.department, invited_by:profile.name||profile.email });
      setInviteMsg('✅ Invite recorded! Share: ' + window.location.origin + '/signup?dept=' + profile.department);
      setInviteEmail('');
    } catch(e) { setInviteMsg('Error: '+e.message); }
    setInviting(false);
  }
  async function handleRemoveStudent(id) {
    if (!confirm('Remove from department?')) return;
    await supabase.from('profiles').update({ department:null }).eq('id',id);
    setStudents(prev=>prev.filter(s=>s.id!==id));
  }
  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    const { data } = await supabase.from('study_groups').insert({ name:newGroupName.trim(), description:newGroupDesc.trim(), department:profile.department, created_by:profile.id, color:newGroupColor }).select().single();
    if (data) { setGroups(prev=>[data,...prev]); setNewGroupName(''); setNewGroupDesc(''); }
    setCreatingGroup(false);
  }
  async function handleSelectGroup(g) { setSelGroup(g); await loadResources(g.id); }
  async function handleAddResource() {
    if (!resTitle.trim()) return;
    setAddingRes(true);
    await supabase.from('group_resources').insert({ group_id:selGroup.id, type:resType, title:resTitle.trim(), url:resUrl.trim()||null, description:resDesc.trim()||null, deadline_at:resDL||null, posted_by:profile.name||profile.email });
    setResTitle(''); setResUrl(''); setResDesc(''); setResDL('');
    await loadResources(selGroup.id); setAddingRes(false);
  }
  async function handleDeleteGroup(id) {
    if (!confirm('Delete this group?')) return;
    await supabase.from('study_groups').delete().eq('id',id);
    setGroups(prev=>prev.filter(g=>g.id!==id));
    if (selGroup?.id===id) { setSelGroup(null); setResources([]); }
  }
  async function handleSendAnnouncement() {
    if (!announcement.trim()) return;
    setSending(true);
    await supabase.from('announcements').insert({ message:announcement.trim(), department:profile.department, sent_by:profile.name||profile.email, role:profile.role });
    setAnnouncement(''); await loadAnnouncements(); setSending(false);
  }

  const filtered    = students.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()));
  const avgXP       = students.length ? Math.round(students.reduce((a,s)=>a+(s.xp||0),0)/students.length) : 0;
  const totalSolved = students.reduce((a,s)=>a+(s.challenges_completed||0),0);

  // ── Theme ─────────────────────────────────────────────────────────────────────
  const bg      = isDark ? '#0f1117' : '#f8fafc';
  const surface = isDark ? '#141720' : '#ffffff';
  const border  = isDark ? '#1e2433' : '#e5e7eb';
  const textPri = isDark ? '#e2e8f0' : '#1e293b';
  const textSec = isDark ? '#a0aec0' : '#64748b';
  const textMut = isDark ? '#4a5568' : '#94a3b8';
  const surfAlt = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc';

  // Style helpers
  const card  = { background: surface, borderRadius:14, border:`1px solid ${border}`, padding:'1.5rem' };
  const th    = { padding:'0.75rem 1rem', textAlign:'left', color: textMut, fontWeight:600, fontSize:'0.78rem', borderBottom:`1px solid ${border}`, background: isDark?'rgba(255,255,255,0.02)':'#f8fafc', textTransform:'uppercase', letterSpacing:'0.05em' };
  const td    = { padding:'0.75rem 1rem', fontSize:'0.875rem', borderBottom:`1px solid ${border}`, color: textSec };
  const badge = (c) => ({ background:`${c}18`, color:c, padding:'2px 10px', borderRadius:20, fontWeight:700, fontSize:'0.75rem', border:`1px solid ${c}30` });
  const inp   = { width:'100%', padding:'0.65rem 0.875rem', border:`1.5px solid ${border}`, borderRadius:8, fontSize:'0.875rem', outline:'none', boxSizing:'border-box', background: isDark?'rgba(255,255,255,0.04)':'white', color: textPri, fontFamily:'"Inter",Arial,sans-serif' };
  const btn   = (c) => ({ padding:'0.5rem 1.1rem', background:c, color:'white', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:'0.82rem' });
  const tabBtn = (t) => ({ padding:'0.5rem 1rem', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:'0.82rem', background: tab===t ? '#667eea' : 'transparent', color: tab===t ? 'white' : textMut, transition:'all 0.15s' });

  const RESOURCE_ICONS = { link:'🔗', deadline:'⏰', announcement:'📢' };

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
          <h1 style={{ fontSize:'1.5rem', fontWeight:800, margin:'0 0 0.25rem', color: textPri }}>{isCoordinator ? '📋 Coordinator' : '👨‍🏫 Staff'} Dashboard</h1>
          <p style={{ color: textSec, margin:0, fontSize:'0.875rem' }}>{profile?.department} — {profile?.name}</p>
        </div>

        {/* Stats strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'2rem' }}>
          {[
            { label:'Students',    value: students.length, icon:'👥', color:'#6366F1' },
            { label:'Avg XP',      value: avgXP,           icon:'⭐', color:'#D97706' },
            { label:'Total Solved',value: totalSolved,     icon:'✅', color:'#16A34A' },
            { label:'Study Groups',value: groups.length,   icon:'📚', color:'#0891B2' },
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
          {[{k:'overview',l:'📊 Overview'},{k:'students',l:'👥 Students'},{k:'groups',l:'📚 Groups'},{k:'progress',l:'💻 Practice'},{k:'battles',l:'⚔️ Battles'},{k:'announcements',l:'📢 Announce'}]
            .map(t => <button key={t.k} onClick={() => setTab(t.k)} style={tabBtn(t.k)}>{t.l}</button>)}
        </div>

        {/* ── OVERVIEW ── */}
        {tab==='overview' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
            <AIInsights mode="staff" />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
              <div style={card}>
                <h3 style={{ margin:'0 0 1rem', color: textPri, fontSize:'0.95rem', fontWeight:700 }}>📊 Year Distribution</h3>
                {[1,2,3,4].map(yr => {
                  const count = students.filter(s=>s.year===yr).length;
                  const pct   = students.length ? Math.round((count/students.length)*100) : 0;
                  return (
                    <div key={yr} style={{ marginBottom:'0.85rem' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.3rem', fontSize:'0.82rem' }}>
                        <span style={{ color: textPri, fontWeight:500 }}>Year {yr}</span>
                        <span style={{ color: textMut }}>{count} students</span>
                      </div>
                      <div style={{ background: border, borderRadius:10, height:8 }}>
                        <div style={{ height:'100%', borderRadius:10, width:`${pct}%`, background:'linear-gradient(90deg,#667eea,#764ba2)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={card}>
                <h3 style={{ margin:'0 0 1rem', color: textPri, fontSize:'0.95rem', fontWeight:700 }}>🏆 Top 5 Students</h3>
                {students.slice(0,5).map((s,i) => (
                  <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.5rem 0', borderBottom: i<4 ? `1px solid ${border}` : 'none' }}>
                    <span style={{ fontSize:'1.1rem' }}>{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:'0.875rem', color: textPri }}>{s.name||'—'}</div>
                      <div style={{ color: textMut, fontSize:'0.72rem' }}>Year {s.year} · {s.challenges_completed||0} solved</div>
                    </div>
                    <span style={badge('#D97706')}>⭐ {s.xp||0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STUDENTS ── */}
        {tab==='students' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
            <div style={{ ...card, borderTop:'3px solid #667eea' }}>
              <h3 style={{ margin:'0 0 0.4rem', color: textPri }}>➕ Enrol Existing Student</h3>
              <p style={{ margin:'0 0 1rem', color: textMut, fontSize:'0.82rem' }}>Student already has an account? Add them by email.</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 120px auto', gap:'0.75rem', alignItems:'end' }}>
                <div>
                  <label style={{ fontSize:'0.72rem', fontWeight:700, color: textMut, display:'block', marginBottom:4, textTransform:'uppercase' }}>Email</label>
                  <input value={addEmail} onChange={e=>setAddEmail(e.target.value)} placeholder="student@email.com" style={inp} />
                </div>
                <div>
                  <label style={{ fontSize:'0.72rem', fontWeight:700, color: textMut, display:'block', marginBottom:4, textTransform:'uppercase' }}>Full Name</label>
                  <input value={addName} onChange={e=>setAddName(e.target.value)} placeholder="Student name" style={inp} />
                </div>
                <div>
                  <label style={{ fontSize:'0.72rem', fontWeight:700, color: textMut, display:'block', marginBottom:4, textTransform:'uppercase' }}>Year</label>
                  <select value={addYear} onChange={e=>setAddYear(e.target.value)} style={inp}>
                    <option value="">—</option>
                    {[1,2,3,4].map(y=><option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
                <button onClick={handleAddStudent} disabled={adding} style={btn('#667eea')}>{adding?'…':'Enrol'}</button>
              </div>
              {addMsg && <p style={{ margin:'0.75rem 0 0', fontSize:'0.85rem', color: addMsg.includes('✅') ? '#48bb78' : '#ed8936' }}>{addMsg}</p>}
            </div>

            <div style={{ ...card, borderTop:'3px solid #16A34A' }}>
              <h3 style={{ margin:'0 0 0.4rem', color: textPri }}>📧 Invite New Student</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:'0.75rem', alignItems:'end' }}>
                <div>
                  <label style={{ fontSize:'0.72rem', fontWeight:700, color: textMut, display:'block', marginBottom:4, textTransform:'uppercase' }}>Student Email</label>
                  <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="newstudent@email.com" style={inp} />
                </div>
                <button onClick={handleInvite} disabled={inviting||!inviteEmail.trim()} style={btn('#16A34A')}>{inviting?'…':'📧 Invite'}</button>
              </div>
              {inviteMsg && <div style={{ marginTop:'0.75rem', padding:'0.75rem', background: isDark?'rgba(72,187,120,0.08)':'#f0fdf4', borderRadius:8, fontSize:'0.82rem', color:'#48bb78', wordBreak:'break-all' }}>{inviteMsg}</div>}
            </div>

            <div style={card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                <h3 style={{ margin:0, color: textPri }}>All Students ({filtered.length})</h3>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search…" style={{ ...inp, width:220 }} />
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['#','Name','Email','Year','XP','Action'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.map((s,i) => (
                    <tr key={s.id} style={{ background: i%2===0 ? 'transparent' : (isDark?'rgba(255,255,255,0.015)':'rgba(0,0,0,0.012)') }}>
                      <td style={td}>{i+1}</td>
                      <td style={{ ...td, fontWeight:600, color: textPri }}>{s.name||'—'}</td>
                      <td style={{ ...td, color: textMut, fontSize:'0.78rem' }}>{s.email}</td>
                      <td style={td}>Yr {s.year||'—'}</td>
                      <td style={td}><span style={badge('#D97706')}>⭐ {s.xp||0}</span></td>
                      <td style={td}><button onClick={()=>handleRemoveStudent(s.id)} style={{ ...btn('#DC2626'), padding:'0.25rem 0.65rem', fontSize:'0.72rem' }}>Remove</button></td>
                    </tr>
                  ))}
                  {filtered.length===0 && <tr><td colSpan={6} style={{ padding:'2rem', textAlign:'center', color: textMut }}>No students</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── GROUPS ── */}
        {tab==='groups' && (
          <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:'1.5rem' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div style={{ ...card, borderTop:'3px solid #667eea' }}>
                <h4 style={{ margin:'0 0 0.75rem', color: textPri, fontSize:'0.9rem' }}>➕ New Group</h4>
                <input value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} placeholder="Group name" style={{ ...inp, marginBottom:'0.5rem' }} />
                <input value={newGroupDesc} onChange={e=>setNewGroupDesc(e.target.value)} placeholder="Description" style={{ ...inp, marginBottom:'0.75rem' }} />
                <div style={{ display:'flex', gap:'0.4rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
                  {GROUP_COLORS.map(c=><div key={c} onClick={()=>setNewGroupColor(c)} style={{ width:22, height:22, borderRadius:'50%', background:c, cursor:'pointer', border: newGroupColor===c?`3px solid ${textPri}`:'3px solid transparent' }} />)}
                </div>
                <button onClick={handleCreateGroup} disabled={creatingGroup||!newGroupName.trim()} style={{ ...btn('#667eea'), width:'100%' }}>{creatingGroup?'Creating…':'Create Group'}</button>
              </div>
              <div style={card}>
                <h4 style={{ margin:'0 0 0.75rem', color: textPri, fontSize:'0.9rem' }}>📚 Groups ({groups.length})</h4>
                {groups.length===0&&<p style={{ color: textMut, fontSize:'0.82rem' }}>No groups yet</p>}
                {groups.map(g=>(
                  <div key={g.id} onClick={()=>handleSelectGroup(g)} style={{ padding:'0.75rem', borderRadius:10, marginBottom:'0.35rem', cursor:'pointer', background: selGroup?.id===g.id ? `${g.color}12` : surfAlt, borderLeft:`3px solid ${g.color}`, border:`1px solid ${selGroup?.id===g.id ? `${g.color}30` : border}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontWeight:600, fontSize:'0.85rem', color: textPri }}>{g.name}</span>
                      <button onClick={e=>{e.stopPropagation();handleDeleteGroup(g.id);}} style={{ background:'none', border:'none', cursor:'pointer', color:'#f56565', fontSize:'0.78rem', padding:'0 0.2rem' }}>✕</button>
                    </div>
                    {g.description&&<div style={{ fontSize:'0.72rem', color: textMut, marginTop:2 }}>{g.description}</div>}
                  </div>
                ))}
              </div>
            </div>
            <div>
              {!selGroup ? (
                <div style={{ ...card, textAlign:'center', padding:'4rem', color: textMut }}>
                  <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>📚</div>
                  <p>Select a group to manage its resources</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                  <div style={{ ...card, borderTop:`3px solid ${selGroup.color}` }}>
                    <h3 style={{ margin:'0 0 1rem', color: selGroup.color }}>{selGroup.name}</h3>
                    <div style={{ display:'grid', gridTemplateColumns:'110px 1fr 1fr auto', gap:'0.6rem', alignItems:'end' }}>
                      <div>
                        <label style={{ fontSize:'0.72rem', fontWeight:700, color: textMut, display:'block', marginBottom:3, textTransform:'uppercase' }}>Type</label>
                        <select value={resType} onChange={e=>setResType(e.target.value)} style={inp}>
                          <option value="link">🔗 Link</option>
                          <option value="deadline">⏰ Deadline</option>
                          <option value="announcement">📢 Note</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize:'0.72rem', fontWeight:700, color: textMut, display:'block', marginBottom:3, textTransform:'uppercase' }}>Title</label>
                        <input value={resTitle} onChange={e=>setResTitle(e.target.value)} placeholder="Resource title" style={inp} />
                      </div>
                      <div>
                        <label style={{ fontSize:'0.72rem', fontWeight:700, color: textMut, display:'block', marginBottom:3, textTransform:'uppercase' }}>{resType==='deadline'?'Date':'URL / Note'}</label>
                        {resType==='deadline'
                          ?<input type="datetime-local" value={resDL} onChange={e=>setResDL(e.target.value)} style={inp} />
                          :<input value={resType==='link'?resUrl:resDesc} onChange={e=>resType==='link'?setResUrl(e.target.value):setResDesc(e.target.value)} placeholder={resType==='link'?'https://…':'Description'} style={inp} />
                        }
                      </div>
                      <button onClick={handleAddResource} disabled={addingRes||!resTitle.trim()} style={{ ...btn(selGroup.color), alignSelf:'flex-end' }}>{addingRes?'…':'Add'}</button>
                    </div>
                  </div>
                  <div style={card}>
                    <h4 style={{ margin:'0 0 1rem', color: textPri }}>Resources ({resources.length})</h4>
                    {resources.length===0&&<p style={{ color: textMut, textAlign:'center', padding:'1.5rem 0', fontSize:'0.85rem' }}>No resources yet</p>}
                    {resources.map(r=>(
                      <div key={r.id} style={{ display:'flex', gap:'0.75rem', padding:'0.75rem', borderRadius:8, background: surfAlt, marginBottom:'0.5rem', border:`1px solid ${border}` }}>
                        <span style={{ fontSize:'1.3rem' }}>{RESOURCE_ICONS[r.type]||'📄'}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:600, fontSize:'0.875rem', color: textPri }}>{r.title}</div>
                          {r.url&&<a href={r.url} target="_blank" rel="noreferrer" style={{ color:'#667eea', fontSize:'0.78rem', wordBreak:'break-all' }}>{r.url}</a>}
                          {r.description&&<div style={{ color: textSec, fontSize:'0.78rem', marginTop:2 }}>{r.description}</div>}
                          {r.deadline_at&&<div style={{ color:'#f56565', fontSize:'0.78rem', fontWeight:600, marginTop:2 }}>📅 Due: {new Date(r.deadline_at).toLocaleString()}</div>}
                          <div style={{ fontSize:'0.68rem', color: textMut, marginTop:3 }}>by {r.posted_by}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
                  const rate = s.challenges_completed>0 ? Math.min(100,Math.round((s.xp||0)/((s.challenges_completed||1)*10))) : 0;
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
            <h3 style={{ margin:'0 0 1.25rem', color: textPri }}>⚔️ Battle Performance</h3>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['Rank','Name','Year','Battles Won'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {[...students].sort((a,b)=>(b.battles_won||0)-(a.battles_won||0)).map((s,i)=>(
                  <tr key={s.id} style={{ background: i%2===0?'transparent':surfAlt }}>
                    <td style={td}>{i<3?['🥇','🥈','🥉'][i]:`#${i+1}`}</td>
                    <td style={{ ...td, fontWeight:600, color: textPri }}>{s.name||'—'}</td>
                    <td style={td}>Yr {s.year||'—'}</td>
                    <td style={td}><span style={badge('#6366F1')}>{s.battles_won||0} wins</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── ANNOUNCEMENTS ── */}
        {tab==='announcements' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
            <div style={{ ...card, borderTop:'3px solid #667eea' }}>
              <h3 style={{ margin:'0 0 0.4rem', color: textPri }}>📢 Send Announcement</h3>
              <p style={{ margin:'0 0 0.75rem', color: textMut, fontSize:'0.82rem' }}>All students in {profile?.department} will see this.</p>
              <textarea value={announcement} onChange={e=>setAnnouncement(e.target.value)} rows={4} placeholder="Type your announcement…" style={{ ...inp, resize:'vertical' }} />
              <div style={{ marginTop:'0.75rem', display:'flex', justifyContent:'flex-end' }}>
                <button onClick={handleSendAnnouncement} disabled={sending||!announcement.trim()} style={btn(sending?textMut:'#667eea')}>{sending?'Sending…':'📢 Send'}</button>
              </div>
            </div>
            <div style={card}>
              <h3 style={{ margin:'0 0 1rem', color: textPri }}>📋 Recent</h3>
              {announcements.length===0 ? (
                <div style={{ textAlign:'center', padding:'2rem', color: textMut }}>
                  <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>📭</div>
                  <p style={{ margin:0 }}>No announcements yet</p>
                </div>
              ) : announcements.map((a,i)=>(
                <div key={i} style={{ background: surfAlt, borderRadius:10, padding:'1rem', marginBottom:'0.75rem', borderLeft:'3px solid #667eea', border:`1px solid ${border}` }}>
                  <p style={{ margin:'0 0 0.4rem', color: textPri, fontWeight:500 }}>{a.message}</p>
                  <div style={{ fontSize:'0.72rem', color: textMut }}>By {a.sent_by} · {new Date(a.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
