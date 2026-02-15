// src/pages/QuestionCodingScreen.jsx
// Direct coding screen for a single question with RAG assistant

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabaseClient';
import ragService from '../services/ragService';

// Monaco Editor
let MonacoEditor = null;
try { MonacoEditor = require('@monaco-editor/react').default; } catch {}

const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';

async function runCode(language, code) {
  const langMap = { python: { language: 'python', version: '3.10.0' }, javascript: { language: 'javascript', version: '18.15.0' }, java: { language: 'java', version: '15.0.2' }, cpp: { language: 'c++', version: '10.2.0' } };
  const lang = langMap[language] || langMap.python;
  const res  = await fetch(PISTON_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: lang.language, version: lang.version, files: [{ content: code }] }),
  });
  const data = await res.json();
  return data.run?.stdout || data.run?.stderr || 'No output';
}

export default function QuestionCodingScreen() {
  const { questionId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [question,  setQuestion]  = useState(null);
  const [code,      setCode]      = useState('');
  const [output,    setOutput]    = useState('');
  const [running,   setRunning]   = useState(false);
  const [submitting,setSubmitting]= useState(false);
  const [result,    setResult]    = useState(null); // 'correct' | 'wrong'
  const [loading,   setLoading]   = useState(true);

  // RAG panel state
  const [ragOpen,     setRagOpen]     = useState(false);
  const [ragMessages, setRagMessages] = useState([]);
  const [ragInput,    setRagInput]    = useState('');
  const [ragLoading,  setRagLoading]  = useState(false);
  const [ragStarted,  setRagStarted]  = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    loadQuestion();
  }, [questionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ragMessages]);

  async function loadQuestion() {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (error || !data) { navigate('/practice-hub'); return; }
    setQuestion(data);
    setCode(data.starter_code || getDefaultCode(data.language || 'python'));
    setLoading(false);
  }

  function getDefaultCode(lang) {
    const defaults = {
      python:     '# Write your solution here\n\ndef solution():\n    pass\n',
      javascript: '// Write your solution here\n\nfunction solution() {\n  \n}\n',
      java:       'public class Solution {\n    public static void main(String[] args) {\n        // Write here\n    }\n}\n',
      cpp:        '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write here\n    return 0;\n}\n',
    };
    return defaults[lang] || defaults.python;
  }

  async function handleRun() {
    setRunning(true);
    setOutput('');
    try {
      const out = await runCode(question?.language || 'python', code);
      setOutput(out);
    } catch (e) {
      setOutput('Error: ' + e.message);
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmit() {
    if (!code.trim()) return;
    setSubmitting(true);

    try {
      const out = await runCode(question?.language || 'python', code);

      // Simple check: compare output to expected (first test case)
      const testCases  = question.test_cases || [];
      let   correct    = false;

      if (testCases.length > 0) {
        const expected = String(testCases[0].expected_output || '').trim();
        correct = out.trim() === expected;
      } else {
        correct = !out.includes('Error') && !out.includes('Traceback');
      }

      setResult(correct ? 'correct' : 'wrong');
      setOutput(out);

      // Save attempt
      await supabase.from('practice_attempts').insert({
        user_id:       user.id,
        question_id:   question.id,
        code_submitted: code,
        is_correct:    correct,
        points_earned: correct ? (question.points || 10) : 0,
      });

      // Award XP if correct
      if (correct && profile) {
        await supabase
          .from('profiles')
          .update({ xp: (profile.xp || 0) + (question.points || 10) })
          .eq('id', user.id);
      }
    } catch (e) {
      setOutput('Execution error: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // RAG: Explain concept when user clicks "Explain This"
  async function handleExplainConcept() {
    if (ragStarted) return;
    setRagOpen(true);
    setRagLoading(true);
    setRagStarted(true);

    try {
      const userLevel = profile?.difficulty_preference || 'Beginner';
      const reply = await ragService.explainConcept(question, userLevel);
      setRagMessages([{ role: 'assistant', text: reply }]);
    } catch (e) {
      setRagMessages([{ role: 'assistant', text: 'Sorry, I could not load the explanation. Please check your API connection.' }]);
    } finally {
      setRagLoading(false);
    }
  }

  // RAG: Follow-up chat
  async function handleRagSend() {
    if (!ragInput.trim() || ragLoading) return;
    const msg = ragInput.trim();
    setRagInput('');
    setRagMessages(prev => [...prev, { role: 'user', text: msg }]);
    setRagLoading(true);

    try {
      const reply = await ragService.askFollowUp(msg);
      setRagMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (e) {
      setRagMessages(prev => [...prev, { role: 'assistant', text: 'Error: ' + e.message }]);
    } finally {
      setRagLoading(false);
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1a1a2e' }}>
      <div style={{ color: 'white', fontSize: '1.2rem' }}>Loading question...</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1a1a2e', fontFamily: 'Arial, sans-serif', overflow: 'hidden' }}>

      {/* ── LEFT: Question Panel ── */}
      <div style={{ width: ragOpen ? '25%' : '35%', background: '#16213e', color: 'white', overflowY: 'auto', transition: 'width 0.3s', flexShrink: 0 }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #2a2a4a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/practice-hub" style={{ color: '#667eea', textDecoration: 'none', fontSize: '0.85rem' }}>← Back</Link>
          <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 20, background: question.difficulty === 'EASY' ? '#166534' : question.difficulty === 'MEDIUM' ? '#854d0e' : '#7f1d1d', color: 'white' }}>
            {question.difficulty}
          </span>
        </div>

        <div style={{ padding: '1.25rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', color: '#E2E8F0' }}>{question.title}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {question.topic && <span style={{ background: '#2d3748', color: '#90CDF4', padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem' }}>{question.topic}</span>}
            <span style={{ background: '#2d3748', color: '#9AE6B4', padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem' }}>⭐ {question.points} XP</span>
          </div>

          <p style={{ color: '#CBD5E0', fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{question.description}</p>

          {/* Test cases preview */}
          {question.test_cases?.filter(t => !t.hidden).slice(0, 2).map((tc, i) => (
            <div key={i} style={{ background: '#2d3748', borderRadius: 8, padding: '0.75rem', marginTop: '0.75rem', fontSize: '0.82rem' }}>
              <div style={{ color: '#718096', marginBottom: '0.25rem' }}>Example {i + 1}:</div>
              <div style={{ color: '#90CDF4' }}>Input: <code style={{ color: '#F6E05E' }}>{JSON.stringify(tc.input)}</code></div>
              <div style={{ color: '#90CDF4' }}>Output: <code style={{ color: '#68D391' }}>{String(tc.expected_output)}</code></div>
            </div>
          ))}

          {/* RAG Button */}
          <button
            onClick={ragStarted ? () => setRagOpen(o => !o) : handleExplainConcept}
            style={{
              marginTop: '1.5rem', width: '100%', padding: '0.75rem',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white', border: 'none', borderRadius: 8,
              cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
            }}
          >
            {ragStarted ? (ragOpen ? '✕ Close AI Tutor' : '🤖 Open AI Tutor') : '🤖 Explain This Concept'}
          </button>
        </div>
      </div>

      {/* ── MIDDLE: Code Editor ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Toolbar */}
        <div style={{ background: '#0f3460', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #2a2a4a' }}>
          <span style={{ color: '#90CDF4', fontSize: '0.85rem', fontWeight: 600 }}>
            {question.language?.toUpperCase() || 'PYTHON'}
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={handleRun} disabled={running}
            style={{ padding: '0.4rem 1rem', background: running ? '#4a5568' : '#38a169', color: 'white', border: 'none', borderRadius: 6, cursor: running ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            {running ? '▶ Running...' : '▶ Run'}
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ padding: '0.4rem 1rem', background: submitting ? '#4a5568' : '#667eea', color: 'white', border: 'none', borderRadius: 6, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            {submitting ? 'Submitting...' : '✓ Submit'}
          </button>
        </div>

        {/* Editor */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {MonacoEditor ? (
            <MonacoEditor
              height="100%"
              language={question.language || 'python'}
              value={code}
              onChange={v => setCode(v || '')}
              theme="vs-dark"
              options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, wordWrap: 'on' }}
            />
          ) : (
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              style={{ width: '100%', height: '100%', background: '#1e1e1e', color: '#d4d4d4', border: 'none', padding: '1rem', fontFamily: 'monospace', fontSize: 14, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
            />
          )}
        </div>

        {/* Output */}
        <div style={{ height: 160, background: '#0d1117', borderTop: '1px solid #2a2a4a', padding: '0.75rem 1rem', overflowY: 'auto' }}>
          <div style={{ color: '#4a5568', fontSize: '0.75rem', marginBottom: '0.5rem', fontWeight: 600 }}>OUTPUT</div>
          {result === 'correct' && <div style={{ color: '#68D391', fontWeight: 700, marginBottom: '0.5rem' }}>✅ Correct! +{question.points} XP earned!</div>}
          {result === 'wrong'   && <div style={{ color: '#FC8181', fontWeight: 700, marginBottom: '0.5rem' }}>❌ Not quite right. Check your logic and try again.</div>}
          <pre style={{ color: output.includes('Error') || output.includes('Traceback') ? '#FC8181' : '#68D391', margin: 0, fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {output || 'Click Run to see output...'}
          </pre>
        </div>
      </div>

      {/* ── RIGHT: RAG Chat Panel ── */}
      {ragOpen && (
        <div style={{ width: '30%', background: '#1a1a2e', borderLeft: '1px solid #2a2a4a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {/* RAG Header */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #2a2a4a', background: '#16213e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🤖</span>
            <div>
              <div style={{ color: '#E2E8F0', fontWeight: 700, fontSize: '0.9rem' }}>AI Tutor</div>
              <div style={{ color: '#718096', fontSize: '0.72rem' }}>Explains concepts — no spoilers!</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {ragLoading && ragMessages.length === 0 && (
              <div style={{ color: '#718096', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>
                Thinking... 🧠
              </div>
            )}
            {ragMessages.map((msg, i) => (
              <div key={i} style={{
                background: msg.role === 'user' ? '#2d3748' : '#1e3a5f',
                color: '#E2E8F0', padding: '0.75rem', borderRadius: 10,
                fontSize: '0.85rem', lineHeight: 1.6,
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
                borderBottomRightRadius: msg.role === 'user' ? 2 : 10,
                borderBottomLeftRadius:  msg.role === 'user' ? 10 : 2,
              }}>
                {msg.text}
              </div>
            ))}
            {ragLoading && ragMessages.length > 0 && (
              <div style={{ color: '#718096', fontSize: '0.8rem', alignSelf: 'flex-start' }}>Thinking...</div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '0.75rem', borderTop: '1px solid #2a2a4a', display: 'flex', gap: '0.5rem' }}>
            <input
              value={ragInput}
              onChange={e => setRagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRagSend()}
              placeholder="Ask a question..."
              style={{
                flex: 1, background: '#2d3748', border: '1px solid #4a5568',
                color: 'white', borderRadius: 8, padding: '0.6rem 0.75rem',
                fontSize: '0.85rem', outline: 'none',
              }}
            />
            <button onClick={handleRagSend} disabled={ragLoading}
              style={{ padding: '0.6rem 0.9rem', background: '#667eea', color: 'white', border: 'none', borderRadius: 8, cursor: ragLoading ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
