// src/pages/AnnouncementsPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabaseClient';

export default function AnnouncementsPage() {
  const { profile } = useAuth();
  const navigate    = useNavigate();
  const [announcements, setAnnouncements] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [filter,        setFilter]        = useState('all');

  useEffect(() => { if (profile) load(); else setLoading(false); }, [profile]);

  async function load() {
    // Get college-wide + department-specific announcements
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .or(`department.is.null,department.eq.${profile?.department || ''}`)
      .order('created_at', { ascending: false });
    setAnnouncements(data || []);
    setLoading(false);
  }

  const ROLE_COLORS = { DIRECTOR:'#4F46E5', HOD:'#7C3AED', COORDINATOR:'#0891B2', STAFF:'#16A34A', ADMIN:'#DC2626' };
  const ROLE_ICONS  = { DIRECTOR:'🎓', HOD:'🏛️', COORDINATOR:'📋', STAFF:'👨‍🏫', ADMIN:'🛡️' };

  const filtered = filter === 'all' ? announcements
    : filter === 'college' ? announcements.filter(a => !a.department)
    : announcements.filter(a => a.department === profile.department);

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}><p>Loading...</p></div>;

  return (
    <div style={{ minHeight:'100vh', background:'#F0F4FF', fontFamily:'Arial,sans-serif' }}>
      <header style={{ background:'linear-gradient(135deg,#667eea,#764ba2)', padding:'1rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ margin:0, color:'white', fontSize:'1.4rem', fontWeight:800 }}>📢 Announcements</h1>
          <p style={{ margin:0, color:'rgba(255,255,255,0.75)', fontSize:'0.82rem' }}>{profile?.department} · {profile?.name}</p>
        </div>
        <button onClick={() => navigate('/dashboard')} style={{ padding:'0.5rem 1.25rem', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.4)', color:'white', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
          ← Back
        </button>
      </header>

      <div style={{ maxWidth:800, margin:'2rem auto', padding:'0 2rem' }}>

        {/* Filter */}
        <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.5rem', background:'white', padding:'0.4rem', borderRadius:10, width:'fit-content', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          {[{key:'all',label:'📋 All'},{key:'college',label:'🌐 College-wide'},{key:'dept',label:`🏛️ ${profile?.department}`}].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding:'0.5rem 1rem', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:'0.85rem', background:filter===f.key?'#667eea':'transparent', color:filter===f.key?'white':'#6B7280' }}>
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ background:'white', borderRadius:14, padding:'3rem', textAlign:'center', boxShadow:'0 2px 12px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize:'3rem', marginBottom:'0.75rem' }}>📭</div>
            <p style={{ color:'#9CA3AF', margin:0 }}>No announcements yet</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            {filtered.map((a, i) => {
              const color = ROLE_COLORS[a.role] || '#667eea';
              const icon  = ROLE_ICONS[a.role]  || '📢';
              const isNew = (Date.now() - new Date(a.created_at)) < 48*60*60*1000;
              return (
                <div key={a.id||i} style={{ background:'white', borderRadius:14, padding:'1.5rem', boxShadow:'0 2px 12px rgba(0,0,0,0.07)', borderLeft:`4px solid ${color}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.75rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                      <span style={{ fontSize:'1.3rem' }}>{icon}</span>
                      <div>
                        {a.title && <div style={{ fontWeight:700, fontSize:'1rem', color:'#1F2937' }}>{a.title}</div>}
                        <div style={{ fontSize:'0.78rem', color:'#9CA3AF' }}>
                          by {a.sent_by} · <span style={{ background:color+'20', color, padding:'1px 8px', borderRadius:20, fontWeight:600 }}>{a.role}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexShrink:0 }}>
                      {isNew && <span style={{ background:'#FEF9C3', color:'#CA8A04', padding:'2px 8px', borderRadius:20, fontSize:'0.72rem', fontWeight:700 }}>NEW</span>}
                      <span style={{ background:a.department?'#F0FDF4':'#EEF2FF', color:a.department?'#16A34A':'#4F46E5', padding:'2px 8px', borderRadius:20, fontSize:'0.72rem', fontWeight:600 }}>
                        {a.department || '🌐 College-wide'}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin:0, color:'#374151', lineHeight:1.6 }}>{a.message}</p>
                  <div style={{ marginTop:'0.75rem', fontSize:'0.78rem', color:'#9CA3AF' }}>
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
