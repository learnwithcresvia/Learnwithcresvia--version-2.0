// src/pages/QuestionCodingScreen.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabaseClient';

let MonacoEditor = null;
try { MonacoEditor = require('@monaco-editor/react').default; } catch {}

const JUDGE0_URL = 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true';
const LANG_IDS   = { python: 71, javascript: 63, java: 62, cpp: 54 };
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ── KEY FIX: handles both "output" and "expected_output" keys ────────────────
function getExpected(tc) {
  return String(tc?.expected_output ?? tc?.output ?? '').trim();
}

async function runCode(language, code, stdin = '') {
  const res = await fetch(JUDGE0_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ source_code: code, language_id: LANG_IDS[language] || 71, stdin }),
  });
  if (!res.ok) throw new Error(`Code runner error: ${res.status}`);
  const d = await res.json();
  if (d.compile_output) return { stdout: '', stderr: d.compile_output };
  return { stdout: d.stdout || '', stderr: d.stderr || '' };
}

async function callGemini(prompt, maxTokens = 600, temperature = 0.7) {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    }),
  });
  if (!res.ok) {
    const e = await res.json();
    throw new Error(e.error?.message || `Gemini ${res.status}`);
  }
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── AI flexible validation ────────────────────────────────────────────────────
async function aiValidate(question, code, actualOutput) {
  const prompt = `You are a code evaluator for a beginner programming course. Be generous.

Question: "${question.title}"
Task: ${question.description}
Reference output: ${getExpected(question.test_cases?.[0])}
Student output: "${actualOutput}"
Code:
\`\`\`${question.language}
${code}
\`\`\`

Accept if: any approach gives correct result, minor whitespace/newline differences, "8" vs "8.0" etc.
Reject only if: logic is fundamentally wrong or output is clearly incorrect.

Reply ONLY with valid JSON (no markdown): {"correct": true/false, "feedback": "encouraging one sentence"}`;

  try {
    const raw = await callGemini(prompt, 150, 0.1);
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```/g, '').trim());
  } catch {
    const exp = getExpected(question.test_cases?.[0]);
    return { correct: actualOutput.trim() === exp, feedback: '' };
  }
}

// ── Strict test-case validation for MEDIUM/HARD ───────────────────────────────
async function strictValidate(question, code) {
  const tcs = question.test_cases || [];
  if (!tcs.length) {
    const { stdout, stderr } = await runCode(question.language, code);
    return { correct: !stderr, passed: +!stderr, total: 1, output: stdout || stderr, feedback: '' };
  }
  let passed = 0, lastOut = '';
  for (const tc of tcs) {
    const { stdout, stderr } = await runCode(question.language, code, String(tc.input ?? ''));
    lastOut = stdout || stderr;
    if (stdout.trim() === getExpected(tc)) passed++;
  }
  return { correct: passed === tcs.length, passed, total: tcs.length, output: lastOut, feedback: `${passed}/${tcs.length} test cases passed.` };
}

// ── Patient teacher system prompt ─────────────────────────────────────────────
function teacherPrompt(question, level) {
  return `You are Cresvia, a warm, patient programming teacher for ${level || 'Beginner'} students.

Problem: "${question?.title}" — ${question?.description || ''}
Topic: ${question?.topic || 'Programming'} | Language: ${question?.language || 'Python'}

Your rules:
1. Explain like a real teacher sitting next to the student — conversational, warm
2. Use simple real-life analogies BEFORE technical terms
3. One concept at a time — never overwhelm
4. If confused, try a completely DIFFERENT explanation or analogy
5. Celebrate what they get right before addressing mistakes
6. NEVER give the full solution — guide them to discover it
7. End with a gentle question or nudge to keep them thinking
8. Keep responses to 4-6 sentences unless they ask for more`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function QuestionCodingScreen() {
  const { questionId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [question,   setQuestion]   = useState(null);
  const [code,       setCode]       = useState('');
  const [output,     setOutput]     = useState('');
  const [running,    setRunning]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result,     setResult]     = useState(null);
  const [resultMsg,  setResultMsg]  = useState('');
  const [loading,    setLoading]    = useState(true);
  const [xpDone,     setXpDone]     = useState(false);

  const [ragOpen,   setRagOpen]   = useState(false);
  const [msgs,      setMsgs]      = useState([]);
  const [history,   setHistory]   = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [tutorReady,setTutorReady]= useState(false);
  const endRef = useRef(null);

  useEffect(() => { load(); }, [questionId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function load() {
    const { data, error } = await supabase.from('questions').select('*').eq('id', questionId).single();
    if (error || !data) { navigate('/practice-hub'); return; }
    setQuestion(data);
    setCode(data.starter_code || defaultCode(data.language));
    setLoading(false);
  }

  function defaultCode(lang = 'python') {
    return ({ python:'# Write your solution here\n\n', javascript:'// Write your solution here\n\n', java:'public class Solution {\n    public static void main(String[] args) {\n        // Write here\n    }\n}\n', cpp:'#include <iostream>\nusing namespace std;\nint main() {\n    \n    return 0;\n}\n' })[lang] || '# Write your solution here\n\n';
  }

  async function handleRun() {
    setRunning(true); setOutput('Running...');
    try { const { stdout, stderr } = await runCode(question.language, code); setOutput(stdout || stderr || '(no output)'); }
    catch (e) { setOutput('❌ ' + e.message); }
    finally { setRunning(false); }
  }

  async function handleSubmit() {
    if (!code.trim() || submitting) return;
    setSubmitting(true); setResult(null); setResultMsg(''); setOutput('Evaluating...');
    try {
      let correct, feedback, displayOutput;
      if (question.difficulty === 'EASY') {
        const { stdout, stderr } = await runCode(question.language, code);
        displayOutput = stdout || stderr;
        const v = await aiValidate(question, code, displayOutput);
        correct = v.correct; feedback = v.feedback;
      } else {
        const v = await strictValidate(question, code);
        correct = v.correct; feedback = v.feedback; displayOutput = v.output;
      }
      setOutput(displayOutput); setResult(correct ? 'correct' : 'wrong'); setResultMsg(feedback);
      await supabase.from('practice_attempts').insert({ user_id: user.id, question_id: question.id, code_submitted: code, is_correct: correct, points_earned: correct ? (question.points || 10) : 0 });
      if (correct && profile && !xpDone) {
        setXpDone(true);
        await supabase.from('profiles').update({ xp: (profile.xp || 0) + (question.points || 10) }).eq('id', user.id);
      }
      if (!correct && !tutorReady) openTutor("I just submitted but got it wrong. Can you help me understand what I'm missing without giving me the answer?");
    } catch (e) { setOutput('Error: ' + e.message); }
    finally { setSubmitting(false); }
  }

  // ── AI Teacher ───────────────────────────────────────────────────────────────
  function addMsg(role, text) { setMsgs(p => [...p, { role, text }]); }

  async function sendToAI(userMsg) {
    setAiLoading(true);
    const ctx = history.map(m => `${m.role === 'user' ? 'Student' : 'Teacher'}: ${m.content}`).join('\n');
    const full = `${teacherPrompt(question, profile?.difficulty_preference)}\n\n${ctx ? 'Conversation:\n' + ctx + '\n\n' : ''}Student: ${userMsg}\nTeacher:`;
    try {
      const reply = await callGemini(full);
      addMsg('assistant', reply);
      setHistory(p => [...p, { role: 'user', content: userMsg }, { role: 'assistant', content: reply }]);
    } catch (e) {
      addMsg('assistant', e.message.includes('quota') || e.message.includes('429') ? '⚠️ API quota exceeded — please wait a moment and try again.' : '⚠️ ' + e.message);
    } finally { setAiLoading(false); }
  }

  async function openTutor(firstMsg) {
    setRagOpen(true);
    if (!tutorReady) {
      setTutorReady(true);
      setAiLoading(true);
      if (firstMsg) {
        addMsg('user', firstMsg);
        await sendToAI(firstMsg);
      } else {
        const welcome = `Hi! 👋 I'm Cresvia, your AI teacher. I'm here to help you understand "${question?.title}" step by step.\n\nLet me start simple: ${question?.description}\n\nWhat part feels confusing, or would you like me to explain the whole concept from scratch?`;
        addMsg('assistant', welcome);
        setHistory([{ role: 'assistant', content: welcome }]);
        setAiLoading(false);
      }
    } else { setRagOpen(o => !o); }
  }

  async function handleHint() {
    setRagOpen(true); setTutorReady(true);
    const msg = code.trim().length > 20
      ? `Here's my code:\n\`\`\`${question.language}\n${code}\n\`\`\`\nI'm stuck. Tiny hint please — no answer!`
      : "I don't know how to start. Can you give me the smallest possible hint?";
    addMsg('user', msg); await sendToAI(msg);
  }

  async function handleReviewCode() {
    setRagOpen(true); setTutorReady(true);
    const msg = `Here's what I have:\n\`\`\`${question.language}\n${code}\n\`\`\`\nWhat am I doing right, and what should I think about next?`;
    addMsg('user', msg); await sendToAI(msg);
  }

  async function handleSend() {
    if (!chatInput.trim() || aiLoading) return;
    const msg = chatInput.trim(); setChatInput('');
    setTutorReady(true); setRagOpen(true);
    addMsg('user', msg); await sendToAI(msg);
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#0f1117' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid #1e2433', borderTopColor:'#667eea', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 1rem' }} />
        <div style={{ color:'#4a5568', fontFamily:'"Inter",sans-serif', fontSize:'0.9rem' }}>Loading...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const dc = question.difficulty === 'EASY' ? '#48bb78' : question.difficulty === 'MEDIUM' ? '#ed8936' : '#f56565';

  return (
    <div style={{ display:'flex', height:'100vh', background:'#0f1117', fontFamily:'"Inter",sans-serif', overflow:'hidden' }}>

      {/* LEFT: Question */}
      <div style={{ width: ragOpen ? '27%' : '35%', background:'#141720', color:'white', overflowY:'auto', transition:'width 0.3s', flexShrink:0, borderRight:'1px solid #1e2433' }}>
        <div style={{ padding:'0.875rem 1.25rem', borderBottom:'1px solid #1e2433', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <Link to="/practice-hub" style={{ color:'#667eea', textDecoration:'none', fontSize:'0.8rem' }}>← Back</Link>
          <div style={{ display:'flex', gap:'0.4rem' }}>
            {question.difficulty === 'EASY' && <span style={{ fontSize:'0.65rem', padding:'2px 8px', borderRadius:20, background:'rgba(102,126,234,0.12)', color:'#8b9cf4', border:'1px solid rgba(102,126,234,0.2)' }}>🤖 AI Graded</span>}
            <span style={{ fontSize:'0.7rem', padding:'2px 10px', borderRadius:20, background:`${dc}18`, color:dc, border:`1px solid ${dc}35` }}>{question.difficulty}</span>
          </div>
        </div>

        <div style={{ padding:'1.25rem' }}>
          <h2 style={{ margin:'0 0 0.75rem', fontSize:'1.05rem', color:'#e2e8f0', lineHeight:1.45, fontWeight:700 }}>{question.title}</h2>
          <div style={{ display:'flex', gap:'0.4rem', marginBottom:'1rem', flexWrap:'wrap' }}>
            {question.topic && <span style={{ background:'rgba(144,205,244,0.08)', color:'#90CDF4', padding:'2px 9px', borderRadius:20, fontSize:'0.7rem', border:'1px solid rgba(144,205,244,0.15)' }}>{question.topic}</span>}
            <span style={{ background:'rgba(154,230,180,0.08)', color:'#9AE6B4', padding:'2px 9px', borderRadius:20, fontSize:'0.7rem', border:'1px solid rgba(154,230,180,0.15)' }}>⭐ {question.points} XP</span>
          </div>

          <div style={{ background:'rgba(255,255,255,0.025)', borderRadius:10, padding:'1rem', marginBottom:'1rem', border:'1px solid #1e2433' }}>
            <p style={{ color:'#a0aec0', fontSize:'0.875rem', lineHeight:1.8, margin:0, whiteSpace:'pre-wrap' }}>{question.description}</p>
          </div>

          {question.test_cases?.filter(t=>!t.hidden).slice(0,2).map((tc,i)=>(
            <div key={i} style={{ background:'#0f1117', borderRadius:8, padding:'0.875rem', marginBottom:'0.6rem', border:'1px solid #1e2433' }}>
              <div style={{ color:'#2d3748', fontSize:'0.68rem', marginBottom:'0.5rem', textTransform:'uppercase', letterSpacing:'0.08em' }}>Example {i+1}</div>
              <div style={{ fontSize:'0.8rem', marginBottom:'0.25rem' }}><span style={{ color:'#4a5568' }}>Input: </span><code style={{ color:'#F6E05E' }}>{String(tc.input)}</code></div>
              <div style={{ fontSize:'0.8rem' }}><span style={{ color:'#4a5568' }}>Output: </span><code style={{ color:'#68D391' }}>{getExpected(tc)}</code></div>
            </div>
          ))}

          <div style={{ marginTop:'1.25rem', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            <button onClick={() => openTutor(null)}
              style={{ width:'100%', padding:'0.7rem', background:'linear-gradient(135deg,#667eea,#764ba2)', color:'white', border:'none', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:'0.85rem' }}>
              {tutorReady ? (ragOpen ? '✕ Close AI Teacher' : '🎓 Open AI Teacher') : '🎓 Teach Me This Concept'}
            </button>
            <div style={{ display:'flex', gap:'0.5rem' }}>
              <button onClick={handleHint} style={{ flex:1, padding:'0.55rem', background:'rgba(246,224,94,0.07)', color:'#F6E05E', border:'1px solid rgba(246,224,94,0.15)', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:'0.78rem' }}>💡 Hint</button>
              <button onClick={handleReviewCode} style={{ flex:1, padding:'0.55rem', background:'rgba(144,205,244,0.07)', color:'#90CDF4', border:'1px solid rgba(144,205,244,0.15)', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:'0.78rem' }}>👀 Review Code</button>
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE: Editor */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <div style={{ background:'#0f1117', padding:'0.55rem 1rem', display:'flex', alignItems:'center', gap:'0.75rem', borderBottom:'1px solid #1e2433' }}>
          <div style={{ display:'flex', gap:'5px' }}>
            {['#f56565','#ed8936','#48bb78'].map(c=><div key={c} style={{ width:10,height:10,borderRadius:'50%',background:c }} />)}
          </div>
          <span style={{ color:'#2d3748', fontSize:'0.75rem', marginLeft:'0.25rem' }}>{question.language?.toLowerCase()}</span>
          <div style={{ flex:1 }} />
          <button onClick={handleRun} disabled={running}
            style={{ padding:'0.35rem 1rem', background:'transparent', color:running?'#4a5568':'#48bb78', border:`1px solid ${running?'#2d3748':'rgba(72,187,120,0.35)'}`, borderRadius:6, cursor:running?'not-allowed':'pointer', fontSize:'0.8rem', fontWeight:600 }}>
            {running ? '◌ Running...' : '▶ Run'}
          </button>
          <button onClick={handleSubmit} disabled={submitting || result==='correct'}
            style={{ padding:'0.35rem 1rem', background:result==='correct'?'rgba(72,187,120,0.12)':'linear-gradient(135deg,#667eea,#764ba2)', color:result==='correct'?'#48bb78':submitting?'#718096':'white', border:result==='correct'?'1px solid rgba(72,187,120,0.25)':'none', borderRadius:6, cursor:(submitting||result==='correct')?'not-allowed':'pointer', fontSize:'0.8rem', fontWeight:600, opacity:submitting?0.6:1 }}>
            {result==='correct' ? '✓ Solved!' : submitting ? '◌ Checking...' : '✓ Submit'}
          </button>
        </div>

        <div style={{ flex:1, minHeight:0 }}>
          {MonacoEditor ? (
            <MonacoEditor height="100%" language={question.language||'python'} value={code} onChange={v=>setCode(v||'')} theme="vs-dark"
              options={{ fontSize:14, minimap:{enabled:false}, scrollBeyondLastLine:false, wordWrap:'on', padding:{top:12}, lineNumbersMinChars:3 }} />
          ) : (
            <textarea value={code} onChange={e=>setCode(e.target.value)}
              style={{ width:'100%', height:'100%', background:'#1e1e1e', color:'#d4d4d4', border:'none', padding:'1rem', fontFamily:'"Fira Code",monospace', fontSize:14, resize:'none', outline:'none', boxSizing:'border-box' }} />
          )}
        </div>

        {/* Output */}
        <div style={{ height:145, background:'#0a0d14', borderTop:'1px solid #1e2433', padding:'0.75rem 1rem', overflowY:'auto' }}>
          <div style={{ color:'#1e2433', fontSize:'0.62rem', marginBottom:'0.5rem', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:700 }}>Output</div>
          {result==='correct' && (
            <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.5rem', padding:'0.45rem 0.75rem', background:'rgba(72,187,120,0.08)', borderRadius:8, border:'1px solid rgba(72,187,120,0.18)' }}>
              <span>✅</span>
              <div>
                <div style={{ color:'#48bb78', fontWeight:700, fontSize:'0.85rem' }}>Correct! +{question.points} XP earned!</div>
                {resultMsg && <div style={{ color:'#68D391', fontSize:'0.78rem' }}>{resultMsg}</div>}
              </div>
            </div>
          )}
          {result==='wrong' && (
            <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.5rem', padding:'0.45rem 0.75rem', background:'rgba(245,101,101,0.08)', borderRadius:8, border:'1px solid rgba(245,101,101,0.18)' }}>
              <span>❌</span>
              <div>
                <div style={{ color:'#f56565', fontWeight:700, fontSize:'0.85rem' }}>Not quite — keep trying!</div>
                {resultMsg && <div style={{ color:'#FC8181', fontSize:'0.78rem' }}>{resultMsg}</div>}
              </div>
            </div>
          )}
          <pre style={{ color:output.includes('Error')||output.includes('Traceback')?'#f56565':'#68D391', margin:0, fontSize:13, whiteSpace:'pre-wrap', lineHeight:1.6, fontFamily:'"Fira Code",monospace' }}>
            {output||'Click ▶ Run to see output...'}
          </pre>
        </div>
      </div>

      {/* RIGHT: AI Teacher */}
      {ragOpen && (
        <div style={{ width:'31%', background:'#141720', borderLeft:'1px solid #1e2433', display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'0.875rem 1rem', borderBottom:'1px solid #1e2433', background:'#0f1117', display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#667eea,#764ba2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>🎓</div>
            <div>
              <div style={{ color:'#e2e8f0', fontWeight:700, fontSize:'0.875rem' }}>Cresvia AI Teacher</div>
              <div style={{ color:'#2d3748', fontSize:'0.68rem' }}>Patient · Step-by-step · No spoilers</div>
            </div>
          </div>

          {/* Quick prompts */}
          <div style={{ padding:'0.5rem 0.875rem', borderBottom:'1px solid #1e2433', display:'flex', gap:'0.35rem', flexWrap:'wrap' }}>
            {["I don't understand", "Walk me through an example", "Why is my code wrong?", "What concept do I need?"].map(q=>(
              <button key={q} onClick={()=>setChatInput(q)}
                style={{ background:'rgba(102,126,234,0.07)', color:'#8b9cf4', border:'1px solid rgba(102,126,234,0.12)', borderRadius:20, padding:'3px 9px', fontSize:'0.68rem', cursor:'pointer', whiteSpace:'nowrap' }}>
                {q}
              </button>
            ))}
          </div>

          {/* Chat */}
          <div style={{ flex:1, overflowY:'auto', padding:'0.875rem', display:'flex', flexDirection:'column', gap:'0.875rem' }}>
            {aiLoading && msgs.length===0 && (
              <div style={{ textAlign:'center', marginTop:'3rem' }}>
                <div style={{ fontSize:'2rem', marginBottom:'0.75rem' }}>🎓</div>
                <div style={{ color:'#2d3748', fontSize:'0.85rem' }}>Your teacher is here...</div>
              </div>
            )}

            {msgs.map((m,i)=>(
              <div key={i} style={{ alignSelf: m.role==='user'?'flex-end':'flex-start', maxWidth:'92%' }}>
                {m.role==='assistant' && <div style={{ fontSize:'0.62rem', color:'#2d3748', marginBottom:'0.25rem' }}>🎓 Cresvia</div>}
                <div style={{
                  background: m.role==='user'?'rgba(102,126,234,0.12)':'rgba(255,255,255,0.03)',
                  color:'#cbd5e0', padding:'0.75rem 0.875rem',
                  borderRadius: m.role==='user'?'14px 14px 3px 14px':'3px 14px 14px 14px',
                  fontSize:'0.85rem', lineHeight:1.75, whiteSpace:'pre-wrap',
                  border: m.role==='user'?'1px solid rgba(102,126,234,0.18)':'1px solid #1e2433',
                }}>
                  {m.text}
                </div>
                {m.role==='user' && <div style={{ fontSize:'0.62rem', color:'#2d3748', marginTop:'0.25rem', textAlign:'right' }}>You</div>}
              </div>
            ))}

            {aiLoading && msgs.length>0 && (
              <div style={{ alignSelf:'flex-start', maxWidth:'92%' }}>
                <div style={{ fontSize:'0.62rem', color:'#2d3748', marginBottom:'0.25rem' }}>🎓 Cresvia</div>
                <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid #1e2433', padding:'0.75rem 0.875rem', borderRadius:'3px 14px 14px 14px', display:'flex', gap:5, alignItems:'center' }}>
                  {[0,1,2].map(i=><div key={i} style={{ width:6,height:6,borderRadius:'50%',background:'#667eea',animation:`bounce 1s ${i*0.18}s ease-in-out infinite` }} />)}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{ padding:'0.75rem', borderTop:'1px solid #1e2433', display:'flex', gap:'0.5rem', background:'#0f1117' }}>
            <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&handleSend()}
              placeholder="Ask your teacher anything..."
              style={{ flex:1, background:'rgba(255,255,255,0.04)', border:'1px solid #1e2433', color:'#e2e8f0', borderRadius:10, padding:'0.6rem 0.875rem', fontSize:'0.83rem', outline:'none' }} />
            <button onClick={handleSend} disabled={aiLoading||!chatInput.trim()}
              style={{ padding:'0.6rem 0.875rem', background:aiLoading||!chatInput.trim()?'#1e2433':'linear-gradient(135deg,#667eea,#764ba2)', color:aiLoading||!chatInput.trim()?'#2d3748':'white', border:'none', borderRadius:10, cursor:aiLoading||!chatInput.trim()?'not-allowed':'pointer', fontWeight:700 }}>
              →
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
      `}</style>
    </div>
  );
}
