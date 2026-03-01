// src/pages/PracticeHub.jsx
import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import questionService from '../services/questionService';
import practiceService from '../services/practiceService';

export default function PracticeHub() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [questions,         setQuestions]         = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [topics,            setTopics]            = useState([]);
  const [recentSessions,    setRecentSessions]    = useState([]);

  const [filters, setFilters] = useState({
    language:     params.get('lang')   || 'python',
    difficulty:   params.get('level')  || '',
    topic:        '',
    questionType: '',
  });

  useEffect(() => { loadData(); }, []);
  useEffect(() => { applyFilters(); }, [filters, questions]);

  async function loadData() {
    setLoading(true);
    const [{ data: qs }, { data: ts }, { data: ss }] = await Promise.all([
      questionService.getQuestions(),
      questionService.getTopics('python'),
      practiceService.getUserHistory(5),
    ]);
    setQuestions(qs || []);
    setTopics(ts || []);
    setRecentSessions(ss || []);
    setLoading(false);
  }

  function applyFilters() {
    let f = [...questions];
    if (filters.language && filters.language !== 'all') f = f.filter(q => q.language === filters.language || q.language === 'all');
    if (filters.difficulty)   f = f.filter(q => q.difficulty === filters.difficulty);
    if (filters.topic)        f = f.filter(q => q.topic === filters.topic);
    if (filters.questionType) f = f.filter(q => q.question_type === filters.questionType);
    setFilteredQuestions(f);
  }

  async function handleQuickPractice(difficulty) {
    const { data: session } = await practiceService.createSession({ language: 'python', difficulty, questionCount: 5 });
    if (session) navigate(`/practice/${session.id}`);
  }

  async function handleStartPractice() {
    if (!filteredQuestions.length) { alert('No questions match your filters!'); return; }
    const { data: session, error } = await practiceService.createSession({
      language: filters.language || 'python', difficulty: filters.difficulty || 'EASY', topic: filters.topic || null, questionCount: 10,
    });
    if (error) { alert('Error: ' + error.message); return; }
    navigate(`/practice/${session.id}`);
  }

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'80vh', background:'#0f1117' }}>
      <div style={{ width:36, height:36, border:'3px solid #1e2433', borderTopColor:'#667eea', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <p style={{ marginTop:'1rem', color:'#4a5568', fontFamily:'"Inter",sans-serif', fontSize:'0.9rem' }}>Loading your practice hub...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#0f1117', color:'white', fontFamily:'"Inter",sans-serif' }}>

      {/* ── Hero Header ── */}
      <div style={{ background:'linear-gradient(135deg,#141720 0%,#1a1d2e 100%)', borderBottom:'1px solid #1e2433', padding:'2.5rem 2rem 2rem' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
          <div>
            <div style={{ fontSize:'0.75rem', color:'#667eea', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'0.5rem' }}>
              LearnWithCresvia
            </div>
            <h1 style={{ fontSize:'2.25rem', fontWeight:800, margin:'0 0 0.5rem', background:'linear-gradient(135deg,#e2e8f0,#90CDF4)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              📚 Practice Hub
            </h1>
            <p style={{ color:'#4a5568', margin:0, fontSize:'1rem' }}>
              Master coding through challenges • {filteredQuestions.length} questions available
            </p>
          </div>
          <Link to="/dashboard" style={{ textDecoration:'none', color:'#667eea', background:'rgba(102,126,234,0.1)', border:'1px solid rgba(102,126,234,0.2)', padding:'0.6rem 1.25rem', borderRadius:10, fontSize:'0.875rem', fontWeight:600 }}>
            ← Dashboard
          </Link>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'2.5rem 2rem' }}>

        {/* ── Quick Start ── */}
        <section style={{ marginBottom:'3.5rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.5rem' }}>
            <div style={{ width:3, height:20, background:'linear-gradient(#667eea,#764ba2)', borderRadius:2 }} />
            <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:700, color:'#e2e8f0' }}>Quick Start</h2>
            <span style={{ color:'#2d3748', fontSize:'0.8rem' }}>Pick a difficulty and go</span>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem' }}>
            {[
              {
                level: 'EASY', icon: '🌱', label: 'Beginner',
                desc: 'Learn fundamentals and basic syntax. Perfect if you\'re just starting out.',
                color: '#48bb78', glow: 'rgba(72,187,120,0.15)',
                badge: 'Great for beginners', xp: '+10 XP each',
              },
              {
                level: 'MEDIUM', icon: '🚀', label: 'Intermediate',
                desc: 'Logic, algorithms, and problem solving. For students who know the basics.',
                color: '#ed8936', glow: 'rgba(237,137,54,0.15)',
                badge: 'Most popular', xp: '+25 XP each',
              },
              {
                level: 'HARD', icon: '🔥', label: 'Advanced',
                desc: 'Complex systems and optimisation. For experienced coders ready to be challenged.',
                color: '#f56565', glow: 'rgba(245,101,101,0.15)',
                badge: 'For the brave', xp: '+50 XP each',
              },
            ].map(item => (
              <QuickCard key={item.level} item={item} onClick={() => handleQuickPractice(item.level)} />
            ))}
          </div>
        </section>

        {/* ── Custom Training ── */}
        <section style={{ marginBottom:'3.5rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.5rem' }}>
            <div style={{ width:3, height:20, background:'linear-gradient(#667eea,#764ba2)', borderRadius:2 }} />
            <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:700, color:'#e2e8f0' }}>Custom Training</h2>
          </div>

          <div style={{ background:'#141720', borderRadius:16, padding:'1.75rem', border:'1px solid #1e2433' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'1.5rem' }}>
              {[
                { label:'Language', key:'language', options:[['python','🐍 Python'],['javascript','⚡ JavaScript'],['java','☕ Java'],['cpp','⚙️ C++'],['all','🌐 All']] },
                { label:'Difficulty', key:'difficulty', options:[['','All Levels'],['EASY','🌱 Easy'],['MEDIUM','🚀 Medium'],['HARD','🔥 Hard']] },
                { label:'Topic', key:'topic', options:[['','All Topics'],...topics.map(t=>[t,t])] },
                { label:'Type', key:'questionType', options:[['','All Types'],['CODING','💻 Coding'],['MCQ','📝 MCQ'],['OUTPUT','📤 Output']] },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:'0.72rem', fontWeight:600, color:'#4a5568', display:'block', marginBottom:'0.4rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>{f.label}</label>
                  <select value={filters[f.key]} onChange={e => setFilters(p=>({...p,[f.key]:e.target.value}))}
                    style={{ width:'100%', background:'#0f1117', color:'#e2e8f0', border:'1px solid #2d3748', borderRadius:8, padding:'0.6rem 0.75rem', fontSize:'0.875rem', outline:'none' }}>
                    {f.options.map(o=><option key={o[0]} value={o[0]}>{o[1]}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <button onClick={handleStartPractice}
              style={{ width:'100%', padding:'0.9rem', borderRadius:10, border:'none', background:'linear-gradient(135deg,#667eea,#764ba2)', color:'white', fontWeight:700, fontSize:'1rem', cursor:'pointer', letterSpacing:'0.01em' }}>
              Start Practice Session — {filteredQuestions.length} Questions Available
            </button>
          </div>
        </section>

        {/* ── Questions Grid ── */}
        <section style={{ marginBottom:'3.5rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <div style={{ width:3, height:20, background:'linear-gradient(#667eea,#764ba2)', borderRadius:2 }} />
              <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:700, color:'#e2e8f0' }}>Explore Questions</h2>
            </div>
            <span style={{ color:'#2d3748', fontSize:'0.8rem' }}>Showing {Math.min(filteredQuestions.length,12)} of {filteredQuestions.length}</span>
          </div>

          {filteredQuestions.length === 0 ? (
            <div style={{ textAlign:'center', padding:'4rem 2rem', background:'#141720', borderRadius:16, border:'1px solid #1e2433' }}>
              <div style={{ fontSize:'2rem', marginBottom:'1rem' }}>🔍</div>
              <p style={{ color:'#4a5568', marginBottom:'1rem', fontSize:'0.9rem' }}>No questions match your filters.</p>
              <button onClick={() => setFilters({ language:'python', difficulty:'', topic:'', questionType:'' })}
                style={{ color:'#667eea', background:'rgba(102,126,234,0.1)', border:'1px solid rgba(102,126,234,0.2)', padding:'0.5rem 1.25rem', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:'0.875rem' }}>
                Reset Filters
              </button>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:'1rem' }}>
              {filteredQuestions.slice(0,12).map(q=><QuestionCard key={q.id} question={q} />)}
            </div>
          )}
        </section>

        {/* ── Recent Sessions ── */}
        {recentSessions.length > 0 && (
          <section>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.5rem' }}>
              <div style={{ width:3, height:20, background:'linear-gradient(#667eea,#764ba2)', borderRadius:2 }} />
              <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:700, color:'#e2e8f0' }}>Your History</h2>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              {recentSessions.map(s=><SessionCard key={s.id} session={s} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ── Quick Start Card ──────────────────────────────────────────────────────────
function QuickCard({ item, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor:'pointer', padding:'1.75rem', borderRadius:16,
        background: hovered ? `linear-gradient(135deg,#1a1d27,${item.glow})` : '#141720',
        border:`1px solid ${hovered ? item.color + '40' : '#1e2433'}`,
        transition:'all 0.2s ease',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? `0 8px 30px ${item.glow}` : 'none',
        position:'relative', overflow:'hidden',
      }}
    >
      {/* Glow orb */}
      <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:item.glow, filter:'blur(20px)', opacity: hovered ? 1 : 0, transition:'opacity 0.3s' }} />

      <div style={{ fontSize:'2.25rem', marginBottom:'1rem' }}>{item.icon}</div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.5rem' }}>
        <h3 style={{ margin:0, fontSize:'1.1rem', fontWeight:700, color:'#e2e8f0' }}>{item.label}</h3>
        <span style={{ fontSize:'0.65rem', fontWeight:700, color:item.color, background:`${item.color}15`, padding:'2px 8px', borderRadius:20, border:`1px solid ${item.color}30`, whiteSpace:'nowrap' }}>
          {item.xp}
        </span>
      </div>
      <p style={{ color:'#4a5568', fontSize:'0.83rem', lineHeight:1.6, margin:'0 0 1.25rem' }}>{item.desc}</p>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:'0.72rem', color:item.color, fontWeight:600 }}>{item.badge}</span>
        <div style={{ width:28, height:28, borderRadius:'50%', background:`${item.color}15`, border:`1px solid ${item.color}30`, display:'flex', alignItems:'center', justifyContent:'center', color:item.color, fontSize:'0.875rem', transition:'transform 0.2s', transform:hovered?'translateX(3px)':'none' }}>
          →
        </div>
      </div>
    </div>
  );
}

// ── Question Card ─────────────────────────────────────────────────────────────
function QuestionCard({ question }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const dc = { EASY:'#48bb78', MEDIUM:'#ed8936', HARD:'#f56565' }[question.difficulty] || '#667eea';

  return (
    <div
      onClick={() => navigate(`/practice/question/${question.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor:'pointer', padding:'1.25rem', borderRadius:14,
        background:'#141720', border:`1px solid ${hovered?dc+'35':'#1e2433'}`,
        display:'flex', flexDirection:'column', justifyContent:'space-between',
        transition:'all 0.18s ease', transform:hovered?'translateY(-2px)':'none',
      }}
    >
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.875rem' }}>
          <h3 style={{ fontSize:'0.95rem', fontWeight:700, color:'#e2e8f0', margin:0, flex:1, lineHeight:1.4 }}>{question.title}</h3>
          <span style={{ fontSize:'0.65rem', fontWeight:700, color:dc, background:`${dc}12`, padding:'2px 8px', borderRadius:6, marginLeft:'0.5rem', flexShrink:0, border:`1px solid ${dc}25` }}>
            {question.difficulty}
          </span>
        </div>
        <p style={{ fontSize:'0.82rem', color:'#4a5568', lineHeight:1.6, marginBottom:'1rem' }}>
          {question.description?.substring(0,85)}...
        </p>
      </div>
      <div style={{ borderTop:'1px solid #1e2433', paddingTop:'0.875rem' }}>
        <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginBottom:'0.75rem' }}>
          <span style={{ fontSize:'0.68rem', background:'rgba(255,255,255,0.04)', color:'#4a5568', padding:'2px 8px', borderRadius:6, border:'1px solid #1e2433' }}>{question.language}</span>
          <span style={{ fontSize:'0.68rem', background:'rgba(255,255,255,0.04)', color:'#4a5568', padding:'2px 8px', borderRadius:6, border:'1px solid #1e2433' }}>{question.question_type}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ color:'#ed8936', fontWeight:700, fontSize:'0.85rem' }}>⭐ {question.points} XP</span>
          {question.success_rate != null && <span style={{ fontSize:'0.75rem', color:'#2d3748' }}>{question.success_rate}% solve rate</span>}
        </div>
      </div>
    </div>
  );
}

// ── Session Card ──────────────────────────────────────────────────────────────
function SessionCard({ session }) {
  const navigate = useNavigate();
  const statusColors = { COMPLETED:'#48bb78', IN_PROGRESS:'#667eea', ABANDONED:'#2d3748' };
  const sc = statusColors[session.status] || '#2d3748';

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.25rem', background:'#141720', borderRadius:12, border:'1px solid #1e2433' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
        <div style={{ width:38, height:38, borderRadius:10, background:'rgba(102,126,234,0.12)', border:'1px solid rgba(102,126,234,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'#667eea', fontSize:'1rem' }}>
          {session.language?.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight:700, color:'#e2e8f0', fontSize:'0.9rem' }}>{session.language} Practice</div>
          <div style={{ fontSize:'0.75rem', color:'#2d3748' }}>{new Date(session.started_at).toLocaleDateString()}</div>
        </div>
      </div>
      <div style={{ display:'flex', gap:'2.5rem', alignItems:'center' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:'0.65rem', color:'#2d3748', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>Score</div>
          <div style={{ fontWeight:700, color:'#e2e8f0', fontSize:'0.9rem' }}>{session.correct_answers}/{session.total_questions}</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:'0.65rem', color:'#2d3748', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>Status</div>
          <div style={{ fontWeight:700, color:sc, fontSize:'0.8rem' }}>{session.status}</div>
        </div>
        {session.status === 'IN_PROGRESS' && (
          <button onClick={() => navigate(`/practice/${session.id}`)}
            style={{ padding:'0.45rem 1rem', borderRadius:8, border:'none', background:'rgba(102,126,234,0.15)', color:'#667eea', fontWeight:600, cursor:'pointer', fontSize:'0.82rem', border:'1px solid rgba(102,126,234,0.2)' }}>
            Resume →
          </button>
        )}
      </div>
    </div>
  );
}
