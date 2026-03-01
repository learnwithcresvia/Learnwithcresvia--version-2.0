// src/pages/AIQuestionGenerator.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabaseClient';
import ragService from '../services/ragService';

const TOPICS = ['Variables','Loops','Functions','Lists','Strings','Dictionaries','Recursion','OOP','Sorting','File I/O','Exception Handling','Comprehensions','Generators','Decorators'];
const DIFFICULTIES = ['EASY','MEDIUM','HARD'];
const LANGUAGES    = ['Python','JavaScript','Java','C++'];
const DIFF_COLORS  = { EASY:'#16A34A', MEDIUM:'#D97706', HARD:'#DC2626' };

export default function AIQuestionGenerator() {
  const { profile } = useAuth();
  const navigate    = useNavigate();

  const [topic,      setTopic]      = useState('Functions');
  const [difficulty, setDifficulty] = useState('EASY');
  const [language,   setLanguage]   = useState('Python');
  const [count,      setCount]      = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generated,  setGenerated]  = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState([]);
  const [error,      setError]      = useState('');

  const backRoute = profile?.role === 'ADMIN' ? '/admin'
    : profile?.role === 'HOD'  ? '/hod-dashboard'
    : '/staff-dashboard';

  async function handleGenerate() {
    setGenerating(true); setError(''); setGenerated([]); setSaved([]);
    try {
      const questions = await ragService.generateQuestions(topic, difficulty, language, count);
      setGenerated(questions);
    } catch (e) {
      setError('Generation failed — check your VITE_GEMINI_API_KEY in .env and try again. Error: ' + e.message);
    }
    setGenerating(false);
  }

  async function handleSave(q, index) {
    setSaving(true);
    try {
      const { error: err } = await supabase.from('questions').insert({
        title:        q.title,
        description:  q.description,
        topic:        q.topic,
        difficulty:   q.difficulty,
        language:     q.language?.toLowerCase(),
        starter_code: q.starter_code,
        test_cases:   q.test_cases,
        hints:        q.hints,
        created_by:   profile?.id,
        is_active:    true,
      });
      if (err) throw err;
      setSaved(prev => [...prev, index]);
    } catch (e) {
      setError('Save failed: ' + e.message);
    }
    setSaving(false);
  }

  async function handleSaveAll() {
    for (let i = 0; i < generated.length; i++) {
      if (!saved.includes(i)) await handleSave(generated[i], i);
    }
  }

  const C = {
    page:  { minHeight:'100vh', background:'#F0F4FF', fontFamily:'Arial,sans-serif' },
    card:  { background:'white', borderRadius:14, padding:'1.5rem', boxShadow:'0 2px 12px rgba(0,0,0,0.07)' },
    input: { width:'100%', padding:'0.65rem 0.9rem', border:'1.5px solid #E5E7EB', borderRadius:8, fontSize:'0.9rem', outline:'none', boxSizing:'border-box' },
    btn:   (c, off) => ({ padding:'0.65rem 1.5rem', background:off?'#9CA3AF':c, color:'white', border:'none', borderRadius:8, cursor:off?'not-allowed':'pointer', fontWeight:700, fontSize:'0.88rem' }),
    badge: (c) => ({ background:c+'20', color:c, padding:'3px 10px', borderRadius:20, fontWeight:700, fontSize:'0.78rem' }),
  };

  return (
    <div style={C.page}>
      <header style={{ background:'linear-gradient(135deg,#1E1B4B,#4F46E5)', padding:'1rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ margin:0, color:'white', fontSize:'1.4rem', fontWeight:800 }}>🤖 AI Question Generator</h1>
          <p style={{ margin:0, color:'rgba(255,255,255,0.7)', fontSize:'0.82rem' }}>Powered by Google Gemini · Free tier · Generate questions instantly</p>
        </div>
        <button onClick={() => navigate(backRoute)} style={{ padding:'0.5rem 1.25rem', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.4)', color:'white', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
          ← Back
        </button>
      </header>

      <div style={{ maxWidth:1100, margin:'2rem auto', padding:'0 2rem' }}>

        {/* Controls */}
        <div style={{ ...C.card, borderTop:'3px solid #4F46E5', marginBottom:'1.5rem' }}>
          <h3 style={{ margin:'0 0 1.25rem' }}>⚙️ Configure</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 100px auto', gap:'1rem', alignItems:'end' }}>
            <div>
              <label style={{ display:'block', fontWeight:600, fontSize:'0.82rem', color:'#6B7280', marginBottom:4 }}>Topic</label>
              <select value={topic} onChange={e=>setTopic(e.target.value)} style={C.input}>
                {TOPICS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontWeight:600, fontSize:'0.82rem', color:'#6B7280', marginBottom:4 }}>Difficulty</label>
              <select value={difficulty} onChange={e=>setDifficulty(e.target.value)} style={C.input}>
                {DIFFICULTIES.map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontWeight:600, fontSize:'0.82rem', color:'#6B7280', marginBottom:4 }}>Language</label>
              <select value={language} onChange={e=>setLanguage(e.target.value)} style={C.input}>
                {LANGUAGES.map(l=><option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontWeight:600, fontSize:'0.82rem', color:'#6B7280', marginBottom:4 }}>Count</label>
              <select value={count} onChange={e=>setCount(parseInt(e.target.value))} style={C.input}>
                {[1,2,3,5].map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={handleGenerate} disabled={generating} style={C.btn('#4F46E5', generating)}>
              {generating ? '⏳ Generating...' : '🤖 Generate'}
            </button>
          </div>

          {generating && (
            <div style={{ marginTop:'1rem', display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem', background:'#EEF2FF', borderRadius:10 }}>
              <div style={{ width:18, height:18, border:'2px solid #C7D2FE', borderTop:'2px solid #4F46E5', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <span style={{ color:'#4F46E5', fontWeight:500 }}>Gemini AI is generating {count} {difficulty} {topic} question{count>1?'s':''}...</span>
            </div>
          )}

          {error && (
            <div style={{ marginTop:'1rem', padding:'0.75rem', background:'#FEE2E2', borderRadius:10, color:'#DC2626', fontSize:'0.85rem' }}>❌ {error}</div>
          )}
        </div>

        {/* Results */}
        {generated.length > 0 && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <h3 style={{ margin:0 }}>✨ Generated ({generated.length})</h3>
              <button onClick={handleSaveAll} disabled={saving || saved.length===generated.length} style={C.btn('#16A34A', saving || saved.length===generated.length)}>
                {saved.length===generated.length ? '✅ All Saved!' : saving ? 'Saving...' : '💾 Save All'}
              </button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
              {generated.map((q,i) => (
                <div key={i} style={{ ...C.card, borderLeft:`4px solid ${DIFF_COLORS[q.difficulty]||'#6366F1'}`, opacity:saved.includes(i)?0.65:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.75rem' }}>
                    <div>
                      <h3 style={{ margin:'0 0 0.35rem' }}>{q.title}</h3>
                      <div style={{ display:'flex', gap:'0.4rem' }}>
                        <span style={C.badge(DIFF_COLORS[q.difficulty]||'#6366F1')}>{q.difficulty}</span>
                        <span style={C.badge('#6366F1')}>{q.topic}</span>
                        <span style={C.badge('#0891B2')}>{q.language}</span>
                      </div>
                    </div>
                    <button onClick={()=>handleSave(q,i)} disabled={saving||saved.includes(i)} style={C.btn(saved.includes(i)?'#16A34A':'#4F46E5', saving)}>
                      {saved.includes(i)?'✅ Saved':'💾 Save'}
                    </button>
                  </div>

                  <p style={{ color:'#374151', fontSize:'0.88rem', lineHeight:1.6, margin:'0 0 1rem' }}>{q.description}</p>

                  {q.test_cases?.length>0 && (
                    <div style={{ marginBottom:'0.75rem' }}>
                      <p style={{ margin:'0 0 0.4rem', fontWeight:600, fontSize:'0.78rem', color:'#6B7280' }}>TEST CASES</p>
                      <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                        {q.test_cases.map((tc,j)=>(
                          <div key={j} style={{ background:'#F3F4F6', borderRadius:8, padding:'0.35rem 0.75rem', fontSize:'0.8rem', fontFamily:'monospace' }}>
                            <span style={{ color:'#6B7280' }}>in:</span> {String(tc.input).substring(0,25)} → <span style={{ color:'#16A34A', fontWeight:600 }}>{String(tc.expected_output).substring(0,20)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {q.hints?.length>0 && (
                    <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
                      {q.hints.map((h,j)=>(
                        <span key={j} style={{ background:'#FEF9C3', color:'#92400E', padding:'2px 10px', borderRadius:20, fontSize:'0.78rem' }}>💡 {h}</span>
                      ))}
                    </div>
                  )}

                  {q.explanation && (
                    <div style={{ marginTop:'0.75rem', padding:'0.6rem 0.9rem', background:'#EEF2FF', borderRadius:8, fontSize:'0.82rem', color:'#4F46E5' }}>
                      📖 {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {!generating && generated.length===0 && (
          <div style={{ ...C.card, textAlign:'center', padding:'3rem', color:'#9CA3AF' }}>
            <div style={{ fontSize:'3.5rem', marginBottom:'1rem' }}>🤖</div>
            <h3 style={{ margin:'0 0 0.5rem', color:'#6B7280' }}>Ready to Generate</h3>
            <p style={{ margin:0, fontSize:'0.9rem' }}>Pick topic, difficulty, and language — Gemini AI will create complete questions with test cases and hints in seconds.</p>
          </div>
        )}
      </div>
    </div>
  );
}
