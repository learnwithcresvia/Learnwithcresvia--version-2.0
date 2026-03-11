// src/pages/QuestionBank.jsx
// Browse Python (+ future languages) question bank by topic
// Supports: Coding (Monaco + Piston runner), MCQ, Theory
// Route: /question-bank  (add to App.jsx)

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../utils/supabaseClient';
import Editor from '@monaco-editor/react';

// ── Constants ───────────────────────────────────────────────────────────────
const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';

const LANG_MAP = {
  python:     { pistonLang: 'python',     pistonVer: '3.10.0',  monacoLang: 'python'     },
  java:       { pistonLang: 'java',       pistonVer: '15.0.2',  monacoLang: 'java'       },
  c:          { pistonLang: 'c',          pistonVer: '10.2.0',  monacoLang: 'c'          },
  cpp:        { pistonLang: 'c++',        pistonVer: '10.2.0',  monacoLang: 'cpp'        },
  javascript: { pistonLang: 'javascript', pistonVer: '18.15.0', monacoLang: 'javascript' },
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
  const res = await fetch(PISTON_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: l.pistonLang, version: l.pistonVer, files: [{ content: code }], stdin }),
  });
  const d = await res.json();
  return { stdout: d.run?.stdout || '', stderr: d.run?.stderr || '' };
}

const norm = s => String(s || '').trim().replace(/\r\n/g, '\n');

const DEFAULT_CODE = {
  python:     '# Write your solution here\n',
  java:       'import java.util.Scanner;\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n    }\n}\n',
  c:          '#include <stdio.h>\nint main() {\n    // Write your solution here\n    return 0;\n}\n',
  cpp:        '#include <iostream>\nusing namespace std;\nint main() {\n    // Write your solution here\n    return 0;\n}\n',
  javascript: '// Write your solution here\n',
};

// ── Main Page ───────────────────────────────────────────────────────────────
export default function QuestionBank() {
  const { user }   = useAuth();
  const { isDark } = useTheme();

  // Data state
  const [languages,     setLanguages]     = useState([]);
  const [topics,        setTopics]        = useState([]);
  const [questions,     setQuestions]     = useState({ coding: [], mcq: [], theory: [] });
  const [solved,        setSolved]        = useState(new Set());

  // Loading flags
  const [loading,       setLoading]       = useState(true);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [qLoading,      setQLoading]      = useState(false);

  // Navigation
  const [selLang,       setSelLang]       = useState('Python');
  const [selTopic,      setSelTopic]      = useState(null);
  const [qTab,          setQTab]          = useState('coding');
  const [selQ,          setSelQ]          = useState(null);
  const [selQType,      setSelQType]      = useState('coding');

  // Coding solver
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
  const [bottomTab,     setBottomTab]     = useState('results');

  // MCQ
  const [mcqPick,       setMcqPick]       = useState(null);
  const [mcqDone,       setMcqDone]       = useState(false);

  // ── Load available languages ─────────────────────────────────────────────
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

  // ── Load topics when language changes ────────────────────────────────────
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

  // ── Load questions when topic changes ────────────────────────────────────
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

  // ── Load solved questions ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from('qb_attempts').select('question_id').eq('user_id', user.id).eq('passed', true)
      .then(({ data }) => setSolved(new Set((data || []).map(d => d.question_id))))
      .catch(() => {});
  }, [user]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function openQ(q, type) {
    setSelQ(q); setSelQType(type);
    setTestResults([]); setSubmitStatus(null);
    setShowHint(false); setShowSol(false); setAttempts(0);
    setMcqPick(null); setMcqDone(false);
    setCustomIn(''); setCustomOut(''); setBottomTab('results');
    if (type === 'coding') setCode(q.starter_code || DEFAULT_CODE[q.language?.toLowerCase()] || DEFAULT_CODE.python);
  }

  async function submit() {
    if (!selQ || running) return;
    setRunning(true); setTestResults([]); setSubmitStatus(null);
    const tcs     = selQ.test_cases || [];
    const results = [];
    for (const tc of tcs) {
      const { stdout, stderr } = await runCode(code, selQ.language || selLang.toLowerCase(), tc.input || '');
      const actual = norm(stdout), expected = norm(tc.expected_output);
      results.push({ ...tc, actual, passed: actual === expected, stderr });
    }
    setTestResults(results);
    setRunning(false);
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
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
    if (mcqPick === null) return;
    setMcqDone(true);
    if (mcqPick === selQ.answer && user) {
      setSolved(s => new Set([...s, selQ.id]));
      supabase.from('qb_attempts').upsert(
        { user_id: user.id, question_id: selQ.id, passed: true, language: selLang },
        { onConflict: 'user_id,question_id' }
      ).catch(() => {});
    }
  }

  // ── Theme tokens ─────────────────────────────────────────────────────────
  const bg      = isDark ? '#0f1117' : '#f1f5f9';
  const surface = isDark ? '#141720' : '#ffffff';
  const border  = isDark ? '#1e2433' : '#e2e8f0';
  const textPri = isDark ? '#e2e8f0' : '#0f172a';
  const textSec = isDark ? '#94a3b8' : '#475569';
  const textMut = isDark ? '#4a5568' : '#94a3b8';
  const surfAlt = isDark ? 'rgba(255,255,255,0.025)' : '#f8fafc';
  const accent  = '#667eea';

  const topicSolved = selTopic
    ? [...questions.coding, ...questions.mcq].filter(q => solved.has(q.id)).length
    : 0;
  const topicTotal = questions.coding.length + questions.mcq.length;

  // ── Render ───────────────────────────────────────────────────────────────
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

      {/* ════ SIDEBAR: Languages + Topics ════ */}
      <div style={{ width: 244, background: surface, borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

        {/* Title */}
        <div style={{ padding: '1rem 1rem 0.875rem', borderBottom: `1px solid ${border}` }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: textMut, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Practice Hub</div>
          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: textPri, letterSpacing: '-0.02em' }}>Question Bank</div>
        </div>

        {/* Language tabs */}
        <div style={{ padding: '0.75rem', borderBottom: `1px solid ${border}` }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Language</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {languages.map(lang => {
              const m   = LANG_META[lang] || { color: accent, bg: `${accent}18`, icon: '💻' };
              const act = lang === selLang;
              return (
                <button key={lang} onClick={() => setSelLang(lang)} style={{ padding: '0.28rem 0.65rem', borderRadius: 7, border: `1.5px solid ${act ? m.color : border}`, background: act ? m.bg : 'transparent', color: act ? m.color : textMut, fontWeight: act ? 700 : 400, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', gap: '0.3rem', alignItems: 'center', transition: 'all 0.15s' }}>
                  <span>{m.icon}</span>{lang}
                </button>
              );
            })}
          </div>
        </div>

        {/* Topics */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.4rem' }}>
          {topicsLoading
            ? <div style={{ padding: '2rem', textAlign: 'center', color: textMut, fontSize: '0.78rem' }}>Loading…</div>
            : topics.map((t, i) => {
                const act = selTopic?.id === t.id;
                return (
                  <button key={t.id} onClick={() => setSelTopic(t)}
                    style={{ width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: 9, marginBottom: '0.2rem', border: `1px solid ${act ? `${accent}40` : 'transparent'}`, background: act ? `${accent}0d` : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.12s' }}>
                    <span style={{ fontSize: '0.62rem', color: textMut, minWidth: 18, fontVariantNumeric: 'tabular-nums' }}>{String(i+1).padStart(2,'0')}</span>
                    <span style={{ flex: 1, fontSize: '0.8rem', color: act ? textPri : textSec, fontWeight: act ? 700 : 400, lineHeight: 1.3 }}>{t.topic}</span>
                    {act && <span style={{ width: 5, height: 5, borderRadius: '50%', background: accent, flexShrink: 0 }} />}
                  </button>
                );
              })
          }
        </div>

        {/* Bottom: solved counter */}
        <div style={{ padding: '0.75rem 1rem', borderTop: `1px solid ${border}` }}>
          <div style={{ fontSize: '0.65rem', color: textMut, marginBottom: '0.2rem' }}>Total Solved</div>
          <div style={{ fontWeight: 800, fontSize: '1.25rem', color: textPri }}>{solved.size}</div>
        </div>
      </div>

      {/* ════ QUESTION LIST ════ */}
      <div style={{ width: 310, borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', background: surfAlt, flexShrink: 0 }}>

        {/* Topic header */}
        <div style={{ padding: '0.875rem 0.875rem 0.75rem', borderBottom: `1px solid ${border}` }}>
          {selTopic ? (
            <>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: textPri, marginBottom: '0.5rem', lineHeight: 1.3 }}>{selTopic.topic}</div>
              {/* Type filter pills */}
              <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.65rem' }}>
                {[
                  { key: 'coding',  label: `${questions.coding.length}  Coding`,  color: '#667eea' },
                  { key: 'mcq',     label: `${questions.mcq.length}  MCQ`,        color: '#f59e0b' },
                  { key: 'theory',  label: `${questions.theory.length}  Theory`,  color: '#22c55e' },
                ].map(({ key, label, color }) => (
                  <button key={key} onClick={() => setQTab(key)}
                    style={{ padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700, border: `1.5px solid ${qTab === key ? color : border}`, background: qTab === key ? `${color}18` : 'transparent', color: qTab === key ? color : textMut, cursor: 'pointer', transition: 'all 0.15s' }}>
                    {label}
                  </button>
                ))}
              </div>
              {/* Progress bar */}
              {topicTotal > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: textMut, marginBottom: '0.25rem' }}>
                    <span>Solved</span><span>{topicSolved}/{topicTotal}</span>
                  </div>
                  <div style={{ height: 3, background: border, borderRadius: 4 }}>
                    <div style={{ height: '100%', width: `${(topicSolved / topicTotal) * 100}%`, background: `linear-gradient(90deg,${accent},#764ba2)`, borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                </div>
              )}
            </>
          ) : <div style={{ color: textMut, fontSize: '0.82rem' }}>Select a topic →</div>}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.4rem' }}>
          {qLoading
            ? <div style={{ padding: '2rem', textAlign: 'center', color: textMut, fontSize: '0.78rem' }}>Loading…</div>
            : <>
                {/* ── CODING ── */}
                {qTab === 'coding' && questions.coding.map((q, i) => {
                  const d   = DIFF[q.difficulty] || DIFF.EASY;
                  const act = selQ?.id === q.id && selQType === 'coding';
                  const sv  = solved.has(q.id);
                  return (
                    <button key={q.id} onClick={() => openQ(q, 'coding')}
                      style={{ width: '100%', textAlign: 'left', padding: '0.7rem 0.75rem', borderRadius: 10, marginBottom: '0.25rem', border: `1px solid ${act ? `${accent}45` : border}`, background: act ? `${accent}0a` : surface, cursor: 'pointer', transition: 'all 0.12s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.3rem' }}>
                            <span style={{ fontSize: '0.6rem', color: textMut, fontVariantNumeric: 'tabular-nums' }}>{i+1}.</span>
                            {sv && <span style={{ fontSize: '0.6rem', color: '#22c55e', fontWeight: 800 }}>✓</span>}
                          </div>
                          <div style={{ fontSize: '0.81rem', color: textPri, fontWeight: act ? 700 : 500, lineHeight: 1.4, marginBottom: '0.4rem' }}>{q.title}</div>
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: d.fg, background: d.bg, border: `1px solid ${d.bd}`, padding: '1px 6px', borderRadius: 20 }}>{q.difficulty}</span>
                            <span style={{ fontSize: '0.62rem', color: '#8b9cf4', background: 'rgba(102,126,234,0.08)', border: 'none', padding: '1px 6px', borderRadius: 20 }}>+{q.xp_reward}XP</span>
                          </div>
                        </div>
                        {sv && <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1.5px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '0.5rem' }}><span style={{ color: '#22c55e', fontSize: '0.6rem' }}>✓</span></div>}
                      </div>
                    </button>
                  );
                })}

                {/* ── MCQ ── */}
                {qTab === 'mcq' && questions.mcq.map((q, i) => {
                  const act = selQ?.id === q.id && selQType === 'mcq';
                  const sv  = solved.has(q.id);
                  return (
                    <button key={q.id} onClick={() => openQ(q, 'mcq')}
                      style={{ width: '100%', textAlign: 'left', padding: '0.7rem 0.75rem', borderRadius: 10, marginBottom: '0.25rem', border: `1px solid ${act ? 'rgba(245,158,11,0.35)' : border}`, background: act ? 'rgba(245,158,11,0.05)' : surface, cursor: 'pointer', transition: 'all 0.12s' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '0.62rem', color: '#f59e0b', fontWeight: 700, minWidth: 22 }}>Q{i+1}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.8rem', color: textPri, lineHeight: 1.45 }}>{q.question.length > 85 ? q.question.slice(0,85)+'…' : q.question}</div>
                          {sv && <div style={{ fontSize: '0.6rem', color: '#22c55e', marginTop: '0.3rem', fontWeight: 700 }}>✓ Correct</div>}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* ── THEORY ── */}
                {qTab === 'theory' && questions.theory.map((q, i) => {
                  const act = selQ?.id === q.id && selQType === 'theory';
                  return (
                    <button key={q.id} onClick={() => openQ(q, 'theory')}
                      style={{ width: '100%', textAlign: 'left', padding: '0.7rem 0.75rem', borderRadius: 10, marginBottom: '0.25rem', border: `1px solid ${act ? 'rgba(34,197,94,0.3)' : border}`, background: act ? 'rgba(34,197,94,0.05)' : surface, cursor: 'pointer', transition: 'all 0.12s' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '0.62rem', color: '#22c55e', fontWeight: 700, minWidth: 22 }}>T{i+1}</span>
                        <div style={{ fontSize: '0.8rem', color: textPri, lineHeight: 1.45 }}>{q.question.length > 90 ? q.question.slice(0,90)+'…' : q.question}</div>
                      </div>
                    </button>
                  );
                })}

                {/* Empty states */}
                {qTab === 'coding' && !questions.coding.length && !qLoading && <EmptyQ icon="💻" msg="No coding questions yet." />}
                {qTab === 'mcq'    && !questions.mcq.length    && !qLoading && <EmptyQ icon="🧠" msg="No MCQ questions yet." />}
                {qTab === 'theory' && !questions.theory.length && !qLoading && <EmptyQ icon="📖" msg="No theory questions yet." />}
              </>
          }
        </div>
      </div>

      {/* ════ SOLVER PANEL ════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* ── Nothing selected ── */}
        {!selQ && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.25rem', padding: '2rem' }}>
            <div style={{ fontSize: '3.5rem', opacity: 0.3 }}>🎯</div>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', color: textPri, textAlign: 'center' }}>Select a question to practice</div>
            <div style={{ color: textMut, fontSize: '0.875rem', textAlign: 'center', maxWidth: 380, lineHeight: 1.75 }}>
              Pick a topic from the left, then select any coding challenge, MCQ, or theory question to begin.
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
              {[['💻','Coding','Write & run code','#667eea'], ['🧠','MCQ','4-choice quiz','#f59e0b'], ['📖','Theory','Concept Q&A','#22c55e']].map(([icon,lbl,desc,clr]) => (
                <div key={lbl} style={{ padding: '1.25rem 1.5rem', background: surface, borderRadius: 14, border: `1px solid ${border}`, textAlign: 'center', minWidth: 110 }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
                  <div style={{ fontWeight: 700, color: textPri, fontSize: '0.82rem', marginBottom: '0.2rem' }}>{lbl}</div>
                  <div style={{ fontSize: '0.68rem', color: textMut }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ CODING SOLVER ════ */}
        {selQ && selQType === 'coding' && (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '350px 1fr', minHeight: 0, overflow: 'hidden' }}>

            {/* Problem panel */}
            <div style={{ borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: surface }}>
              {/* Header */}
              <div style={{ padding: '0.875rem 1rem', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                  <DiffBadge d={selQ.difficulty} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8b9cf4', background: 'rgba(102,126,234,0.1)', border: '1px solid rgba(102,126,234,0.2)', padding: '1px 8px', borderRadius: 20 }}>+{selQ.xp_reward} XP</span>
                  {solved.has(selQ.id) && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', padding: '1px 8px', borderRadius: 20 }}>✓ Solved</span>}
                </div>
                <h3 style={{ margin: 0, color: textPri, fontSize: '0.975rem', fontWeight: 800, lineHeight: 1.4 }}>{selQ.title}</h3>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                <div style={{ color: textSec, fontSize: '0.875rem', lineHeight: 1.85, whiteSpace: 'pre-wrap', marginBottom: '1.25rem' }}>{selQ.problem}</div>

                {/* Visible test cases */}
                {(selQ.test_cases||[]).filter(tc=>!tc.is_hidden).map((tc, i) => (
                  <div key={i} style={{ marginBottom: '0.65rem', background: surfAlt, border: `1px solid ${border}`, borderRadius: 10, padding: '0.75rem', fontSize: '0.78rem' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem' }}>Example {i+1}</div>
                    {tc.input && <div style={{ marginBottom: '0.3rem' }}><span style={{ color: textMut, fontWeight: 600 }}>Input: </span><code style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontFamily: '"Fira Code",mono', fontSize: '0.85em', color: textPri }}>{tc.input.replace(/\n/g,' ↵ ')}</code></div>}
                    <div><span style={{ color: textMut, fontWeight: 600 }}>Output: </span><code style={{ background: 'rgba(34,197,94,0.08)', padding: '2px 6px', borderRadius: 4, fontFamily: '"Fira Code",mono', fontSize: '0.85em', color: '#22c55e' }}>{tc.expected_output}</code></div>
                  </div>
                ))}

                {/* Hint toggle */}
                {selQ.hint && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <button onClick={() => setShowHint(h=>!h)} style={{ padding: '0.3rem 0.75rem', background: 'rgba(245,158,11,0.07)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>
                      💡 {showHint ? 'Hide Hint' : 'Show Hint'}
                    </button>
                    {showHint && <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 9, color: textSec, fontSize: '0.83rem', lineHeight: 1.7 }}>{selQ.hint}</div>}
                  </div>
                )}

                {/* Solution after 3 attempts */}
                {attempts >= 3 && selQ.solution && (
                  <div>
                    <button onClick={() => setShowSol(s=>!s)} style={{ padding: '0.3rem 0.75rem', background: 'rgba(239,68,68,0.07)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>
                      🔓 {showSol ? 'Hide Solution' : 'Reveal Solution'}
                    </button>
                    {showSol && <pre style={{ marginTop: '0.5rem', background: isDark ? '#0a0d14' : '#1e1e1e', color: '#e2e8f0', padding: '0.875rem', borderRadius: 10, fontFamily: '"Fira Code",mono', fontSize: '0.8rem', overflowX: 'auto', border: `1px solid ${border}`, lineHeight: 1.7 }}>{selQ.solution}</pre>}
                  </div>
                )}
              </div>
            </div>

            {/* Editor + output */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Toolbar */}
              <div style={{ padding: '0.45rem 0.875rem', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: surface, flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{selQ.language || selLang.toLowerCase()}</span>
                  {attempts > 0 && <span style={{ fontSize: '0.65rem', color: textMut }}>{attempts} attempt{attempts>1?'s':''}</span>}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button onClick={() => setCode(selQ.starter_code || DEFAULT_CODE[selQ.language?.toLowerCase()] || DEFAULT_CODE.python)}
                    style={{ padding: '0.28rem 0.65rem', background: 'transparent', color: textMut, border: `1px solid ${border}`, borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem' }}>
                    ↺ Reset
                  </button>
                  <button onClick={submit} disabled={running}
                    style={{ padding: '0.28rem 1.1rem', background: running ? border : `linear-gradient(135deg,${accent},#764ba2)`, color: running ? textMut : 'white', border: 'none', borderRadius: 6, cursor: running ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.75rem', transition: 'all 0.15s' }}>
                    {running ? '⏳ Running…' : '▶ Submit'}
                  </button>
                </div>
              </div>

              {/* Monaco */}
              <div style={{ flex: 1, minHeight: 0 }}>
                <Editor
                  height="100%"
                  language={LANG_MAP[selQ.language?.toLowerCase()||'python']?.monacoLang||'python'}
                  value={code}
                  onChange={v => setCode(v||'')}
                  theme={isDark ? 'vs-dark' : 'light'}
                  options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, lineNumbers: 'on', wordWrap: 'on', automaticLayout: true, fontFamily: '"Fira Code",monospace' }}
                />
              </div>

              {/* Bottom panel */}
              <div style={{ height: 200, borderTop: `1px solid ${border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, background: surface }}>
                <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, background: surfAlt, flexShrink: 0 }}>
                  {[['results','📋 Results'],['custom','⌨️ Custom'],['hint','💡 Hint']].map(([t,lbl]) => (
                    <button key={t} onClick={() => setBottomTab(t)}
                      style={{ padding: '0.38rem 0.875rem', border: 'none', background: 'transparent', color: bottomTab===t ? accent : textMut, fontSize: '0.72rem', fontWeight: bottomTab===t ? 700 : 400, cursor: 'pointer', borderBottom: `2px solid ${bottomTab===t ? accent : 'transparent'}`, transition: 'all 0.12s' }}>
                      {lbl}
                    </button>
                  ))}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '0.65rem 0.875rem' }}>

                  {/* Results */}
                  {bottomTab === 'results' && (
                    <>
                      {submitStatus && (
                        <div style={{ marginBottom: '0.6rem', padding: '0.5rem 0.75rem', borderRadius: 8, background: submitStatus==='pass' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.07)', color: submitStatus==='pass' ? '#22c55e' : '#ef4444', fontWeight: 700, fontSize: '0.82rem', border: `1px solid ${submitStatus==='pass' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)'}` }}>
                          {submitStatus==='pass' ? `🎉 All tests passed! +${selQ.xp_reward||10} XP earned` : '❌ Some tests failed. Review your logic.'}
                        </div>
                      )}
                      {testResults.length > 0
                        ? <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            {testResults.map((r, i) => (
                              <div key={i} style={{ display: 'flex', gap: '0.5rem', padding: '0.38rem 0.65rem', borderRadius: 6, background: r.passed ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${r.passed ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)'}`, fontSize: '0.72rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, color: r.passed ? '#22c55e' : '#ef4444', minWidth: 65 }}>{r.passed ? '✓ Pass' : '✗ Fail'}{r.is_hidden ? ' (hidden)' : ` #${i+1}`}</span>
                                {!r.is_hidden && !r.passed && (
                                  <>
                                    {r.input && <span style={{ color: textMut }}>in: <code style={{ color: textSec, fontFamily: '"Fira Code",mono' }}>{r.input.substring(0,25)}</code></span>}
                                    <span style={{ color: textMut }}>exp: <code style={{ color: '#22c55e', fontFamily: '"Fira Code",mono' }}>{r.expected_output.substring(0,25)}</code></span>
                                    <span style={{ color: textMut }}>got: <code style={{ color: '#ef4444', fontFamily: '"Fira Code",mono' }}>{(r.actual||r.stderr||'').substring(0,25)}</code></span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        : <div style={{ color: textMut, fontSize: '0.78rem', textAlign: 'center', paddingTop: '1.25rem' }}>Click <strong style={{ color: textSec }}>Submit</strong> to run against test cases</div>
                      }
                    </>
                  )}

                  {/* Custom input */}
                  {bottomTab === 'custom' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', height: '100%' }}>
                      <textarea value={customIn} onChange={e => setCustomIn(e.target.value)} placeholder="Custom stdin…"
                        style={{ flex: 1, background: surfAlt, border: `1px solid ${border}`, borderRadius: 6, padding: '0.4rem 0.65rem', color: textPri, fontFamily: '"Fira Code",mono', fontSize: '0.8rem', resize: 'none', outline: 'none', lineHeight: 1.6 }} />
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button onClick={runCustom} disabled={customRunning}
                          style={{ padding: '0.25rem 0.75rem', background: customRunning ? border : '#22c55e', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.72rem' }}>
                          {customRunning ? 'Running…' : '▶ Run'}
                        </button>
                        {customOut && <code style={{ fontSize: '0.75rem', color: textSec, fontFamily: '"Fira Code",mono', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customOut}</code>}
                      </div>
                    </div>
                  )}

                  {/* Hint */}
                  {bottomTab === 'hint' && (
                    selQ.hint
                      ? <div style={{ padding: '0.65rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 9, color: textSec, fontSize: '0.82rem', lineHeight: 1.75 }}>💡 {selQ.hint}</div>
                      : <div style={{ color: textMut, fontSize: '0.78rem', textAlign: 'center', paddingTop: '1.25rem' }}>No hint for this question.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ MCQ PANEL ════ */}
        {selQ && selQType === 'mcq' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 2.5rem' }}>
            <div style={{ maxWidth: 660, margin: '0 auto' }}>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1.5px solid rgba(245,158,11,0.25)', padding: '0.2rem 0.75rem', borderRadius: 20, letterSpacing: '0.06em' }}>MCQ</span>
                {solved.has(selQ.id) && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', padding: '0.2rem 0.75rem', borderRadius: 20 }}>✓ Answered</span>}
              </div>

              {/* Question box */}
              <div style={{ fontSize: '1rem', fontWeight: 700, color: textPri, lineHeight: 1.7, padding: '1.25rem 1.5rem', background: surface, borderRadius: 14, border: `1px solid ${border}`, marginBottom: '1.5rem' }}>
                {selQ.question}
              </div>

              {/* Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1.25rem' }}>
                {(selQ.options || []).map((opt, i) => {
                  const pick   = mcqPick === i;
                  const correct = i === selQ.answer;
                  let bc = border, bg2 = surface, tc = textSec;
                  if (mcqDone) {
                    if (correct)           { bc = '#22c55e'; bg2 = 'rgba(34,197,94,0.07)';  tc = '#22c55e'; }
                    else if (pick)         { bc = '#ef4444'; bg2 = 'rgba(239,68,68,0.07)';  tc = '#ef4444'; }
                  } else if (pick)         { bc = accent;    bg2 = `${accent}0f`;            tc = accent;    }

                  return (
                    <button key={i} onClick={() => !mcqDone && setMcqPick(i)}
                      style={{ width: '100%', textAlign: 'left', padding: '0.875rem 1.25rem', background: bg2, border: `2px solid ${bc}`, borderRadius: 12, cursor: mcqDone ? 'default' : 'pointer', color: tc, fontSize: '0.9rem', fontWeight: pick||(mcqDone&&correct) ? 600 : 400, lineHeight: 1.5, transition: 'all 0.15s', display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
                      <span style={{ width: 26, height: 26, borderRadius: '50%', border: `1.5px solid ${bc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0, color: tc }}>
                        {mcqDone && correct ? '✓' : mcqDone && pick && !correct ? '✗' : ['A','B','C','D'][i]}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>

              {/* Submit / Explanation */}
              {!mcqDone
                ? <button onClick={submitMcq} disabled={mcqPick === null}
                    style={{ padding: '0.65rem 2rem', background: mcqPick === null ? border : `linear-gradient(135deg,${accent},#764ba2)`, color: mcqPick === null ? textMut : 'white', border: 'none', borderRadius: 10, cursor: mcqPick === null ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '0.9rem', transition: 'all 0.2s' }}>
                    Submit Answer
                  </button>
                : <div style={{ padding: '1.25rem 1.5rem', background: mcqPick===selQ.answer ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.06)', border: `1.5px solid ${mcqPick===selQ.answer ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 14 }}>
                    <div style={{ fontWeight: 800, marginBottom: '0.6rem', fontSize: '0.9rem', color: mcqPick===selQ.answer ? '#22c55e' : '#ef4444' }}>
                      {mcqPick===selQ.answer ? '🎉 Correct!' : '❌ Incorrect'}
                    </div>
                    <div style={{ color: textSec, fontSize: '0.875rem', lineHeight: 1.8 }}>{selQ.explanation}</div>
                  </div>
              }
            </div>
          </div>
        )}

        {/* ════ THEORY PANEL ════ */}
        {selQ && selQType === 'theory' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 2.5rem' }}>
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1.5px solid rgba(34,197,94,0.25)', padding: '0.2rem 0.75rem', borderRadius: 20, letterSpacing: '0.06em' }}>THEORY</span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: textPri, lineHeight: 1.65, marginBottom: '2rem' }}>{selQ.question}</div>
              <div style={{ padding: '1.5rem', background: surface, border: `1px solid ${border}`, borderRadius: 16, borderLeft: '4px solid #22c55e' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#22c55e', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.65rem' }}>Answer</div>
                <div style={{ color: textSec, fontSize: '0.925rem', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{selQ.answer}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${isDark ? '#2d3748' : '#cbd5e0'}; border-radius: 3px; }
        button { font-family: "Inter", sans-serif; }
      `}</style>
    </div>
  );
}

// ── Mini helpers ─────────────────────────────────────────────────────────────
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


