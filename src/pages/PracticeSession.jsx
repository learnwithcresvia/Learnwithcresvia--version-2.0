// src/pages/PracticeSession.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import practiceService from '../services/practiceService';

let MonacoEditor = null;
try { MonacoEditor = require('@monaco-editor/react').default; } catch {}

const JUDGE0_URL = 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true';
const LANG_IDS   = { python: 71, javascript: 63, java: 62, cpp: 54 };
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ── helpers ──────────────────────────────────────────────────────────────────
function getExpected(tc) {
  return String(tc?.expected_output ?? tc?.output ?? '').trim();
}

async function runCode(language, code, stdin = '') {
  const res = await fetch(JUDGE0_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ source_code: code, language_id: LANG_IDS[language] || 71, stdin }),
  });
  if (!res.ok) throw new Error(`Runner error: ${res.status}`);
  const d = await res.json();
  if (d.compile_output) return { stdout: '', stderr: d.compile_output };
  return { stdout: d.stdout || '', stderr: d.stderr || '' };
}

async function callGemini(prompt, maxTokens = 600, temp = 0.7) {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: temp },
    }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `Gemini ${res.status}`); }
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function aiValidate(question, code, actualOutput) {
  const prompt = `You are a generous code evaluator for beginners.
Question: "${question.title}" — ${question.description}
Expected output: ${getExpected(question.test_cases?.[0])}
Student output: "${actualOutput}"
Code: \`\`\`${question.language}\n${code}\n\`\`\`
Accept any correct approach, minor whitespace ok, "8" vs "8.0" ok.
Reply ONLY with JSON (no markdown): {"correct":true/false,"feedback":"encouraging one sentence"}`;
  try {
    const raw = await callGemini(prompt, 150, 0.1);
    return JSON.parse(raw.replace(/```json\n?/g,'').replace(/```/g,'').trim());
  } catch {
    return { correct: actualOutput.trim() === getExpected(question.test_cases?.[0]), feedback: '' };
  }
}

async function strictValidate(question, code) {
  const tcs = question.test_cases || [];
  if (!tcs.length) {
    const { stdout, stderr } = await runCode(question.language, code);
    return { correct: !stderr, passed: +!stderr, total: 1, output: stdout || stderr };
  }
  let passed = 0, lastOut = '';
  for (const tc of tcs) {
    const { stdout, stderr } = await runCode(question.language, code, String(tc.input ?? ''));
    lastOut = stdout || stderr;
    if (stdout.trim() === getExpected(tc)) passed++;
  }
  return { correct: passed === tcs.length, passed, total: tcs.length, output: lastOut, feedback: `${passed}/${tcs.length} test cases passed.` };
}

function teacherPrompt(q, level) {
  return `You are Cresvia, a warm patient programming teacher for ${level || 'Beginner'} students.
Problem: "${q?.title}" — ${q?.description || ''}
Topic: ${q?.topic || 'Programming'} | Language: ${q?.language || 'Python'}
Rules: one concept at a time, real-life analogies first, celebrate what's right, never give full solution, end with a gentle question. 4-6 sentences max.`;
}

function defaultCode(lang = 'python') {
  return ({
    python: '# Write your solution here\n\n',
    javascript: '// Write your solution here\n\n',
    java: 'public class Solution {\n    public static void main(String[] args) {\n        // Write here\n    }\n}\n',
    cpp: '#include <iostream>\nusing namespace std;\nint main() {\n    \n    return 0;\n}\n',
  })[lang] || '# Write your solution here\n\n';
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PracticeSession() {
  const { sessionId } = useParams();
  const navigate      = useNavigate();
  const { user, profile } = useAuth();

  const [session,       setSession]       = useState(null);
  const [question,      setQuestion]      = useState(null);
  const [qIndex,        setQIndex]        = useState(0);
  const [qTotal,        setQTotal]        = useState(0);
  const [code,          setCode]          = useState('');
  const [selectedAns,   setSelectedAns]   = useState('');
  const [output,        setOutput]        = useState('');
  const [running,       setRunning]       = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [result,        setResult]        = useState(null);   // {correct, feedback, xp, testResults}
  const [loading,       setLoading]       = useState(true);

  // AI Teacher
  const [tutorOpen,   setTutorOpen]   = useState(false);
  const [msgs,        setMsgs]        = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput,   setChatInput]   = useState('');
  const [aiLoading,   setAiLoading]   = useState(false);
  const [tutorReady,  setTutorReady]  = useState(false);
  const endRef = useRef(null);

  useEffect(() => { load(); }, [sessionId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function load() {
    setLoading(true);
    const { data: sd }  = await practiceService.getSession(sessionId);
    const { data: qd }  = await practiceService.getCurrentQuestion(sessionId);
    if (!sd || !qd) { navigate('/practice-hub'); return; }
    setSession(sd);
    setQuestion(qd.question);
    setQIndex(qd.index);
    setQTotal(qd.total);
    setCode(qd.question.starter_code || defaultCode(qd.question.language));
    setResult(null); setOutput(''); setSelectedAns('');
    // Reset tutor for new question
    setMsgs([]); setChatHistory([]); setTutorReady(false);
    setLoading(false);
  }

  // ── Run (no validation) ──────────────────────────────────────────────────────
  async function handleRun() {
    if (!code.trim()) return;
    setRunning(true); setOutput('Running...');
    try {
      const { stdout, stderr } = await runCode(question.language, code);
      setOutput(stdout || stderr || '(no output)');
    } catch (e) { setOutput('❌ ' + e.message); }
    finally { setRunning(false); }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const answer = question.question_type === 'CODING' ? code : selectedAns;
    if (!answer.trim()) return;
    setSubmitting(true); setOutput('Evaluating...');

    try {
      let correct = false, feedback = '', displayOutput = '', testResults = [], xp = 0;

      if (question.question_type === 'CODING') {
        if (question.difficulty === 'EASY') {
          const { stdout, stderr } = await runCode(question.language, code);
          displayOutput = stdout || stderr;
          const v = await aiValidate(question, code, displayOutput);
          correct = v.correct; feedback = v.feedback;
        } else {
          const v = await strictValidate(question, code);
          correct = v.correct; feedback = v.feedback;
          displayOutput = v.output;
          testResults = question.test_cases?.map((tc, i) => ({
            input: tc.input, expected: getExpected(tc),
          })) || [];
        }
        setOutput(displayOutput);
      } else {
        // MCQ / OUTPUT — delegate to practiceService
        const { data } = await practiceService.submitAnswer(sessionId, question.id, answer);
        correct      = data?.isCorrect || false;
        feedback     = data?.explanation || '';
        testResults  = data?.testResults || [];
        xp           = data?.pointsEarned || 0;
      }

      if (correct) xp = question.points || 10;

      // Save attempt via practiceService
      try {
        await practiceService.submitAnswer(sessionId, question.id, answer);
      } catch { /* ignore if already saved above */ }

      setResult({ correct, feedback, xp, testResults });

      // Auto-open tutor if wrong
      if (!correct && !tutorReady) {
        openTutor("I just submitted and got it wrong. Can you help me understand what I'm missing — without giving me the answer?");
      }
    } catch (e) {
      setOutput('Error: ' + e.message);
    } finally { setSubmitting(false); }
  }

  // ── Next question ────────────────────────────────────────────────────────────
  async function handleNext() {
    const { data } = await practiceService.nextQuestion(sessionId);
    if (data?.isComplete) {
      navigate('/practice-hub', { state: { completed: true, xp: data.xp_earned } });
    } else {
      setResult(null); setOutput(''); setCode(''); setSelectedAns('');
      load();
    }
  }

  async function handleQuit() {
    if (confirm('Quit? Your progress will be saved.')) {
      await practiceService.abandonSession(sessionId);
      navigate('/practice-hub');
    }
  }

  // ── AI Teacher ───────────────────────────────────────────────────────────────
  function addMsg(role, text) { setMsgs(p => [...p, { role, text }]); }

  async function sendToAI(userMsg) {
    setAiLoading(true);
    const ctx  = chatHistory.map(m => `${m.role === 'user' ? 'Student' : 'Teacher'}: ${m.content}`).join('\n');
    const full = `${teacherPrompt(question, profile?.difficulty_preference)}\n\n${ctx ? 'Conversation:\n' + ctx + '\n\n' : ''}Student: ${userMsg}\nTeacher:`;
    try {
      const reply = await callGemini(full);
      addMsg('assistant', reply);
      setChatHistory(p => [...p, { role:'user', content:userMsg }, { role:'assistant', content:reply }]);
    } catch (e) {
      addMsg('assistant', e.message.includes('quota') ? '⚠️ API quota exceeded — please wait and try again.' : '⚠️ ' + e.message);
    } finally { setAiLoading(false); }
  }

  async function openTutor(firstMsg) {
    setTutorOpen(true);
    if (tutorReady) return;
    setTutorReady(true);
    if (firstMsg) {
      addMsg('user', firstMsg);
      await sendToAI(firstMsg);
    } else {
      setAiLoading(true);
      try {
        const welcome = await callGemini(
          teacherPrompt(question, profile?.difficulty_preference) +
          '\n\nThe student just opened the AI teacher. Greet them warmly, explain the question in simple terms, ask what part they want help with. No code.'
        );
        addMsg('assistant', welcome);
        setChatHistory([{ role:'assistant', content:welcome }]);
      } catch {
        addMsg('assistant', `Hi! 👋 I'm Cresvia, your AI teacher. I'm here to help you with "${question?.title}". What part would you like to start with?`);
      } finally { setAiLoading(false); }
    }
  }

  async function handleSend() {
    if (!chatInput.trim() || aiLoading) return;
    const msg = chatInput.trim(); setChatInput('');
    setTutorReady(true); setTutorOpen(true);
    addMsg('user', msg); await sendToAI(msg);
  }

  async function handleHint() {
    setTutorOpen(true); setTutorReady(true);
    const msg = code.trim().length > 20
      ? `My code:\n\`\`\`${question?.language}\n${code}\n\`\`\`\nGive me a small hint — no answer please.`
      : "I don't know how to start. Smallest hint possible?";
    addMsg('user', msg); await sendToAI(msg);
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading || !question) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#0f1117' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid #1e2433', borderTopColor:'#667eea', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 1rem' }} />
        <div style={{ color:'#4a5568', fontFamily:'"Inter",sans-serif', fontSize:'0.9rem' }}>Loading question...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const dc = question.difficulty === 'EASY' ? '#48bb78' : question.difficulty === 'MEDIUM' ? '#ed8936' : '#f56565';
  const isCoding = question.question_type === 'CODING';

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#0f1117', fontFamily:'"Inter",sans-serif', overflow:'hidden' }}>

      {/* ── Top Bar ── */}
      <div style={{ background:'#141720', borderBottom:'1px solid #1e2433', padding:'0 1.5rem', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'1.25rem' }}>
          <span style={{ color:'#e2e8f0', fontWeight:700, fontSize:'0.95rem' }}>{question.title}</span>
          <span style={{ color:'#2d3748', fontSize:'0.8rem' }}>Question {qIndex + 1} of {qTotal}</span>
          {/* Progress bar */}
          <div style={{ width:120, height:4, background:'#1e2433', borderRadius:2, overflow:'hidden' }}>
            <div style={{ width:`${((qIndex + 1) / qTotal) * 100}%`, height:'100%', background:'linear-gradient(90deg,#667eea,#764ba2)', borderRadius:2, transition:'width 0.4s' }} />
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <span style={{ fontSize:'0.7rem', padding:'2px 10px', borderRadius:20, background:`${dc}15`, color:dc, border:`1px solid ${dc}30` }}>
            {question.difficulty}
          </span>
          <span style={{ fontSize:'0.7rem', padding:'2px 10px', borderRadius:20, background:'rgba(255,255,255,0.04)', color:'#4a5568', border:'1px solid #1e2433' }}>
            {question.question_type}
          </span>
          <button onClick={() => tutorReady ? setTutorOpen(o=>!o) : openTutor(null)}
            style={{ padding:'0.35rem 0.875rem', background:'rgba(102,126,234,0.12)', color:'#8b9cf4', border:'1px solid rgba(102,126,234,0.2)', borderRadius:8, cursor:'pointer', fontSize:'0.8rem', fontWeight:600 }}>
            🎓 {tutorOpen ? 'Close Teacher' : 'Ask Teacher'}
          </button>
          <button onClick={handleQuit}
            style={{ padding:'0.35rem 0.875rem', background:'rgba(245,101,101,0.08)', color:'#f56565', border:'1px solid rgba(245,101,101,0.15)', borderRadius:8, cursor:'pointer', fontSize:'0.8rem', fontWeight:600 }}>
            Quit
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex:1, display:'flex', minHeight:0 }}>

        {/* LEFT: Question */}
        <div style={{ width: tutorOpen ? '25%' : '35%', background:'#141720', overflowY:'auto', borderRight:'1px solid #1e2433', transition:'width 0.3s', flexShrink:0 }}>
          <div style={{ padding:'1.25rem' }}>

            {/* Tags */}
            <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginBottom:'1rem' }}>
              {question.topic && <span style={{ background:'rgba(144,205,244,0.08)', color:'#90CDF4', padding:'2px 9px', borderRadius:20, fontSize:'0.7rem', border:'1px solid rgba(144,205,244,0.15)' }}>{question.topic}</span>}
              <span style={{ background:'rgba(154,230,180,0.08)', color:'#9AE6B4', padding:'2px 9px', borderRadius:20, fontSize:'0.7rem', border:'1px solid rgba(154,230,180,0.15)' }}>⭐ {question.points} XP</span>
              {question.language && <span style={{ background:'rgba(255,255,255,0.04)', color:'#4a5568', padding:'2px 9px', borderRadius:20, fontSize:'0.7rem', border:'1px solid #1e2433' }}>{question.language}</span>}
            </div>

            {/* Description */}
            <div style={{ background:'rgba(255,255,255,0.025)', borderRadius:10, padding:'1rem', marginBottom:'1rem', border:'1px solid #1e2433' }}>
              <div style={{ color:'#4a5568', fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.6rem', fontWeight:600 }}>Description</div>
              <p style={{ color:'#a0aec0', fontSize:'0.875rem', lineHeight:1.8, margin:0, whiteSpace:'pre-wrap' }}>{question.description}</p>
            </div>

            {/* MCQ options */}
            {question.question_type === 'MCQ' && question.options?.map((opt, i) => (
              <label key={i} onClick={() => setSelectedAns(opt.text)}
                style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.875rem', borderRadius:10, marginBottom:'0.5rem', cursor:'pointer', background: selectedAns === opt.text ? 'rgba(102,126,234,0.12)' : 'rgba(255,255,255,0.03)', border:`1px solid ${selectedAns === opt.text ? 'rgba(102,126,234,0.3)' : '#1e2433'}`, transition:'all 0.15s' }}>
                <div style={{ width:16, height:16, borderRadius:'50%', border:`2px solid ${selectedAns === opt.text ? '#667eea' : '#2d3748'}`, background: selectedAns === opt.text ? '#667eea' : 'transparent', flexShrink:0 }} />
                <span style={{ color:'#e2e8f0', fontSize:'0.875rem' }}>{opt.text}</span>
              </label>
            ))}

            {/* Test cases */}
            {question.test_cases?.filter(tc=>!tc.hidden).slice(0,2).map((tc,i)=>(
              <div key={i} style={{ background:'#0f1117', borderRadius:8, padding:'0.875rem', marginBottom:'0.6rem', border:'1px solid #1e2433' }}>
                <div style={{ color:'#2d3748', fontSize:'0.68rem', marginBottom:'0.5rem', textTransform:'uppercase', letterSpacing:'0.08em' }}>Example {i+1}</div>
                <div style={{ fontSize:'0.8rem', marginBottom:'0.25rem' }}><span style={{ color:'#4a5568' }}>Input: </span><code style={{ color:'#F6E05E' }}>{String(tc.input)}</code></div>
                <div style={{ fontSize:'0.8rem' }}><span style={{ color:'#4a5568' }}>Output: </span><code style={{ color:'#68D391' }}>{getExpected(tc)}</code></div>
              </div>
            ))}

            {/* Hint button */}
            <button onClick={handleHint}
              style={{ width:'100%', marginTop:'1rem', padding:'0.6rem', background:'rgba(246,224,94,0.07)', color:'#F6E05E', border:'1px solid rgba(246,224,94,0.15)', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:'0.8rem' }}>
              💡 Get a Hint
            </button>
          </div>
        </div>

        {/* MIDDLE: Editor / Answer */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>

          {isCoding ? (
            <>
              {/* Editor toolbar */}
              <div style={{ background:'#0f1117', padding:'0.5rem 1rem', display:'flex', alignItems:'center', gap:'0.75rem', borderBottom:'1px solid #1e2433', flexShrink:0 }}>
                <div style={{ display:'flex', gap:5 }}>
                  {['#f56565','#ed8936','#48bb78'].map(c=><div key={c} style={{ width:10,height:10,borderRadius:'50%',background:c }} />)}
                </div>
                <span style={{ color:'#2d3748', fontSize:'0.75rem' }}>{question.language?.toLowerCase()}</span>
                <div style={{ flex:1 }} />
                <button onClick={handleRun} disabled={running || !!result}
                  style={{ padding:'0.35rem 1rem', background:'transparent', color:running||result?'#2d3748':'#48bb78', border:`1px solid ${running||result?'#1e2433':'rgba(72,187,120,0.3)'}`, borderRadius:6, cursor:running||result?'not-allowed':'pointer', fontSize:'0.8rem', fontWeight:600 }}>
                  {running ? '◌ Running...' : '▶ Run'}
                </button>
                <button onClick={handleSubmit} disabled={submitting || !!result}
                  style={{ padding:'0.35rem 1rem', background:result?'rgba(72,187,120,0.1)':'linear-gradient(135deg,#667eea,#764ba2)', color:result?'#48bb78':submitting?'#718096':'white', border:result?'1px solid rgba(72,187,120,0.2)':'none', borderRadius:6, cursor:(submitting||result)?'not-allowed':'pointer', fontSize:'0.8rem', fontWeight:600, opacity:submitting?0.6:1 }}>
                  {result ? '✓ Submitted' : submitting ? '◌ Checking...' : '✓ Submit'}
                </button>
              </div>

              {/* Monaco */}
              <div style={{ flex:1, minHeight:0 }}>
                {MonacoEditor ? (
                  <MonacoEditor height="100%" language={question.language||'python'} value={code}
                    onChange={v => !result && setCode(v||'')} theme="vs-dark"
                    options={{ fontSize:14, minimap:{enabled:false}, scrollBeyondLastLine:false, wordWrap:'on', padding:{top:12}, readOnly:!!result }} />
                ) : (
                  <textarea value={code} onChange={e=>!result&&setCode(e.target.value)} readOnly={!!result}
                    style={{ width:'100%', height:'100%', background:'#1e1e1e', color:'#d4d4d4', border:'none', padding:'1rem', fontFamily:'"Fira Code",monospace', fontSize:14, resize:'none', outline:'none', boxSizing:'border-box' }} />
                )}
              </div>

              {/* Output */}
              <div style={{ height:130, background:'#0a0d14', borderTop:'1px solid #1e2433', padding:'0.6rem 1rem', overflowY:'auto', flexShrink:0 }}>
                <div style={{ color:'#1e2433', fontSize:'0.62rem', marginBottom:'0.4rem', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:700 }}>Output</div>
                {result && (
                  <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.4rem', padding:'0.4rem 0.75rem', background:`${result.correct?'rgba(72,187,120':'rgba(245,101,101'},0.08)`, borderRadius:8, border:`1px solid ${result.correct?'rgba(72,187,120':'rgba(245,101,101'},0.18)` }}>
                    <span>{result.correct?'✅':'❌'}</span>
                    <div>
                      <div style={{ color:result.correct?'#48bb78':'#f56565', fontWeight:700, fontSize:'0.85rem' }}>{result.correct?`Correct! +${result.xp} XP`:'Not quite — keep trying!'}</div>
                      {result.feedback && <div style={{ color:result.correct?'#68D391':'#FC8181', fontSize:'0.78rem' }}>{result.feedback}</div>}
                    </div>
                  </div>
                )}
                <pre style={{ color:output.includes('Error')||output.includes('Traceback')?'#f56565':'#68D391', margin:0, fontSize:13, whiteSpace:'pre-wrap', lineHeight:1.6, fontFamily:'"Fira Code",monospace' }}>
                  {output||'Click ▶ Run to see output...'}
                </pre>
              </div>
            </>
          ) : (
            /* MCQ / text answer panel */
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'3rem 2rem' }}>
              <div style={{ width:'100%', maxWidth:520 }}>
                <p style={{ color:'#4a5568', fontSize:'0.8rem', marginBottom:'1.5rem', textAlign:'center' }}>Select your answer above in the question panel, then submit.</p>
                {result ? (
                  <div style={{ padding:'1.25rem', background:`${result.correct?'rgba(72,187,120':'rgba(245,101,101'},0.08)`, borderRadius:12, border:`1px solid ${result.correct?'rgba(72,187,120':'rgba(245,101,101'},0.2)`, textAlign:'center' }}>
                    <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>{result.correct?'✅':'❌'}</div>
                    <div style={{ color:result.correct?'#48bb78':'#f56565', fontWeight:700, fontSize:'1rem', marginBottom:'0.25rem' }}>{result.correct?`Correct! +${result.xp} XP`:'Incorrect'}</div>
                    {result.feedback && <div style={{ color:'#a0aec0', fontSize:'0.875rem' }}>{result.feedback}</div>}
                  </div>
                ) : (
                  <button onClick={handleSubmit} disabled={submitting||!selectedAns}
                    style={{ width:'100%', padding:'0.875rem', background:selectedAns?'linear-gradient(135deg,#667eea,#764ba2)':'#1e2433', color:selectedAns?'white':'#2d3748', border:'none', borderRadius:10, cursor:selectedAns&&!submitting?'pointer':'not-allowed', fontWeight:700, fontSize:'1rem' }}>
                    {submitting ? '◌ Checking...' : '✓ Submit Answer'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: AI Teacher */}
        {tutorOpen && (
          <div style={{ width:'30%', background:'#141720', borderLeft:'1px solid #1e2433', display:'flex', flexDirection:'column', flexShrink:0 }}>
            <div style={{ padding:'0.875rem 1rem', borderBottom:'1px solid #1e2433', background:'#0f1117', display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#667eea,#764ba2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>🎓</div>
              <div>
                <div style={{ color:'#e2e8f0', fontWeight:700, fontSize:'0.875rem' }}>Cresvia AI Teacher</div>
                <div style={{ color:'#2d3748', fontSize:'0.68rem' }}>Patient · No spoilers · Step-by-step</div>
              </div>
            </div>

            {/* Quick prompts */}
            <div style={{ padding:'0.5rem 0.875rem', borderBottom:'1px solid #1e2433', display:'flex', gap:'0.35rem', flexWrap:'wrap' }}>
              {["I don't understand","Walk me through it","What concept do I need?","Why is my code wrong?"].map(q=>(
                <button key={q} onClick={()=>setChatInput(q)}
                  style={{ background:'rgba(102,126,234,0.07)', color:'#8b9cf4', border:'1px solid rgba(102,126,234,0.12)', borderRadius:20, padding:'3px 9px', fontSize:'0.68rem', cursor:'pointer', whiteSpace:'nowrap' }}>
                  {q}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:'auto', padding:'0.875rem', display:'flex', flexDirection:'column', gap:'0.875rem' }}>
              {aiLoading && msgs.length===0 && (
                <div style={{ textAlign:'center', marginTop:'3rem' }}>
                  <div style={{ fontSize:'2rem', marginBottom:'0.75rem' }}>🎓</div>
                  <div style={{ color:'#2d3748', fontSize:'0.85rem' }}>Your teacher is here...</div>
                </div>
              )}
              {msgs.map((m,i)=>(
                <div key={i} style={{ alignSelf:m.role==='user'?'flex-end':'flex-start', maxWidth:'92%' }}>
                  {m.role==='assistant' && <div style={{ fontSize:'0.62rem', color:'#2d3748', marginBottom:'0.25rem' }}>🎓 Cresvia</div>}
                  <div style={{ background:m.role==='user'?'rgba(102,126,234,0.12)':'rgba(255,255,255,0.03)', color:'#cbd5e0', padding:'0.7rem 0.875rem', borderRadius:m.role==='user'?'14px 14px 3px 14px':'3px 14px 14px 14px', fontSize:'0.85rem', lineHeight:1.75, whiteSpace:'pre-wrap', border:m.role==='user'?'1px solid rgba(102,126,234,0.18)':'1px solid #1e2433' }}>
                    {m.text}
                  </div>
                  {m.role==='user' && <div style={{ fontSize:'0.62rem', color:'#2d3748', marginTop:'0.25rem', textAlign:'right' }}>You</div>}
                </div>
              ))}
              {aiLoading && msgs.length>0 && (
                <div style={{ alignSelf:'flex-start' }}>
                  <div style={{ fontSize:'0.62rem', color:'#2d3748', marginBottom:'0.25rem' }}>🎓 Cresvia</div>
                  <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid #1e2433', padding:'0.7rem 0.875rem', borderRadius:'3px 14px 14px 14px', display:'flex', gap:5, alignItems:'center' }}>
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
                style={{ flex:1, background:'rgba(255,255,255,0.04)', border:'1px solid #1e2433', color:'#e2e8f0', borderRadius:10, padding:'0.6rem 0.875rem', fontSize:'0.83rem', outline:'none', fontFamily:'"Inter",sans-serif' }} />
              <button onClick={handleSend} disabled={aiLoading||!chatInput.trim()}
                style={{ padding:'0.6rem 0.875rem', background:aiLoading||!chatInput.trim()?'#1e2433':'linear-gradient(135deg,#667eea,#764ba2)', color:aiLoading||!chatInput.trim()?'#2d3748':'white', border:'none', borderRadius:10, cursor:aiLoading||!chatInput.trim()?'not-allowed':'pointer', fontWeight:700 }}>
                →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Result overlay: Next button ── */}
      {result && (
        <div style={{ position:'fixed', bottom:'2rem', left:'50%', transform:'translateX(-50%)', zIndex:50 }}>
          <button onClick={handleNext}
            style={{ padding:'0.875rem 2.5rem', background:'linear-gradient(135deg,#667eea,#764ba2)', color:'white', border:'none', borderRadius:50, cursor:'pointer', fontWeight:700, fontSize:'1rem', boxShadow:'0 8px 30px rgba(102,126,234,0.4)', fontFamily:'"Inter",sans-serif', letterSpacing:'0.02em' }}>
            {qIndex + 1 >= qTotal ? '🏁 Finish Session' : 'Next Question →'}
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:#0f1117}
        ::-webkit-scrollbar-thumb{background:#2d3748;border-radius:2px}
      `}</style>
    </div>
  );
}
