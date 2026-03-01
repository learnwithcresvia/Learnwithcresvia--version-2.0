// src/pages/StudentDashboard.jsx
// No top header — navigation is handled by AppLayout sidebar
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../utils/supabaseClient';
import AIInsights from '../components/AIInsights';

export default function StudentDashboard() {
  const { user, profile } = useAuth();
  const { isDark } = useTheme();

  const [stats,               setStats]               = useState(null);
  const [announcements,       setAnnouncements]       = useState([]);
  const [recentSubmissions,   setRecentSubmissions]   = useState([]);
  const [leaderboardPosition, setLeaderboardPosition] = useState(null);
  const [loading,             setLoading]             = useState(true);

  useEffect(() => { loadDashboardData(); }, [profile]);

  async function loadDashboardData() {
    if (!user) { setLoading(false); return; }
    try {
      setLoading(true);

      const { data: submissions } = await supabase
        .from('practice_attempts')
        .select('*, question:questions(title, difficulty, topic)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentSubmissions(submissions || []);

      const { data: ann } = await supabase
        .from('announcements')
        .select('*')
        .or(`department.is.null,department.eq.${profile?.department || 'CSE'}`)
        .order('created_at', { ascending: false })
        .limit(3);
      setAnnouncements(ann || []);

      const { data: allAttempts } = await supabase
        .from('practice_attempts')
        .select('is_correct')
        .eq('user_id', user.id);

      const total   = allAttempts?.length || 0;
      const correct = allAttempts?.filter(a => a.is_correct).length || 0;
      setStats({
        ...(profile || {}),
        totalAttempts: total,
        successRate:   total > 0 ? Math.round((correct / total) * 100) : 0,
      });

      const { count: above } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'STUDENT')
        .gt('xp', profile?.xp || 0);
      setLeaderboardPosition((above || 0) + 1);

    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Theme ─────────────────────────────────────────────────────────────────────
  const bg      = isDark ? '#0f1117' : '#f8fafc';
  const surface = isDark ? '#141720' : '#ffffff';
  const border  = isDark ? '#1e2433' : '#e5e7eb';
  const textPri = isDark ? '#e2e8f0' : '#1e293b';
  const textSec = isDark ? '#a0aec0' : '#64748b';
  const textMut = isDark ? '#4a5568' : '#94a3b8';

  const latestAnn = announcements[0];

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background: bg }}>
        <div style={{ width:36, height:36, border:`3px solid ${border}`, borderTopColor:'#667eea', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background: bg, fontFamily:'"Inter",Arial,sans-serif', color: textPri }}>

      {/* ── Announcement Banner ── */}
      {latestAnn && (
        <div style={{ background:'linear-gradient(135deg,#4F46E5,#7C3AED)', padding:'0.65rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <span>📢</span>
            <span style={{ color:'white', fontWeight:600, fontSize:'0.875rem' }}>
              {latestAnn.title && <strong>{latestAnn.title}: </strong>}
              {latestAnn.message.length > 100 ? latestAnn.message.substring(0,100)+'…' : latestAnn.message}
            </span>
          </div>
          <Link to="/announcements" style={{ color:'rgba(255,255,255,0.85)', fontSize:'0.8rem', fontWeight:600, textDecoration:'none', background:'rgba(255,255,255,0.15)', padding:'0.25rem 0.75rem', borderRadius:8 }}>
            View All →
          </Link>
        </div>
      )}

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'2rem' }}>

        {/* ── Welcome ── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem' }}>
          <div>
            <h1 style={{ fontSize:'1.6rem', fontWeight:800, margin:'0 0 0.25rem', color: textPri }}>
              Welcome back, {profile?.name?.split(' ')[0] || 'there'}! 👋
            </h1>
            <p style={{ color: textSec, margin:0, fontSize:'0.9rem' }}>{profile?.department} · Year {profile?.year}</p>
          </div>
          <div style={{ display:'flex', gap:'0.75rem' }}>
            <Link to="/language-survey" style={{ padding:'0.6rem 1.25rem', background:'linear-gradient(135deg,#667eea,#764ba2)', color:'white', borderRadius:10, textDecoration:'none', fontWeight:700, fontSize:'0.875rem' }}>🚀 Start Practice</Link>
            <Link to="/battle-arena"   style={{ padding:'0.6rem 1.25rem', background:'rgba(245,101,101,0.1)', color:'#f56565', border:'1px solid rgba(245,101,101,0.2)', borderRadius:10, textDecoration:'none', fontWeight:700, fontSize:'0.875rem' }}>⚔️ Battle</Link>
          </div>
        </div>

        <AIInsights />

        {/* ── Stats ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'1rem', marginBottom:'2rem' }}>
          {[
            { icon:'⭐', label:'Total XP',         value: profile?.xp || 0,                    color:'#D97706' },
            { icon:'✅', label:'Questions Solved',  value: profile?.challenges_completed || 0,  color:'#16A34A' },
            { icon:'⚔️', label:'Battles Won',       value: profile?.battles_won || 0,           color:'#DC2626' },
            { icon:'📊', label:'Success Rate',      value:`${stats?.successRate || 0}%`,        color:'#0891B2' },
            { icon:'🏆', label:'Global Rank',       value:`#${leaderboardPosition || '—'}`,    color:'#7C3AED' },
          ].map((s, i) => (
            <div key={i} style={{ background: surface, borderRadius:14, padding:'1.25rem', border:`1px solid ${border}`, borderLeft:`4px solid ${s.color}` }}>
              <div style={{ fontSize:'1.5rem', marginBottom:'0.5rem' }}>{s.icon}</div>
              <div style={{ fontSize:'1.6rem', fontWeight:900, color: textPri, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:'0.72rem', color: textMut, marginTop:'0.25rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Study Hub callout ── */}
        <div style={{ background: isDark ? 'rgba(102,126,234,0.08)' : 'rgba(79,70,229,0.04)', border:`1px solid ${isDark ? 'rgba(102,126,234,0.18)' : 'rgba(79,70,229,0.1)'}`, borderRadius:14, padding:'1.25rem 1.5rem', marginBottom:'2rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:700, color: textPri, marginBottom:'0.2rem' }}>📖 Study Hub</div>
            <div style={{ fontSize:'0.82rem', color: textSec }}>Notes, videos, AI summaries, quiz bot and flashcards — all in one place</div>
          </div>
          <Link to="/study-hub" style={{ padding:'0.55rem 1.25rem', background:'linear-gradient(135deg,#667eea,#764ba2)', color:'white', borderRadius:10, textDecoration:'none', fontWeight:700, fontSize:'0.875rem', whiteSpace:'nowrap', flexShrink:0 }}>
            Open Study Hub →
          </Link>
        </div>

        {/* ── Recent Activity ── */}
        <div style={{ background: surface, borderRadius:14, padding:'1.5rem', border:`1px solid ${border}` }}>
          <h3 style={{ color: textPri, margin:'0 0 1.25rem', fontSize:'1rem', fontWeight:700 }}>📋 Recent Activity</h3>

          {recentSubmissions.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem', color: textMut }}>
              <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>🚀</div>
              <p style={{ margin:'0 0 1rem' }}>No activity yet. Start your first practice session!</p>
              <Link to="/practice-hub" style={{ padding:'0.6rem 1.5rem', background:'linear-gradient(135deg,#667eea,#764ba2)', color:'white', borderRadius:10, textDecoration:'none', fontWeight:700, fontSize:'0.875rem' }}>Start Practicing</Link>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              {recentSubmissions.map(attempt => {
                const diffColor = { EASY:'#16A34A', MEDIUM:'#D97706', HARD:'#DC2626' }[attempt.question?.difficulty] || '#6B7280';
                return (
                  <div key={attempt.id} style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'0.875rem', background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderRadius:10, border:`1px solid ${border}` }}>
                    <div style={{ fontSize:'1.3rem' }}>{attempt.is_correct ? '✅' : '❌'}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, color: textPri, fontSize:'0.9rem' }}>{attempt.question?.title || 'Question'}</div>
                      <div style={{ display:'flex', gap:'0.4rem', marginTop:'0.25rem' }}>
                        {attempt.question?.difficulty && (
                          <span style={{ background:`${diffColor}18`, color: diffColor, padding:'1px 8px', borderRadius:20, fontSize:'0.72rem', fontWeight:700, border:`1px solid ${diffColor}30` }}>
                            {attempt.question.difficulty}
                          </span>
                        )}
                        {attempt.question?.topic && (
                          <span style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', color: textMut, padding:'1px 8px', borderRadius:20, fontSize:'0.72rem' }}>
                            {attempt.question.topic}
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontWeight:700, color: attempt.is_correct ? '#16A34A' : '#DC2626', fontSize:'0.875rem' }}>
                      {attempt.is_correct ? `+${attempt.points_earned} XP` : 'Incorrect'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
