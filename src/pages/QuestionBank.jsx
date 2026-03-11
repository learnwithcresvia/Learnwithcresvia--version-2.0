// src/pages/QuestionBank.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../utils/supabaseClient';
import Editor from '@monaco-editor/react';

// ── Constants ────────────────────────────────────────────────────────────────
const JUDGE0_URL = 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true';

const LANG_MAP = {
  python:     { judgeId: 71, monacoLang: 'python'     },
  java:       { judgeId: 62, monacoLang: 'java'       },
  c:          { judgeId: 50, monacoLang: 'c'          },
  cpp:        { judgeId: 54, monacoLang: 'cpp'        },
  javascript: { judgeId: 63, monacoLang: 'javascript' },
};

const LANG_META = {
  Python: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  icon: '🐍' },
  C:      { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: '⚙️' },
  Java:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: '☕' },
  'C++':  { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',   icon: '🔷' },
};

const DIFF = {
  EASY:   { fg: '#22c55e', bg: 'rgba(34,197,94,0.1)',   bd: 'rgba(34,197,94,0.2)'   },
  MEDIUM: { fg: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  bd: 'rgba(245,158,11,0.2)'  },
  HARD:   { fg: '#ef4444', bg: 'rgba(239,68,68,0.1)',   bd: 'rgba(239,68,68,0.2)'   },
};

async function runCode(code, lang, stdin = '') {
  const l   = LANG_MAP[lang?.toLowerCase()] || LANG_MAP.python;
  const res = await fetch(JUDGE0_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_code: code,
      language_id: l.judgeId,
      stdin:       (stdin || '') + '\n',
    }),
  });
  const d = await res.json();
  return {
    stdout: d.stdout || '',
    stderr: d.stderr || d.compile_output || '',
  };
}

const norm = s => String(s || '').trim().replace(/\r\n/g, '\n');

const DEFAULT_CODE = {
  python:     '# Write your solution here\n',
  java:       'import java.util.Scanner;\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n    }\n}\n',
  c:          '#include <stdio.h>\nint main() {\n    // Write your solution here\n    return 0;\n}\n',
  cpp:        '#include <iostream>\nusing namespace std;\nint main() {\n    // Write your solution here\n    return 0;\n}\n',
  javascript: '// Write your solution here\n',
};

// ── Main Component ───────────────────────────────────────────────────────────
export default function QuestionBank() {
  const { user }   = useAuth();
  const { isDark } = useTheme();

  const [languages,     setLanguages]     = useState([]);
  const [topics,        setTopics]        = useState([]);
  const [questions,     setQuestions]     = useState({ coding: [], mcq: [], theory: [] });
  const [solved,        setSolved]        = useState(new Set());
  const [loading,       setLoading]       = useState(true);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [qLoading,      setQLoading]      = useState(false);
  const [selLang,       setSelLang]       = useState('Python');
  const [selTopic,      setSelTopic]      = useState(null);
  const [qTab,          setQTab]          = useState('coding');
  const [selQ,          setSelQ]          = useState(null);
  const [selQType,      setSelQType]      = useState('coding');
  const [code,          setCode]          = useState('');
  const [running,       setRunning]       = useState(false);
  const [testResults,   setTestResults]   = useState([]);
  const [submitStatus,  setSubmitStatus]  = useState(null);
  const [showHint,      setShowHint]      = useState(false);
  const [showSol,       setShowSol]       = useState(false);
  const [attempts,      setAttempts]      = useState(0);
  const [customIn,      setCustomIn]      = useState('');
  const [customOut,     setCustomOut]     = useState('');
  const [customRunning, setCustomRunning] = useState(false);
  const [bottomTab,     setBottomTab]     = useState('output');
  const [mcqPick,       setMcqPick]       = useState(null);
  const [mcqDone,       setMcqDone]       = useState(false);

  // ── Load languages ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('qb_topics').select('language').order('language');
      const langs = [...new Set((data || []).map(d => d.language))];
      setLanguages(langs.length ? langs : ['Python']);
      setSelLang(langs[0] || 'Python');
      setLoading(false);
    })();
  }, []);

  // ── Load topics ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selLang) return;
    (async () => {
      setTopicsLoading(true);
      setTopics([]); setSelTopic(null);
      setQuestions({ coding: [], mcq: [], theory: [] }); setSelQ(null);
      const { data } = await supabase.from('qb_topics').select('*').eq('language', selLang).order('order_num');
      setTopics(data || []);
      if (data?.length) setSelTopic(data[0]);
      setTopicsLoading(false);
    })();
  }, [selLang]);

  // ── Load questions ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!selTopic) return;
    (async () => {
      setQLoading(true); setSelQ(null); setTestResults([]); setSubmitStatus(null);
      const [{ data: c }, { data: m }, { data: t }] = await Promise.all([
        supabase.from('qb_coding').select('*').eq('topic_id', selTopic.id).order('order_num'),
        supabase.from('qb_mcq').select('*').eq('topic_id', selTopic.id).order('order_num'),
        supabase.from('qb_theory').select('*').eq('topic_id', selTopic.id).order('order_num'),
      ]);
      setQuestions({ coding: c || [], mcq: m || [], theory: t || [] });
      setQLoading(false);
    })();
  }, [selTopic]);

  // ── Load solved ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from('qb_attempts').select('question_id').eq('user_id', user.id).eq('passed', true)
      .then(({ data }) => setSolved(new Set((data || []).map(d => d.question_id))))
      .catch(() => {});
  }, [user]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const isSolved = (q) => q && solved.has(q.id);

  function openQ(q, type) {
    setSelQ(q); setSelQType(type);
    setTestResults([]); setSubmitStatus(null);
    setShowHint(false); setShowSol(false); setAttempts(0);
    setCustomIn(''); setCustomOut(''); setBottomTab('output');

    // If already solved — lock MCQ immediately
    const alreadySolved = solved.has(q.id);
    setMcqPick(alreadySolved ? q.answer : null);
    setMcqDone(alreadySolved);

    if (type === 'coding') {
      setCode(q.starter_code || DEFAULT_CODE[q.language?.toLowerCase()] || DEFAULT_CODE.python);
      // Show results tab for solved questions
      if (alreadySolved) setBottomTab('results');
    }
  }

  async function submit() {
    if (!selQ || running || isSolved(selQ)) return;
    setRunning(true); setTestResults([]); setSubmitStatus(null);
    const tcs = selQ.test_cases || [];
    const results = [];
    for (const tc of tcs) {
      const { stdout, stderr } = await runCode(code, selQ.language || selLang.toLowerCase(), tc.input || '');
      const actual = norm(stdout), expected = norm(tc.expected_output);
      results.push({ ...tc, actual, passed: actual === expected, stderr });
    }
    setTestResults(results);
    setRunning(false);
    setAttempts(a => a + 1);
    const passed = results.length > 0 && results.every(r => r.passed);
    setSubmitStatus(passed ? 'pass' : 'fail');
    setBottomTab('results');
    if (passed && user) {
      setSolved(s => new Set([...s, selQ.id]));
      supabase.from('qb_attempts').upsert(
        { user_id: user.id, question_id: selQ.id, passed: true, language: selLang },
        { onConflict: 'user_id,question_id' }
      ).catch(() => {});
      supabase.rpc('increment_xp', { user_id: user.id, amount: selQ.xp_reward || 10 }).catch(() => {});
    }
  }

  async function runCustom() {
    if (!selQ || customRunning) return;
    setCustomRunning(true); setCustomOut('');
    const { stdout, stderr } = await runCode(code, selQ.language || selLang.toLowerCase(), customIn);
    setCustomOut(stdout || stderr || '(no output)');
    setCustomRunning(false);
  }

  function submitMcq() {
    if (mcqPick === null || isSolved(selQ)) return;
    setMcqDone(true);
    if (mcqPick === selQ.answer && user) {
      setSolved(s => new Set([...s, selQ.id]));
      supabase.from('qb_attempts').upsert(
        { user_id: user.id, question_id: selQ.id, passed: true, language: selLang },
        { onConflict: 'user_id,question_id' }
      ).catch(() => {});
    }
  }

  // ── Theme ────────────────────────────────────────────────────────────────
  const bg      = isDark ? '#0d1117' : '#f6f8fa';
  const surface = isDark ? '#161b22' : '#ffffff';
  const border  = isDark ? '#21262d' : '#d0d7de';
  const textPri = isDark ? '#e6edf3' : '#1f2328';
  const textSec = isDark ? '#8b949e' : '#656d76';
  const textMut = isDark ? '#3d444d' : '#adbac7';
  const surfAlt = isDark ? '#1c2128' : '#f6f8fa';
  const accent  = '#667eea';

  const topicSolved = selTopic
    ? [...questions.coding, ...questions.mcq].filter(q => solved.has(q.id)).length
    : 0;
  const topicTotal = questions.coding.length + questions.mcq.length;
  const showList   = !selQ;

  // ── Loading screen ───────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: bg, fontFamily: '"Inter",sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${border}`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
        <div style={{ color: textMut, fontSize: '0.875rem' }}>Loading question bank…</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', background: bg, fontFamily: '"Inter",sans-serif', overflow: 'hidden' }}>

      {/* ══ LEFT SIDEBAR ══ */}
      <div style={{ width: 240, background: surface, borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '1rem', borderBottom: `1px solid ${border}` }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: textMut, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Practice Hub</div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: textPri, letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>Question Bank</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {languages.map(lang => {
              const m   = LANG_META[lang] || { color: accent, bg: `${accent}18`, icon: '💻' };
              const act = lang === selLang;
              return (
                <button key={lang} onClick={() => setSelLang(lang)}
                  style={{ padding: '0.25rem 0.6rem', borderRadius: 6, border: `1.5px solid ${act ? m.color : border}`, background: act ? m.bg : 'transparent', color: act ? m.color : textMut, fontWeight: act ? 700 : 400, fontSize: '0.72rem', cursor: 'pointer', display: 'flex', gap: '0.25rem', alignItems: 'center', transition: 'all 0.15s' }}>
                  <span style={{ fontSize: '0.85em' }}>{m.icon}</span>{lang}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.4rem' }}>
          {topicsLoading
            ? <div style={{ padding: '2rem', textAlign: 'center', color: textMut, fontSize: '0.78rem' }}>Loading…</div>
            : topics.map((t, i) => {
                const act = selTopic?.id === t.id;
                return (
                  <button key={t.id} onClick={() => { setSelTopic(t); setSelQ(null); }}
                    style={{ width: '100%', textAlign: 'left', padding: '0.55rem 0.7rem', borderRadius: 8, marginBottom: '0.15rem', border: 'none', background: act ? `${accent}12` : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.12s' }}>
                    <span style={{ fontSize: '0.58rem', color: textMut, minWidth: 16, fontWeight: 600 }}>{String(i+1).padStart(2,'0')}</span>
                    <span style={{ flex: 1, fontSize: '0.78rem', color: act ? textPri : textSec, fontWeight: act ? 700 : 400, lineHeight: 1.3 }}>{t.topic}</span>
                    {act && <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />}
                  </button>
                );
              })
          }
        </div>

        <div style={{ padding: '0.75rem 1rem', borderTop: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.7rem', color: textSec }}>Total Solved</div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: accent }}>{solved.size}</div>
        </div>
      </div>

      {/* ══ MAIN AREA ══ */}
      <div style={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>

        {/* ── QUESTION LIST (visible when no question selected) ── */}
        {showList && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${border}`, background: surface, flexShrink: 0 }}>
              {selTopic ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: textPri, marginBottom: '0.25rem' }}>{selTopic.topic}</div>
                    {topicTotal > 0 && <div style={{ fontSize: '0.72rem', color: textSec }}>{topicSolved} of {topicTotal} solved</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {[
                      { key: 'coding', label: `💻 ${questions.coding.length} Coding`, color: '#667eea' },
                      { key: 'mcq',    label: `🧠 ${questions.mcq.length} MCQ`,       color: '#f59e0b' },
                      { key: 'theory', label: `📖 ${questions.theory.length} Theory`,  color: '#22c55e' },
                    ].map(({ key, label, color }) => (
                      <button key={key} onClick={() => setQTab(key)}
                        style={{ padding: '0.3rem 0.9rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, border: `1.5px solid ${qTab === key ? color : border}`, background: qTab === key ? `${color}15` : 'transparent', color: qTab === key ? color : textSec, cursor: 'pointer', transition: 'all 0.15s' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : <div style={{ color: textMut, fontSize: '0.85rem' }}>← Select a topic to begin</div>}
            </div>

            {topicTotal > 0 && (
              <div style={{ height: 3, background: border, flexShrink: 0 }}>
                <div style={{ height: '100%', width: `${(topicSolved / topicTotal) * 100}%`, background: `linear-gradient(90deg,${accent},#764ba2)`, transition: 'width 0.4s' }} />
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
              {qLoading
                ? <div style={{ padding: '3rem', textAlign: 'center', color: textMut, fontSize: '0.8rem' }}>Loading questions…</div>
                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.65rem' }}>

                    {qTab === 'coding' && questions.coding.map((q, i) => {
                      const d  = DIFF[q.difficulty] || DIFF.EASY;
                      const sv = solved.has(q.id);
                      return (
                        <button key={q.id} onClick={() => openQ(q, 'coding')}
                          style={{ textAlign: 'left', padding: '1rem 1.1rem', borderRadius: 12, border: `1px solid ${sv ? 'rgba(34,197,94,0.3)' : border}`, background: sv ? 'rgba(34,197,94,0.04)' : surface, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '0.6rem', color: textMut, fontWeight: 600 }}>{String(i+1).padStart(2,'0')}</span>
                            {sv && <span style={{ fontSize: '0.65rem', color: '#22c55e', fontWeight: 800 }}>✓ Solved</span>}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: textPri, lineHeight: 1.4 }}>{q.title}</div>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: d.fg, background: d.bg, border: `1px solid ${d.bd}`, padding: '1px 7px', borderRadius: 20 }}>{q.difficulty}</span>
                            <span style={{ fontSize: '0.62rem', color: '#8b9cf4', background: 'rgba(102,126,234,0.08)', padding: '1px 7px', borderRadius: 20 }}>+{q.xp_reward} XP</span>
                          </div>
                        </button>
                      );
                    })}

                    {qTab === 'mcq' && questions.mcq.map((q, i) => {
                      const sv = solved.has(q.id);
                      return (
                        <button key={q.id} onClick={() => openQ(q, 'mcq')}
                          style={{ textAlign: 'left', padding: '1rem 1.1rem', borderRadius: 12, border: `1px solid ${sv ? 'rgba(34,197,94,0.3)' : border}`, background: sv ? 'rgba(34,197,94,0.04)' : surface, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.62rem', color: '#f59e0b', fontWeight: 700 }}>MCQ {String(i+1).padStart(2,'0')}</span>
                            {sv && <span style={{ fontSize: '0.65rem', color: '#22c55e', fontWeight: 800 }}>✓ Correct</span>}
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: textSec, lineHeight: 1.5 }}>{q.question.length > 100 ? q.question.slice(0,100)+'…' : q.question}</div>
                        </button>
                      );
                    })}

                    {qTab === 'theory' && questions.theory.map((q, i) => (
                      <button key={q.id} onClick={() => openQ(q, 'theory')}
                        style={{ textAlign: 'left', padding: '1rem 1.1rem', borderRadius: 12, border: `1px solid ${border}`, background: surface, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.62rem', color: '#22c55e', fontWeight: 700 }}>THEORY {String(i+1).padStart(2,'0')}</span>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: textSec, lineHeight: 1.5 }}>{q.question.length > 100 ? q.question.slice(0,100)+'…' : q.question}</div>
                      </button>
                    ))}

                    {qTab === 'coding' && !questions.coding.length && !qLoading && <EmptyQ icon="💻" msg="No coding questions yet." />}
                    {qTab === 'mcq'    && !questions.mcq.length    && !qLoading && <EmptyQ icon="🧠" msg="No MCQ questions yet." />}
                    {qTab === 'theory' && !questions.theory.length && !qLoading && <EmptyQ icon="📖" msg="No theory questions yet." />}
                  </div>
              }
            </div>
          </div>
        )}

        {/* ── SOLVER (visible when question selected) ── */}
        {selQ && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Breadcrumb */}
            <div style={{ padding: '0.5rem 1rem', borderBottom: `1px solid ${border}`, background: surface, display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
              <button onClick={() => setSelQ(null)}
                style={{ padding: '0.25rem 0.75rem', background: 'transparent', color: textSec, border: `1px solid ${border}`, borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                ← Back
              </button>
              <span style={{ fontSize: '0.7rem', color: textMut }}>|</span>
              <span style={{ fontSize: '0.72rem', color: textSec }}>{selTopic?.topic}</span>
              <span style={{ fontSize: '0.7rem', color: textMut }}>›</span>
              <span style={{ fontSize: '0.72rem', color: textPri, fontWeight: 600 }}>{selQ.title || selQ.question?.slice(0,50)}</span>
              {isSolved(selQ) && (
                <span style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', padding: '0.15rem 0.65rem', borderRadius: 20 }}>
                  ✓ Solved
                </span>
              )}
            </div>

            {/* ════ CODING SOLVER ════ */}
            {selQType === 'coding' && (
              <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

                {/* Problem panel */}
                <div style={{ width: 420, borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: surface, flexShrink: 0 }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                      <DiffBadge d={selQ.difficulty} />
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8b9cf4', background: 'rgba(102,126,234,0.1)', border: '1px solid rgba(102,126,234,0.2)', padding: '1px 8px', borderRadius: 20 }}>+{selQ.xp_reward} XP</span>
                    </div>
                    <h3 style={{ margin: 0, color: textPri, fontSize: '1rem', fontWeight: 800, lineHeight: 1.4 }}>{selQ.title}</h3>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
                    <div style={{ color: textSec, fontSize: '0.875rem', lineHeight: 1.9, whiteSpace: 'pre-wrap', marginBottom: '1.25rem' }}>{selQ.problem}</div>
                    {(selQ.test_cases||[]).filter(tc=>!tc.is_hidden).map((tc, i) => (
                      <div key={i} style={{ marginBottom: '0.65rem', background: surfAlt, border: `1px solid ${border}`, borderRadius: 10, padding: '0.875rem', fontSize: '0.8rem' }}>
                        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>Example {i+1}</div>
                        {tc.input && <div style={{ marginBottom: '0.35rem' }}><span style={{ color: textMut, fontWeight: 600 }}>Input: </span><code style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', padding: '2px 7px', borderRadius: 4, fontFamily: '"Fira Code",monospace', fontSize: '0.85em', color: textPri }}>{tc.input.replace(/\n/g,' ↵ ')}</code></div>}
                        <div><span style={{ color: textMut, fontWeight: 600 }}>Output: </span><code style={{ background: 'rgba(34,197,94,0.08)', padding: '2px 7px', borderRadius: 4, fontFamily: '"Fira Code",monospace', fontSize: '0.85em', color: '#22c55e' }}>{tc.expected_output}</code></div>
                      </div>
                    ))}
                    {selQ.hint && !isSolved(selQ) && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <button onClick={() => setShowHint(h=>!h)} style={{ padding: '0.3rem 0.75rem', background: 'rgba(245,158,11,0.07)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>
                          💡 {showHint ? 'Hide Hint' : 'Show Hint'}
                        </button>
                        {showHint && <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 9, color: textSec, fontSize: '0.83rem', lineHeight: 1.7 }}>{selQ.hint}</div>}
                      </div>
                    )}
                    {(attempts >= 3 || isSolved(selQ)) && selQ.solution && (
                      <div>
                        <button onClick={() => setShowSol(s=>!s)} style={{ padding: '0.3rem 0.75rem', background: 'rgba(102,126,234,0.07)', color: accent, border: `1px solid rgba(102,126,234,0.2)`, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>
                          🔓 {showSol ? 'Hide Solution' : 'View Solution'}
                        </button>
                        {showSol && <pre style={{ marginTop: '0.5rem', background: isDark ? '#0a0d14' : '#1e1e1e', color: '#e2e8f0', padding: '0.875rem', borderRadius: 10, fontFamily: '"Fira Code",monospace', fontSize: '0.8rem', overflowX: 'auto', border: `1px solid ${border}`, lineHeight: 1.7 }}>{selQ.solution}</pre>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Editor + output */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

                  {/* Solved banner */}
                  {isSolved(selQ) && (
                    <div style={{ padding: '0.45rem 1rem', background: 'rgba(34,197,94,0.07)', borderBottom: '1px solid rgba(34,197,94,0.18)', fontSize: '0.72rem', color: '#22c55e', fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      🔒 You've already solved this question — code is locked. View the solution in the left panel.
                    </div>
                  )}

                  {/* Toolbar */}
                  <div style={{ padding: '0.5rem 1rem', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: surface, flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{selQ.language || selLang}</span>
                      {attempts > 0 && !isSolved(selQ) && <span style={{ fontSize: '0.65rem', color: textMut }}>{attempts} attempt{attempts>1?'s':''}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        onClick={() => setCode(selQ.starter_code || DEFAULT_CODE[selQ.language?.toLowerCase()] || DEFAULT_CODE.python)}
                        disabled={isSolved(selQ)}
                        style={{ padding: '0.3rem 0.75rem', background: 'transparent', color: isSolved(selQ) ? textMut : textSec, border: `1px solid ${border}`, borderRadius: 6, cursor: isSolved(selQ) ? 'not-allowed' : 'pointer', fontSize: '0.72rem', fontWeight: 600, opacity: isSolved(selQ) ? 0.4 : 1 }}>
                        ↺ Reset
                      </button>
                      <button
                        onClick={() => { setBottomTab('output'); runCustom(); }}
                        disabled={customRunning || isSolved(selQ)}
                        style={{ padding: '0.3rem 0.9rem', background: (customRunning || isSolved(selQ)) ? border : '#22c55e', color: (customRunning || isSolved(selQ)) ? textMut : 'white', border: 'none', borderRadius: 6, cursor: (customRunning || isSolved(selQ)) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.72rem', opacity: isSolved(selQ) ? 0.4 : 1 }}>
                        {customRunning ? '⏳' : '▶ Run'}
                      </button>
                      <button
                        onClick={submit}
                        disabled={running || isSolved(selQ)}
                        style={{ padding: '0.3rem 1rem', background: (running || isSolved(selQ)) ? border : `linear-gradient(135deg,${accent},#764ba2)`, color: (running || isSolved(selQ)) ? textMut : 'white', border: 'none', borderRadius: 6, cursor: (running || isSolved(selQ)) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.72rem', opacity: isSolved(selQ) ? 0.4 : 1 }}>
                        {running ? '⏳ Judging…' : '✔ Submit'}
                      </button>
                    </div>
                  </div>

                  {/* Monaco */}
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <Editor
                      height="100%"
                      language={LANG_MAP[selQ.language?.toLowerCase()||'python']?.monacoLang||'python'}
                      value={code}
                      onChange={v => !isSolved(selQ) && setCode(v||'')}
                      theme={isDark ? 'vs-dark' : 'light'}
                      options={{
                        fontSize: 14,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        lineNumbers: 'on',
                        wordWrap: 'on',
                        automaticLayout: true,
                        fontFamily: '"Fira Code",monospace',
                        padding: { top: 12 },
                        readOnly: isSolved(selQ),
                      }}
                    />
                  </div>

                  {/* Bottom panel */}
                  <div style={{ height: 220, borderTop: `1px solid ${border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, background: surface }}>
                    <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, background: surfAlt, flexShrink: 0 }}>
                      {[['output','▶ Output'],['results','✔ Test Results'],['hint','💡 Hint']].map(([t,lbl]) => (
                        <button key={t} onClick={() => setBottomTab(t)}
                          style={{ padding: '0.4rem 1rem', border: 'none', background: 'transparent', color: bottomTab===t ? accent : textMut, fontSize: '0.72rem', fontWeight: bottomTab===t ? 700 : 400, cursor: 'pointer', borderBottom: `2px solid ${bottomTab===t ? accent : 'transparent'}`, transition: 'all 0.12s' }}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden', padding: '0.75rem 1rem' }}>

                      {bottomTab === 'output' && (
                        <div style={{ display: 'flex', gap: '0.75rem', height: '100%' }}>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Input (stdin)</div>
                            <textarea value={customIn} onChange={e => setCustomIn(e.target.value)} placeholder="e.g. Ravi" disabled={isSolved(selQ)}
                              style={{ flex: 1, background: surfAlt, border: `1px solid ${border}`, borderRadius: 6, padding: '0.4rem 0.65rem', color: textPri, fontFamily: '"Fira Code",monospace', fontSize: '0.8rem', resize: 'none', outline: 'none', lineHeight: 1.6, opacity: isSolved(selQ) ? 0.5 : 1 }} />
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Output</div>
                            <div style={{ flex: 1, background: isDark ? '#0a0d14' : '#1e1e1e', border: `1px solid ${border}`, borderRadius: 6, padding: '0.4rem 0.65rem', fontFamily: '"Fira Code",monospace', fontSize: '0.82rem', color: customOut ? '#e2e8f0' : '#4a5568', lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowY: 'auto' }}>
                              {customRunning ? '⏳ Running…' : customOut || 'Output appears here after ▶ Run'}
                            </div>
                          </div>
                        </div>
                      )}

                      {bottomTab === 'results' && (
                        <div style={{ height: '100%', overflowY: 'auto' }}>
                          {submitStatus && (
                            <div style={{ marginBottom: '0.6rem', padding: '0.5rem 0.875rem', borderRadius: 8, background: submitStatus==='pass' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.07)', color: submitStatus==='pass' ? '#22c55e' : '#ef4444', fontWeight: 700, fontSize: '0.82rem', border: `1px solid ${submitStatus==='pass' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)'}` }}>
                              {submitStatus==='pass' ? `🎉 All tests passed! +${selQ.xp_reward||10} XP earned` : '❌ Some tests failed. Review your logic.'}
                            </div>
                          )}
                          {isSolved(selQ) && !submitStatus && (
                            <div style={{ padding: '0.5rem 0.875rem', borderRadius: 8, background: 'rgba(34,197,94,0.08)', color: '#22c55e', fontWeight: 700, fontSize: '0.82rem', border: '1px solid rgba(34,197,94,0.2)', marginBottom: '0.6rem' }}>
                              🎉 Previously solved! All tests passed.
                            </div>
                          )}
                          {testResults.length > 0
                            ? <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                {testResults.map((r, i) => (
                                  <div key={i} style={{ display: 'flex', gap: '0.6rem', padding: '0.4rem 0.75rem', borderRadius: 7, background: r.passed ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${r.passed ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)'}`, fontSize: '0.72rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700, color: r.passed ? '#22c55e' : '#ef4444', minWidth: 70 }}>{r.passed ? '✓ Pass' : '✗ Fail'}{r.is_hidden ? ' (hidden)' : ` #${i+1}`}</span>
                                    {!r.is_hidden && !r.passed && (
                                      <>
                                        {r.input && <span style={{ color: textMut }}>in: <code style={{ color: textSec, fontFamily: '"Fira Code",mono' }}>{r.input.substring(0,30)}</code></span>}
                                        <span style={{ color: textMut }}>exp: <code style={{ color: '#22c55e', fontFamily: '"Fira Code",mono' }}>{r.expected_output.substring(0,30)}</code></span>
                                        <span style={{ color: textMut }}>got: <code style={{ color: '#ef4444', fontFamily: '"Fira Code",mono' }}>{(r.actual||r.stderr||'').substring(0,30)}</code></span>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            : !isSolved(selQ) && <div style={{ color: textMut, fontSize: '0.78rem', textAlign: 'center', paddingTop: '1rem' }}>Click <strong style={{ color: textSec }}>✔ Submit</strong> to run all test cases</div>
                          }
                        </div>
                      )}

                      {bottomTab === 'hint' && (
                        selQ.hint
                          ? <div style={{ padding: '0.75rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 9, color: textSec, fontSize: '0.83rem', lineHeight: 1.75 }}>💡 {selQ.hint}</div>
                          : <div style={{ color: textMut, fontSize: '0.78rem', textAlign: 'center', paddingTop: '1rem' }}>No hint for this question.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════ MCQ PANEL ════ */}
            {selQType === 'mcq' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 3rem' }}>
                <div style={{ maxWidth: 680, margin: '0 auto' }}>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1.5px solid rgba(245,158,11,0.25)', padding: '0.2rem 0.75rem', borderRadius: 20, letterSpacing: '0.06em' }}>MCQ</span>
                    {isSolved(selQ) && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', padding: '0.2rem 0.75rem', borderRadius: 20 }}>✓ Already Answered</span>}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: textPri, lineHeight: 1.75, padding: '1.25rem 1.5rem', background: surface, borderRadius: 14, border: `1px solid ${border}`, marginBottom: '1.5rem' }}>
                    {selQ.question}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1.25rem' }}>
                    {(selQ.options || []).map((opt, i) => {
                      const pick    = mcqPick === i;
                      const correct = i === selQ.answer;
                      let bc = border, bg2 = surface, tc = textSec;
                      if (mcqDone) {
                        if (correct)       { bc = '#22c55e'; bg2 = 'rgba(34,197,94,0.07)';  tc = '#22c55e'; }
                        else if (pick)     { bc = '#ef4444'; bg2 = 'rgba(239,68,68,0.07)';  tc = '#ef4444'; }
                      } else if (pick)     { bc = accent;    bg2 = `${accent}0f`;            tc = accent;    }
                      return (
                        <button key={i} onClick={() => !mcqDone && !isSolved(selQ) && setMcqPick(i)}
                          style={{ width: '100%', textAlign: 'left', padding: '0.875rem 1.25rem', background: bg2, border: `2px solid ${bc}`, borderRadius: 12, cursor: (mcqDone || isSolved(selQ)) ? 'default' : 'pointer', color: tc, fontSize: '0.9rem', fontWeight: pick||(mcqDone&&correct) ? 600 : 400, lineHeight: 1.5, transition: 'all 0.15s', display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
                          <span style={{ width: 26, height: 26, borderRadius: '50%', border: `1.5px solid ${bc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>
                            {mcqDone && correct ? '✓' : mcqDone && pick && !correct ? '✗' : ['A','B','C','D'][i]}
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {!mcqDone
                    ? <button onClick={submitMcq} disabled={mcqPick === null}
                        style={{ padding: '0.65rem 2rem', background: mcqPick === null ? border : `linear-gradient(135deg,${accent},#764ba2)`, color: mcqPick === null ? textMut : 'white', border: 'none', borderRadius: 10, cursor: mcqPick === null ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '0.9rem' }}>
                        Submit Answer
                      </button>
                    : <div style={{ padding: '1.25rem 1.5rem', background: mcqPick===selQ.answer ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.06)', border: `1.5px solid ${mcqPick===selQ.answer ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 14 }}>
                        <div style={{ fontWeight: 800, marginBottom: '0.6rem', color: mcqPick===selQ.answer ? '#22c55e' : '#ef4444' }}>
                          {mcqPick===selQ.answer ? '🎉 Correct!' : '❌ Incorrect — but this was the right answer.'}
                        </div>
                        <div style={{ color: textSec, fontSize: '0.875rem', lineHeight: 1.8 }}>{selQ.explanation}</div>
                      </div>
                  }
                </div>
              </div>
            )}

            {/* ════ THEORY PANEL ════ */}
            {selQType === 'theory' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 3rem' }}>
                <div style={{ maxWidth: 720, margin: '0 auto' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1.5px solid rgba(34,197,94,0.25)', padding: '0.2rem 0.75rem', borderRadius: 20, letterSpacing: '0.06em', display: 'inline-block', marginBottom: '1.5rem' }}>THEORY</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: textPri, lineHeight: 1.65, marginBottom: '2rem' }}>{selQ.question}</div>
                  <div style={{ padding: '1.5rem', background: surface, border: `1px solid ${border}`, borderRadius: 16, borderLeft: '4px solid #22c55e' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#22c55e', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.65rem' }}>Answer</div>
                    <div style={{ color: textSec, fontSize: '0.925rem', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{selQ.answer}</div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </div>{/* end MAIN AREA */}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${isDark ? '#30363d' : '#d0d7de'}; border-radius: 3px; }
        button { font-family: "Inter", sans-serif; }
      `}</style>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function DiffBadge({ d }) {
  const c = DIFF[d] || DIFF.EASY;
  return (
    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: c.fg, background: c.bg, border: `1.5px solid ${c.bd}`, padding: '1px 8px', borderRadius: 20, letterSpacing: '0.04em' }}>{d}</span>
  );
}

function EmptyQ({ icon, msg }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.6rem', opacity: 0.35 }}>{icon}</div>
      <div style={{ fontSize: '0.78rem' }}>{msg}</div>
    </div>
  );
}
