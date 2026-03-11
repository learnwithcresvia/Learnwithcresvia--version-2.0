// src/pages/LessonPlayer.jsx
// The structured learning experience: Theory → Example → Exercise
// Accessed via /study-hub/subject/:subjectId/lesson/:lessonId

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../utils/supabaseClient';
import Editor from '@monaco-editor/react';

const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const LANG_MAP = {
  python:     { pistonLang: 'python',      pistonVer: '3.10.0', monacoLang: 'python'     },
  javascript: { pistonLang: 'javascript',  pistonVer: '18.15.0',monacoLang: 'javascript' },
  java:       { pistonLang: 'java',        pistonVer: '15.0.2', monacoLang: 'java'        },
  c:          { pistonLang: 'c',           pistonVer: '10.2.0', monacoLang: 'c'           },
  cpp:        { pistonLang: 'c++',         pistonVer: '10.2.0', monacoLang: 'cpp'         },
};

async function runCode(code, lang, stdin = '') {
  const l = LANG_MAP[lang] || LANG_MAP.python;
  const res = await fetch(PISTON_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: l.pistonLang, version: l.pistonVer,
      files: [{ content: code }], stdin,
    }),
  });
  const d = await res.json();
  return { stdout: d.run?.stdout || '', stderr: d.run?.stderr || '', code: d.run?.code };
}

async function callGemini(prompt) {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 400, temperature: 0.5 } }),
  });
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function normalize(s) { return String(s || '').trim().replace(/\r\n/g, '\n'); }

export default function LessonPlayer() {
  const { subjectId, lessonId } = useParams();
  const { user, profile }       = useAuth();
  const { isDark }              = useTheme();
  const navigate                = useNavigate();

  const [lesson,    setLesson]    = useState(null);
  const [exercise,  setExercise]  = useState(null);
  const [progress,  setProgress]  = useState(null);
  const [allLessons,setAllLessons]= useState([]);
  const [loading,   setLoading]   = useState(true);

  // Active tab: 'theory' | 'example' | 'exercise'
  const [tab, setTab] = useState('theory');

  // Example tab
  const [exampleOutput, setExampleOutput] = useState('');
  const [exampleRunning,setExampleRunning]= useState(false);

  // Exercise tab
  const [code,         setCode]         = useState('');
  const [running,      setRunning]      = useState(false);
  const [testResults,  setTestResults]  = useState([]);
  const [submitStatus, setSubmitStatus] = useState(null); // null | 'pass' | 'fail'
  const [showHint,     setShowHint]     = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [aiHelp,       setAiHelp]       = useState('');
  const [aiLoading,    setAiLoading]    = useState(false);
  const [activeTest,   setActiveTest]   = useState(0);
  const [customInput,  setCustomInput]  = useState('');
  const [customOutput, setCustomOutput] = useState('');
  const [customRunning,setCustomRunning]= useState(false);

  useEffect(() => { loadLesson(); }, [lessonId]);

  async function loadLesson() {
    setLoading(true);
    setCode(''); setTestResults([]); setSubmitStatus(null);
    setExampleOutput(''); setAiHelp(''); setShowHint(false); setShowSolution(false);

    const [{ data: l }, { data: ex }, { data: prog }, { data: siblings }] = await Promise.all([
      supabase.from('lessons').select('*').eq('id', lessonId).single(),
      supabase.from('lesson_exercises').select('*').eq('lesson_id', lessonId).maybeSingle(),
      supabase.from('lesson_progress').select('*').eq('user_id', user.id).eq('lesson_id', lessonId).maybeSingle(),
      supabase.from('lessons').select('id,title,order_num,lesson_exercises(id)').eq('subject_id', subjectId).eq('is_published', true).order('order_num'),
    ]);

    setLesson(l);
    setExercise(ex || null);
    setProgress(prog || { theory_done: false, example_done: false, exercise_done: false, exercise_passed: false, attempts: 0 });
    setAllLessons(siblings || []);
    setCode(ex?.starter_code || getDefaultCode(l?.example_lang || 'python'));
    setLoading(false);
  }

  function getDefaultCode(lang) {
    const defaults = {
      python: '# Write your solution here\n',
      javascript: '// Write your solution here\n',
      java: 'public class Solution {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}\n',
      c: '#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n',
      cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n',
    };
    return defaults[lang] || defaults.python;
  }

  // ── Mark theory read ─────────────────────────────────────────────────────────
  async function markTheoryDone() {
    await upsertProgress({ theory_done: true });
    setProgress(p => ({ ...p, theory_done: true }));
    // Auto-advance to example if theory just completed
    if (!progress?.example_done) setTab('example');
  }

  // ── Run example code ─────────────────────────────────────────────────────────
  async function runExample() {
    if (!lesson?.example_code) return;
    setExampleRunning(true); setExampleOutput('');
    const { stdout, stderr } = await runCode(lesson.example_code, lesson.example_lang || 'python');
    setExampleOutput(stdout || stderr || '(no output)');
    setExampleRunning(false);
    await upsertProgress({ example_done: true });
    setProgress(p => ({ ...p, example_done: true }));
  }

  // ── Run custom input ─────────────────────────────────────────────────────────
  async function runCustom() {
    setCustomRunning(true); setCustomOutput('');
    const { stdout, stderr } = await runCode(code, exercise?.language || 'python', customInput);
    setCustomOutput(stdout || stderr || '(no output)');
    setCustomRunning(false);
  }

  // ── Run against all test cases ────────────────────────────────────────────────
  async function runTests() {
    if (!exercise) return;
    setRunning(true); setTestResults([]); setSubmitStatus(null);
    const tcs = exercise.test_cases || [];
    const results = [];
    for (const tc of tcs) {
      const { stdout, stderr } = await runCode(code, exercise.language || 'python', tc.input || '');
      const actual   = normalize(stdout);
      const expected = normalize(tc.expected_output);
      results.push({ ...tc, actual, passed: actual === expected, stderr });
    }
    setTestResults(results);
    setRunning(false);

    const allPassed = results.length > 0 && results.every(r => r.passed);
    setSubmitStatus(allPassed ? 'pass' : 'fail');

    // Update attempts
    const newAttempts = (progress?.attempts || 0) + 1;
    await upsertProgress({ attempts: newAttempts });
    setProgress(p => ({ ...p, attempts: newAttempts }));

    if (allPassed && !progress?.exercise_passed) {
      await upsertProgress({ exercise_done: true, exercise_passed: true, last_code: code, xp_earned: exercise.xp_reward || 10, completed_at: new Date().toISOString() });
      setProgress(p => ({ ...p, exercise_done: true, exercise_passed: true }));
      // Award XP
      await supabase.rpc('increment_xp', { user_id: user.id, amount: exercise.xp_reward || 10 }).catch(() => {});
    } else if (!allPassed) {
      await upsertProgress({ last_code: code });
    }
  }

  async function upsertProgress(patch) {
    const existing = progress?.id;
    if (existing) {
      await supabase.from('lesson_progress').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', existing);
    } else {
      const { data } = await supabase.from('lesson_progress').insert({ user_id: user.id, lesson_id: lessonId, ...patch }).select().single();
      if (data) setProgress(data);
    }
  }

  // ── AI hint ──────────────────────────────────────────────────────────────────
  async function getAiHelp() {
    if (aiLoading) return;
    setAiLoading(true); setAiHelp('');
    try {
      const failedTests = testResults.filter(r => !r.passed);
      const prompt = `You are a helpful coding tutor. A student is stuck on this problem:

Problem: ${exercise?.problem}
Language: ${exercise?.language}

Their current code:
\`\`\`
${code}
\`\`\`

${failedTests.length > 0 ? `Failing test: Input: "${failedTests[0]?.input}" Expected: "${failedTests[0]?.expected_output}" Got: "${failedTests[0]?.actual}"` : 'They haven\'t run tests yet.'}

Give a short, helpful hint (2-3 sentences) WITHOUT giving away the solution. Point them in the right direction.`;
      const hint = await callGemini(prompt);
      setAiHelp(hint);
    } catch (e) { setAiHelp('⚠️ ' + e.message); }
    finally { setAiLoading(false); }
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  function getAdjacentLesson(dir) {
    const idx = allLessons.findIndex(l => l.id === lessonId);
    return allLessons[idx + dir] || null;
  }

  // ── Theme ─────────────────────────────────────────────────────────────────────
  const bg      = isDark ? '#0f1117' : '#f8fafc';
  const surface = isDark ? '#141720' : '#ffffff';
  const border  = isDark ? '#1e2433' : '#e5e7eb';
  const textPri = isDark ? '#e2e8f0' : '#1e293b';
  const textSec = isDark ? '#a0aec0' : '#64748b';
  const textMut = isDark ? '#4a5568' : '#94a3b8';
  const surfAlt = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc';

  const tabStyle = (t) => ({
    padding: '0.6rem 1.25rem', border: 'none', cursor: 'pointer',
    fontWeight: tab === t ? 700 : 500, fontSize: '0.875rem',
    borderBottom: `3px solid ${tab === t ? '#667eea' : 'transparent'}`,
    color: tab === t ? '#667eea' : textMut,
    background: 'transparent', transition: 'all 0.15s',
    fontFamily: '"Inter",Arial,sans-serif',
  });

  const stepDone = (key) => progress?.[key];
  const allDone  = stepDone('theory_done') && stepDone('example_done') && (!exercise || stepDone('exercise_passed'));

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: bg }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${border}`, borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!lesson) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: bg }}>
      <div style={{ textAlign: 'center', color: textSec }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>😕</div>
        <p>Lesson not found.</p>
        <Link to={`/study-hub/subject/${subjectId}`} style={{ color: '#667eea' }}>← Back to subject</Link>
      </div>
    </div>
  );

  const prevLesson = getAdjacentLesson(-1);
  const nextLesson = getAdjacentLesson(1);
  const tcs        = exercise?.test_cases || [];
  const visibleTcs = tcs.filter(tc => !tc.is_hidden);

  return (
    <div style={{ display: 'flex', height: '100vh', background: bg, fontFamily: '"Inter",Arial,sans-serif', overflow: 'hidden' }}>

      {/* ── LEFT PANEL: Lesson list ── */}
      <div style={{ width: 240, background: surface, borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '0.875rem 1rem', borderBottom: `1px solid ${border}` }}>
          <Link to={`/study-hub/subject/${subjectId}`} style={{ color: '#667eea', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>← Back to Subject</Link>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {allLessons.map((l, i) => {
            const isCurrent = l.id === lessonId;
            return (
              <div key={l.id}
                onClick={() => navigate(`/study-hub/subject/${subjectId}/lesson/${l.id}`)}
                style={{ padding: '0.75rem', borderRadius: 10, marginBottom: '0.25rem', cursor: 'pointer', background: isCurrent ? 'rgba(102,126,234,0.12)' : 'transparent', border: `1px solid ${isCurrent ? 'rgba(102,126,234,0.25)' : 'transparent'}`, transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {/* Progress ring */}
                  <div style={{ width: 22, height: 22, flexShrink: 0 }}>
                    <ProgressRing size={22} done={allDone && isCurrent} partial={isCurrent && !allDone} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.7rem', color: textMut }}>Lesson {l.order_num}</div>
                    <div style={{ fontSize: '0.82rem', color: isCurrent ? textPri : textSec, fontWeight: isCurrent ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</div>
                  </div>
                  {l.lesson_exercises?.length > 0 && (
                    <span style={{ fontSize: '0.65rem', color: '#667eea' }}>💻</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Lesson header */}
        <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: '0 1.5rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.875rem', marginBottom: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: textMut }}>Lesson {lesson.order_num}</div>
              <h2 style={{ color: textPri, margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{lesson.title}</h2>
            </div>
            {/* Step progress pills */}
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              {[
                { key: 'theory_done',   label: '📖 Theory',   t: 'theory'   },
                { key: 'example_done',  label: '💡 Example',  t: 'example'  },
                ...(exercise ? [{ key: 'exercise_passed', label: '✏️ Exercise', t: 'exercise' }] : []),
              ].map(step => (
                <div key={step.key} style={{ padding: '0.25rem 0.75rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, background: stepDone(step.key) ? 'rgba(72,187,120,0.12)' : (tab === step.t ? 'rgba(102,126,234,0.1)' : surfAlt), color: stepDone(step.key) ? '#48bb78' : (tab === step.t ? '#667eea' : textMut), border: `1px solid ${stepDone(step.key) ? 'rgba(72,187,120,0.25)' : (tab === step.t ? 'rgba(102,126,234,0.2)' : border)}` }}>
                  {stepDone(step.key) ? '✓ ' : ''}{step.label}
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            <button style={tabStyle('theory')} onClick={() => setTab('theory')}>📖 Theory</button>
            {lesson.example_code && <button style={tabStyle('example')} onClick={() => setTab('example')}>💡 Example</button>}
            {exercise && <button style={tabStyle('exercise')} onClick={() => setTab('exercise')}>✏️ Exercise</button>}
          </div>
        </div>

        {/* ── THEORY TAB ── */}
        {tab === 'theory' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem 2rem' }}>
            <div style={{ maxWidth: 780, margin: '0 auto' }}>
              {lesson.theory ? (
                <div style={{ color: textSec, fontSize: '0.95rem', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                  <TheoryRenderer content={lesson.theory} isDark={isDark} textPri={textPri} textSec={textSec} border={border} />
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '4rem', color: textMut }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📖</div>
                  <p>No theory content for this lesson yet.</p>
                </div>
              )}

              {!stepDone('theory_done') && (
                <div style={{ marginTop: '2rem', padding: '1.25rem', background: isDark ? 'rgba(102,126,234,0.06)' : 'rgba(79,70,229,0.04)', border: `1px solid ${isDark ? 'rgba(102,126,234,0.15)' : 'rgba(79,70,229,0.1)'}`, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: textSec, fontSize: '0.875rem' }}>Done reading? Mark this section complete.</span>
                  <button onClick={markTheoryDone} style={{ padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>
                    ✓ Mark as Read {lesson.example_code ? '→ Example' : ''}
                  </button>
                </div>
              )}
              {stepDone('theory_done') && (
                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  {lesson.example_code && <button onClick={() => setTab('example')} style={{ padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>Next: Example →</button>}
                  {!lesson.example_code && exercise && <button onClick={() => setTab('exercise')} style={{ padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>Next: Exercise →</button>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── EXAMPLE TAB ── */}
        {tab === 'example' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>
              {/* Code */}
              <div style={{ borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: surfAlt }}>
                  <span style={{ color: textMut, fontSize: '0.78rem', fontWeight: 600 }}>EXAMPLE CODE — {(lesson.example_lang || 'python').toUpperCase()}</span>
                  <button onClick={runExample} disabled={exampleRunning}
                    style={{ padding: '0.35rem 0.875rem', background: exampleRunning ? border : '#48bb78', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>
                    {exampleRunning ? '▶ Running...' : '▶ Run Code'}
                  </button>
                </div>
                <div style={{ flex: 1 }}>
                  <Editor
                    height="100%"
                    language={LANG_MAP[lesson.example_lang || 'python']?.monacoLang || 'python'}
                    value={lesson.example_code || ''}
                    theme={isDark ? 'vs-dark' : 'light'}
                    options={{ readOnly: true, fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, lineNumbers: 'on', wordWrap: 'on' }}
                  />
                </div>
              </div>

              {/* Explanation + output */}
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {lesson.example_explain && (
                  <div style={{ padding: '1rem', borderBottom: `1px solid ${border}`, overflowY: 'auto', maxHeight: '45%' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: textMut, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>What this code does</div>
                    <div style={{ color: textSec, fontSize: '0.875rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{lesson.example_explain}</div>
                  </div>
                )}
                <div style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: textMut, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Output</div>
                  <div style={{ flex: 1, background: isDark ? '#0a0d14' : '#1e1e1e', borderRadius: 8, padding: '0.875rem', fontFamily: '"Fira Code",monospace', fontSize: '0.85rem', color: '#e2e8f0', whiteSpace: 'pre-wrap', overflowY: 'auto', border: `1px solid ${border}` }}>
                    {exampleRunning ? <span style={{ color: '#667eea' }}>Running...</span>
                      : exampleOutput ? exampleOutput
                      : <span style={{ color: '#4a5568' }}>Click "Run Code" to see the output</span>}
                  </div>
                </div>
              </div>
            </div>

            {exercise && stepDone('example_done') && (
              <div style={{ padding: '0.875rem 1.5rem', borderTop: `1px solid ${border}`, display: 'flex', justifyContent: 'flex-end', background: surface }}>
                <button onClick={() => setTab('exercise')} style={{ padding: '0.55rem 1.5rem', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>
                  Next: Try it Yourself →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── EXERCISE TAB ── */}
        {tab === 'exercise' && exercise && (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '380px 1fr', minHeight: 0, overflow: 'hidden' }}>

            {/* Left: Problem statement */}
            <div style={{ borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                {/* Difficulty */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                  <span style={{ background: { EASY:'rgba(72,187,120,0.12)', MEDIUM:'rgba(237,137,54,0.12)', HARD:'rgba(245,101,101,0.12)' }[exercise.difficulty], color: { EASY:'#48bb78', MEDIUM:'#ed8936', HARD:'#f56565' }[exercise.difficulty], padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }}>
                    {exercise.difficulty}
                  </span>
                  <span style={{ background: 'rgba(102,126,234,0.1)', color: '#8b9cf4', padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }}>
                    +{exercise.xp_reward || 10} XP
                  </span>
                  {progress?.exercise_passed && <span style={{ background: 'rgba(72,187,120,0.12)', color: '#48bb78', padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }}>✓ Solved</span>}
                </div>

                {/* Problem */}
                <div style={{ color: textPri, fontSize: '0.9rem', lineHeight: 1.8, marginBottom: '1.5rem', whiteSpace: 'pre-wrap' }}>{exercise.problem}</div>

                {/* Test cases */}
                {visibleTcs.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: textMut, marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Examples</div>
                    {visibleTcs.map((tc, i) => (
                      <div key={i} style={{ background: surfAlt, border: `1px solid ${border}`, borderRadius: 8, padding: '0.75rem', marginBottom: '0.5rem', fontSize: '0.82rem' }}>
                        {tc.input && <div style={{ marginBottom: '0.4rem' }}><span style={{ color: textMut, fontWeight: 600 }}>Input: </span><code style={{ color: textPri, background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>{tc.input}</code></div>}
                        <div><span style={{ color: textMut, fontWeight: 600 }}>Expected: </span><code style={{ color: '#48bb78', background: 'rgba(72,187,120,0.08)', padding: '1px 6px', borderRadius: 4 }}>{tc.expected_output}</code></div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Hint */}
                {exercise.hint && (
                  <div style={{ marginBottom: '1rem' }}>
                    <button onClick={() => setShowHint(h => !h)} style={{ background: 'rgba(237,137,54,0.1)', color: '#ed8936', border: '1px solid rgba(237,137,54,0.2)', borderRadius: 7, padding: '0.35rem 0.875rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                      💡 {showHint ? 'Hide Hint' : 'Show Hint'}
                    </button>
                    {showHint && <div style={{ marginTop: '0.75rem', padding: '0.875rem', background: 'rgba(237,137,54,0.06)', border: '1px solid rgba(237,137,54,0.15)', borderRadius: 8, color: textSec, fontSize: '0.875rem', lineHeight: 1.7 }}>{exercise.hint}</div>}
                  </div>
                )}

                {/* Show solution after 3 fails */}
                {(progress?.attempts || 0) >= 3 && exercise.solution && (
                  <div>
                    <button onClick={() => setShowSolution(s => !s)} style={{ background: 'rgba(245,101,101,0.08)', color: '#f56565', border: '1px solid rgba(245,101,101,0.2)', borderRadius: 7, padding: '0.35rem 0.875rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                      🔓 {showSolution ? 'Hide Solution' : 'Reveal Solution'}
                    </button>
                    {showSolution && (
                      <div style={{ marginTop: '0.75rem', background: isDark ? '#0a0d14' : '#1e1e1e', borderRadius: 8, padding: '0.875rem', fontFamily: '"Fira Code",monospace', fontSize: '0.82rem', color: '#e2e8f0', whiteSpace: 'pre-wrap', border: `1px solid ${border}` }}>
                        {exercise.solution}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Editor + output */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Editor toolbar */}
              <div style={{ padding: '0.5rem 0.875rem', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: surfAlt, flexShrink: 0 }}>
                <span style={{ color: textMut, fontSize: '0.78rem', fontWeight: 600 }}>{(exercise.language || 'python').toUpperCase()}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={getAiHelp} disabled={aiLoading} style={{ padding: '0.3rem 0.75rem', background: 'rgba(102,126,234,0.1)', color: '#8b9cf4', border: '1px solid rgba(102,126,234,0.2)', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}>
                    {aiLoading ? '🤖 Thinking...' : '🤖 AI Help'}
                  </button>
                  <button onClick={runTests} disabled={running} style={{ padding: '0.3rem 1rem', background: running ? border : 'linear-gradient(135deg,#667eea,#764ba2)', color: running ? textMut : 'white', border: 'none', borderRadius: 7, cursor: running ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>
                    {running ? '⏳ Running...' : '▶ Submit'}
                  </button>
                </div>
              </div>

              {/* Monaco editor */}
              <div style={{ flex: 1, minHeight: 0 }}>
                <Editor
                  height="100%"
                  language={LANG_MAP[exercise.language || 'python']?.monacoLang || 'python'}
                  value={code}
                  onChange={v => setCode(v || '')}
                  theme={isDark ? 'vs-dark' : 'light'}
                  options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, lineNumbers: 'on', wordWrap: 'on', automaticLayout: true }}
                />
              </div>

              {/* Bottom panel: test results / AI help / custom input */}
              <div style={{ height: 200, borderTop: `1px solid ${border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                {/* Mini tabs */}
                <div style={{ display: 'flex', background: surfAlt, borderBottom: `1px solid ${border}` }}>
                  {['Results', 'Custom Input', 'AI Help'].map(t => (
                    <button key={t} style={{ padding: '0.4rem 1rem', border: 'none', background: 'transparent', color: textMut, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', borderBottom: '2px solid transparent' }}>{t}</button>
                  ))}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
                  {/* Submit status banner */}
                  {submitStatus && (
                    <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.875rem', borderRadius: 8, background: submitStatus === 'pass' ? 'rgba(72,187,120,0.12)' : 'rgba(245,101,101,0.1)', color: submitStatus === 'pass' ? '#48bb78' : '#f56565', fontWeight: 700, fontSize: '0.875rem', border: `1px solid ${submitStatus === 'pass' ? 'rgba(72,187,120,0.25)' : 'rgba(245,101,101,0.2)'}` }}>
                      {submitStatus === 'pass' ? `🎉 All tests passed! +${exercise.xp_reward || 10} XP earned!` : `❌ Some tests failed. Check your logic and try again.`}
                    </div>
                  )}

                  {/* Test case results */}
                  {testResults.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {testResults.map((r, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 7, background: r.passed ? 'rgba(72,187,120,0.06)' : 'rgba(245,101,101,0.06)', border: `1px solid ${r.passed ? 'rgba(72,187,120,0.15)' : 'rgba(245,101,101,0.15)'}`, fontSize: '0.78rem' }}>
                          <span style={{ fontWeight: 700, color: r.passed ? '#48bb78' : '#f56565', minWidth: 60 }}>{r.passed ? '✓ Pass' : '✗ Fail'} {r.is_hidden ? '(hidden)' : `#${i+1}`}</span>
                          {!r.is_hidden && !r.passed && (
                            <>
                              {r.input && <span style={{ color: textMut }}>in: <code style={{ color: textSec }}>{r.input}</code></span>}
                              <span style={{ color: textMut }}>expected: <code style={{ color: '#48bb78' }}>{r.expected_output}</code></span>
                              <span style={{ color: textMut }}>got: <code style={{ color: '#f56565' }}>{r.actual || r.stderr?.substring(0,40)}</code></span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI help */}
                  {aiHelp && (
                    <div style={{ padding: '0.75rem', background: 'rgba(102,126,234,0.06)', border: '1px solid rgba(102,126,234,0.15)', borderRadius: 8, color: textSec, fontSize: '0.85rem', lineHeight: 1.7 }}>
                      🤖 {aiHelp}
                    </div>
                  )}

                  {testResults.length === 0 && !aiHelp && !submitStatus && (
                    <div style={{ color: textMut, fontSize: '0.82rem', textAlign: 'center', paddingTop: '1rem' }}>Click Submit to run your code against all test cases</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Bottom nav: prev / next lesson ── */}
        {(prevLesson || nextLesson) && tab !== 'exercise' && (
          <div style={{ padding: '0.75rem 1.5rem', borderTop: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', background: surface, flexShrink: 0 }}>
            {prevLesson
              ? <button onClick={() => navigate(`/study-hub/subject/${subjectId}/lesson/${prevLesson.id}`)} style={{ padding: '0.45rem 1rem', background: surfAlt, color: textSec, border: `1px solid ${border}`, borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem' }}>← {prevLesson.title}</button>
              : <div />}
            {nextLesson && (
              <button onClick={() => navigate(`/study-hub/subject/${subjectId}/lesson/${nextLesson.id}`)} style={{ padding: '0.45rem 1.25rem', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
                {nextLesson.title} →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Progress Ring ─────────────────────────────────────────────────────────────
function ProgressRing({ size, done, partial }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#2d3748" strokeWidth={3} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={done ? '#48bb78' : partial ? '#667eea' : '#2d3748'}
        strokeWidth={3}
        strokeDasharray={c}
        strokeDashoffset={done ? 0 : partial ? c * 0.5 : c}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.4s' }}
      />
      {done && (
        <text x={size/2} y={size/2 + 4} textAnchor="middle" fill="#48bb78" fontSize={9} style={{ transform: `rotate(90deg) translate(0,-${size}px)`, transformOrigin: `${size/2}px ${size/2}px` }}>✓</text>
      )}
    </svg>
  );
}

// ── Theory Renderer — renders markdown-style formatting ───────────────────────
function TheoryRenderer({ content, isDark, textPri, textSec, border }) {
  // Split by code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const lines = part.split('\n');
          const code  = lines.slice(1, -1).join('\n');
          return (
            <pre key={i} style={{ background: isDark ? '#0a0d14' : '#1e1e1e', color: '#e2e8f0', padding: '1rem 1.25rem', borderRadius: 10, fontFamily: '"Fira Code",monospace', fontSize: '0.85rem', overflowX: 'auto', margin: '1rem 0', border: `1px solid ${border}`, lineHeight: 1.7 }}>
              <code>{code}</code>
            </pre>
          );
        }
        // Render inline **bold** and `code`
        const rendered = part
          .split(/(\*\*.*?\*\*|`[^`]+`)/g)
          .map((chunk, j) => {
            if (chunk.startsWith('**') && chunk.endsWith('**'))
              return <strong key={j} style={{ color: textPri }}>{chunk.slice(2, -2)}</strong>;
            if (chunk.startsWith('`') && chunk.endsWith('`'))
              return <code key={j} style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9', padding: '1px 6px', borderRadius: 4, fontFamily: '"Fira Code",monospace', fontSize: '0.875em', color: '#8b9cf4' }}>{chunk.slice(1, -1)}</code>;
            return chunk;
          });
        return <span key={i}>{rendered}</span>;
      })}
    </>
  );
}
