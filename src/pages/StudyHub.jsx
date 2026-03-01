// src/pages/StudyHub.jsx
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabaseClient';

const DEPARTMENTS = ['CSE','IT','ECE','EEE','MECH','CIVIL','AIDS','AIML'];
const SEMESTERS   = [1,2,3,4,5,6,7,8];

export default function StudyHub() {
  const { profile } = useAuth();
  const navigate    = useNavigate();

  const [subjects,  setSubjects]  = useState([]);
  const [progress,  setProgress]  = useState({}); // subjectId → {done, total}
  const [loading,   setLoading]   = useState(true);
  const [dept,      setDept]      = useState(profile?.department || 'CSE');
  const [sem,       setSem]       = useState(null);
  const [search,    setSearch]    = useState('');

  useEffect(() => { loadSubjects(); }, [dept, sem]);

  async function loadSubjects() {
    setLoading(true);
    let q = supabase.from('subjects').select('*').eq('department', dept).order('semester').order('name');
    if (sem) q = q.eq('semester', sem);
    const { data } = await q;
    setSubjects(data || []);

    // Load progress for each subject
    if (data?.length) {
      const ids = data.map(s => s.id);
      const { data: units }   = await supabase.from('units').select('id, subject_id').in('subject_id', ids);
      const unitIds = units?.map(u => u.id) || [];

      if (unitIds.length) {
        const { data: done } = await supabase.from('topic_progress')
          .select('unit_id, subject_id').eq('completed', true).in('unit_id', unitIds);

        const prog = {};
        for (const s of data) {
          const sUnits = units.filter(u => u.subject_id === s.id);
          const sDone  = done?.filter(d => d.subject_id === s.id) || [];
          prog[s.id]   = { done: sDone.length, total: sUnits.length };
        }
        setProgress(prog);
      }
    }
    setLoading(false);
  }

  const filtered = subjects.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.code?.toLowerCase().includes(search.toLowerCase()));
  const bySem    = filtered.reduce((acc, s) => { (acc[s.semester] = acc[s.semester] || []).push(s); return acc; }, {});

  return (
    <div style={{ minHeight:'100vh', background:'#0f1117', color:'white', fontFamily:'"Inter",sans-serif' }}>

      {/* Header */}
      <div style={{ background:'#141720', borderBottom:'1px solid #1e2433', padding:'1.5rem 2rem' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
          <div>
            <div style={{ fontSize:'0.72rem', color:'#667eea', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'0.4rem' }}>LearnWithCresvia</div>
            <h1 style={{ fontSize:'2rem', fontWeight:800, margin:'0 0 0.3rem', background:'linear-gradient(135deg,#e2e8f0,#90CDF4)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              📖 Study Hub
            </h1>
            <p style={{ color:'#4a5568', margin:0, fontSize:'0.9rem' }}>Learning materials organised by semester and subject</p>
          </div>
          <Link to="/dashboard" style={{ textDecoration:'none', color:'#667eea', background:'rgba(102,126,234,0.1)', border:'1px solid rgba(102,126,234,0.2)', padding:'0.55rem 1.25rem', borderRadius:10, fontSize:'0.85rem', fontWeight:600 }}>← Dashboard</Link>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'2rem' }}>

        {/* Filters */}
        <div style={{ display:'flex', gap:'0.75rem', marginBottom:'2rem', flexWrap:'wrap', alignItems:'center' }}>
          {/* Search */}
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search subjects..."
            style={{ background:'#141720', border:'1px solid #1e2433', color:'#e2e8f0', borderRadius:10, padding:'0.6rem 1rem', fontSize:'0.875rem', outline:'none', width:220 }} />

          {/* Department */}
          <select value={dept} onChange={e=>setDept(e.target.value)}
            style={{ background:'#141720', border:'1px solid #1e2433', color:'#e2e8f0', borderRadius:10, padding:'0.6rem 1rem', fontSize:'0.875rem', outline:'none' }}>
            {DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}
          </select>

          {/* Semester pills */}
          <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
            <button onClick={()=>setSem(null)}
              style={{ padding:'0.45rem 0.875rem', borderRadius:20, border:`1px solid ${!sem?'#667eea':'#1e2433'}`, background:!sem?'rgba(102,126,234,0.15)':'transparent', color:!sem?'#8b9cf4':'#4a5568', cursor:'pointer', fontSize:'0.78rem', fontWeight:600 }}>
              All Sems
            </button>
            {SEMESTERS.map(s=>(
              <button key={s} onClick={()=>setSem(s===sem?null:s)}
                style={{ padding:'0.45rem 0.75rem', borderRadius:20, border:`1px solid ${sem===s?'#667eea':'#1e2433'}`, background:sem===s?'rgba(102,126,234,0.15)':'transparent', color:sem===s?'#8b9cf4':'#4a5568', cursor:'pointer', fontSize:'0.78rem', fontWeight:600 }}>
                Sem {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'4rem' }}>
            <div style={{ width:36, height:36, border:'3px solid #1e2433', borderTopColor:'#667eea', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 1rem' }} />
            <div style={{ color:'#4a5568' }}>Loading subjects...</div>
          </div>
        ) : Object.keys(bySem).length === 0 ? (
          <div style={{ textAlign:'center', padding:'4rem', background:'#141720', borderRadius:16, border:'1px solid #1e2433' }}>
            <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>📚</div>
            <p style={{ color:'#4a5568' }}>No subjects found for {dept}{sem ? ` Sem ${sem}` : ''}.</p>
            <p style={{ color:'#2d3748', fontSize:'0.85rem' }}>Ask your staff to add study materials.</p>
          </div>
        ) : (
          Object.entries(bySem).sort(([a],[b])=>a-b).map(([semester, subs]) => (
            <div key={semester} style={{ marginBottom:'2.5rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem' }}>
                <div style={{ width:3, height:20, background:'linear-gradient(#667eea,#764ba2)', borderRadius:2 }} />
                <h2 style={{ margin:0, fontSize:'1rem', fontWeight:700, color:'#e2e8f0' }}>Semester {semester}</h2>
                <span style={{ color:'#2d3748', fontSize:'0.8rem' }}>{subs.length} subject{subs.length!==1?'s':''}</span>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'1rem' }}>
                {subs.map(subject => {
                  const p = progress[subject.id] || { done:0, total:0 };
                  const pct = p.total ? Math.round((p.done/p.total)*100) : 0;
                  return (
                    <SubjectCard key={subject.id} subject={subject} pct={pct} p={p}
                      onClick={() => navigate(`/study-hub/subject/${subject.id}`)} />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function SubjectCard({ subject, pct, p, onClick }) {
  const [hovered, setHovered] = useState(false);
  const colors = ['#667eea','#48bb78','#ed8936','#f56565','#9f7aea','#38b2ac','#ed64a6','#4299e1'];
  const color  = colors[subject.name.charCodeAt(0) % colors.length];

  return (
    <div onClick={onClick} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{ cursor:'pointer', padding:'1.25rem', borderRadius:14, background:'#141720', border:`1px solid ${hovered?color+'40':'#1e2433'}`, transition:'all 0.18s', transform:hovered?'translateY(-2px)':'none', boxShadow:hovered?`0 8px 24px ${color}15`:'' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.75rem' }}>
        <div style={{ width:40, height:40, borderRadius:10, background:`${color}18`, border:`1px solid ${color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>
          📘
        </div>
        {subject.code && <span style={{ fontSize:'0.68rem', color:'#4a5568', background:'rgba(255,255,255,0.04)', padding:'2px 8px', borderRadius:6, border:'1px solid #1e2433' }}>{subject.code}</span>}
      </div>

      <h3 style={{ margin:'0 0 0.35rem', fontSize:'0.95rem', fontWeight:700, color:'#e2e8f0' }}>{subject.name}</h3>
      {subject.description && <p style={{ color:'#4a5568', fontSize:'0.8rem', margin:'0 0 1rem', lineHeight:1.5 }}>{subject.description.substring(0,70)}...</p>}

      {/* Progress */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.4rem' }}>
          <span style={{ fontSize:'0.7rem', color:'#4a5568' }}>{p.done}/{p.total} units done</span>
          <span style={{ fontSize:'0.7rem', color:pct===100?'#48bb78':color, fontWeight:600 }}>{pct}%</span>
        </div>
        <div style={{ height:4, background:'#1e2433', borderRadius:2, overflow:'hidden' }}>
          <div style={{ width:`${pct}%`, height:'100%', background:pct===100?'#48bb78':`linear-gradient(90deg,${color},${color}aa)`, borderRadius:2, transition:'width 0.5s' }} />
        </div>
      </div>
    </div>
  );
}
