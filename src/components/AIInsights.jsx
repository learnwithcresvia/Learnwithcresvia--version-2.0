// src/components/AIInsights.jsx
// Works for both students (personal analysis) and staff/hod (department analysis)

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabaseClient';
import ragService from '../services/ragService';

export default function AIInsights({ mode = 'student' }) {
  const { user, profile } = useAuth();
  const [insight,    setInsight]    = useState('');
  const [weakTopics, setWeakTopics] = useState([]);
  const [strongTopics, setStrongTopics] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [loaded,     setLoaded]     = useState(false);

  useEffect(() => { if (user) loadInsights(); }, [user]);

  async function loadInsights() {
    setLoading(true);
    try {
      let attempts = [];

      if (mode === 'student') {
        const { data } = await supabase
          .from('practice_attempts')
          .select('is_correct, question:questions(topic)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30);
        attempts = (data || []).map(a => ({ topic: a.question?.topic || 'General', is_correct: a.is_correct }));
      } else {
        const { data: students } = await supabase.from('profiles').select('id').eq('department', profile?.department).eq('role', 'STUDENT');
        if (students?.length) {
          const { data } = await supabase.from('practice_attempts').select('is_correct, question:questions(topic)').in('user_id', students.map(s=>s.id)).order('created_at', {ascending:false}).limit(100);
          attempts = (data || []).map(a => ({ topic: a.question?.topic || 'General', is_correct: a.is_correct }));
        }
      }

      if (attempts.length < 3) {
        setInsight(mode === 'student' ? "Complete 3+ practice questions to unlock your AI analysis!" : "Students need more practice for department insights.");
        setLoading(false); setLoaded(true);
        return;
      }

      const topicStats = {};
      attempts.forEach(a => {
        if (!topicStats[a.topic]) topicStats[a.topic] = { correct:0, total:0 };
        topicStats[a.topic].total++;
        if (a.is_correct) topicStats[a.topic].correct++;
      });

      const allTopics = Object.entries(topicStats).filter(([_,s]) => s.total >= 2);
      const weak = allTopics.filter(([_,s]) => (s.correct/s.total) < 0.6).sort((a,b) => (a[1].correct/a[1].total)-(b[1].correct/b[1].total)).slice(0,3).map(([t,s]) => ({topic:t, rate:Math.round((s.correct/s.total)*100)}));
      const strong = allTopics.filter(([_,s]) => (s.correct/s.total) >= 0.8).sort((a,b) => (b[1].correct/b[1].total)-(a[1].correct/a[1].total)).slice(0,2).map(([t,s]) => ({topic:t, rate:Math.round((s.correct/s.total)*100)}));

      setWeakTopics(weak);
      setStrongTopics(strong);

      const analysis = await ragService.analyseWeakness(attempts);
      setInsight(analysis);
    } catch (e) {
      setInsight("Practice more to unlock AI!");
    }
    setLoading(false); setLoaded(true);
  }

  const isStaff = mode === 'staff';
  const bg = isStaff ? 'linear-gradient(135deg,#065F46,#047857)' : 'linear-gradient(135deg,#1E1B4B,#4F46E5)';

  return (
    <div style={{ background:bg, borderRadius:16, padding:'1.5rem', color:'white', marginBottom:'1.5rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem' }}>
        <span style={{ fontSize:'1.8rem' }}>🤖</span>
        <div>
          <h3 style={{ margin:0, fontSize:'1rem', fontWeight:800 }}>Cresvia AI {isStaff ? '— Department Insights' : '— Your Coach'}</h3>
          <p style={{ margin:0, fontSize:'0.78rem', color:'rgba(255,255,255,0.7)' }}>
            {isStaff ? `Analysis of ${profile?.department} students` : 'Personalised analysis based on your practice'}
          </p>
        </div>
        <button onClick={loadInsights} disabled={loading} style={{ marginLeft:'auto', padding:'0.4rem 0.85rem', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', color:'white', borderRadius:8, cursor:'pointer', fontSize:'0.78rem', fontWeight:600 }}>
          {loading ? '⏳' : '🔄'}
        </button>
      </div>

      {loading ? (
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem', background:'rgba(255,255,255,0.1)', borderRadius:10 }}>
          <div style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <span style={{ fontSize:'0.85rem' }}>Analysing performance...</span>
        </div>
      ) : (
        <>
          {insight && (
            <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:10, padding:'1rem', marginBottom:'0.75rem', fontSize:'0.88rem', lineHeight:1.6, borderLeft:'3px solid rgba(255,255,255,0.4)' }}>
              💡 {insight}
            </div>
          )}

          {weakTopics.length > 0 && (
            <div style={{ marginBottom:'0.75rem' }}>
              <p style={{ margin:'0 0 0.5rem', fontSize:'0.78rem', color:'rgba(255,255,255,0.7)', fontWeight:600 }}>NEEDS ATTENTION</p>
              <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                {weakTopics.map((w,i) => (
                  <div key={i} style={{ background:'rgba(220,38,38,0.3)', border:'1px solid rgba(220,38,38,0.5)', padding:'0.3rem 0.75rem', borderRadius:20, fontSize:'0.78rem', fontWeight:600 }}>
                    ⚠️ {w.topic} — {w.rate}%
                  </div>
                ))}
              </div>
            </div>
          )}

          {strongTopics.length > 0 && (
            <div>
              <p style={{ margin:'0 0 0.5rem', fontSize:'0.78rem', color:'rgba(255,255,255,0.7)', fontWeight:600 }}>STRENGTHS</p>
              <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                {strongTopics.map((s,i) => (
                  <div key={i} style={{ background:'rgba(22,163,74,0.3)', border:'1px solid rgba(22,163,74,0.5)', padding:'0.3rem 0.75rem', borderRadius:20, fontSize:'0.78rem', fontWeight:600 }}>
                    ✅ {s.topic} — {s.rate}%
                  </div>
                ))}
              </div>
            </div>
          )}

          {loaded && weakTopics.length === 0 && strongTopics.length === 0 && insight.includes('Complete') && (
            <div style={{ textAlign:'center', padding:'1rem', color:'rgba(255,255,255,0.7)', fontSize:'0.85rem' }}>
              {mode === 'student' ? '🎯 Practice more questions to unlock insights!' : '📊 Students need more practice data'}
            </div>
          )}
        </>
      )}
    </div>
  );
}
