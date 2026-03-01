// src/pages/SubjectPage.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../utils/supabaseClient';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function callGemini(prompt, maxTokens = 800, temp = 0.7) {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: temp } }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `Gemini ${res.status}`); }
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function getYouTubeId(url) {
  const m = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return m ? m[1] : null;
}

function getExpected(tc) {
  return String(tc?.expected_output ?? tc?.output ?? '').trim();
}

const STAFF_ROLES = ['ADMIN', 'DIRECTOR', 'HOD', 'STAFF', 'COORDINATOR'];

export default function SubjectPage() {
  const { subjectId } = useParams();
  const { user, profile } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [subject,    setSubject]    = useState(null);
  const [units,      setUnits]      = useState([]);
  const [materials,  setMaterials]  = useState({});
  const [progress,   setProgress]   = useState({});
  const [activeUnit, setActiveUnit] = useState(null);
  const [loading,    setLoading]    = useState(true);

  // AI panel
  const [aiMode,      setAiMode]      = useState(null);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [summary,     setSummary]     = useState('');
  const [quizMsgs,    setQuizMsgs]    = useState([]);
  const [quizInput,   setQuizInput]   = useState('');
  const [quizHistory, setQuizHistory] = useState([]);
  const [flashcards,  setFlashcards]  = useState([]);
  const [fcIndex,     setFcIndex]     = useState(0);
  const [fcFlipped,   setFcFlipped]   = useState(false);
  const [savedCards,  setSavedCards]  = useState([]);
  const quizEndRef = useRef(null);

  // Contribute modal
  const [showContribute, setShowContribute] = useState(false);
  const [contribForm,    setContribForm]    = useState({ title: '', type: 'pdf', url: '', content: '', description: '' });
  const [contributing,   setContributing]   = useState(false);
  const [contribMsg,     setContribMsg]     = useState('');

  const isStaff = STAFF_ROLES.includes(profile?.role);

  useEffect(() => { loadAll(); }, [subjectId]);
  useEffect(() => { quizEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [quizMsgs]);

  async function loadAll() {
    setLoading(true);
    const [{ data: subj }, { data: unitList }] = await Promise.all([
      supabase.from('subjects').select('*').eq('id', subjectId).single(),
      supabase.from('units').select('*').eq('subject_id', subjectId).order('unit_number'),
    ]);
    setSubject(subj);
    setUnits(unitList || []);
    if (unitList?.length) setActiveUnit(unitList[0].id);

    // Approved materials only
    const { data: mats } = await supabase
      .from('study_materials')
      .select('*')
      .eq('subject_id', subjectId)
      .order('created_at');
    const byUnit = {};
    for (const m of mats || []) (byUnit[m.unit_id] = byUnit[m.unit_id] || []).push(m);
    setMaterials(byUnit);

    // Progress
    const { data: prog } = await supabase
      .from('topic_progress')
      .select('unit_id, completed')
      .eq('user_id', user.id)
      .eq('subject_id', subjectId);
    const pm = {};
    for (const p of prog || []) pm[p.unit_id] = p.completed;
    setProgress(pm);

    // Saved flashcards
    const { data: fc } = await supabase.from('flashcards').select('*').eq('user_id', user.id).eq('subject_id', subjectId);
    setSavedCards(fc || []);

    setLoading(false);
  }

  async function toggleProgress(unitId) {
    const newVal = !(progress[unitId] || false);
    setProgress(p => ({ ...p, [unitId]: newVal }));
    const { data: existing } = await supabase.from('topic_progress').select('id').eq('user_id', user.id).eq('unit_id', unitId).single().catch(() => ({ data: null }));
    if (existing) {
      await supabase.from('topic_progress').update({ completed: newVal, completed_at: newVal ? new Date().toISOString() : null }).eq('id', existing.id);
    } else {
      await supabase.from('topic_progress').insert({ user_id: user.id, unit_id: unitId, subject_id: subjectId, completed: newVal, completed_at: newVal ? new Date().toISOString() : null });
    }
  }

  function getUnitContext(unitId) {
    const unit = units.find(u => u.id === unitId);
    const mats = materials[unitId] || [];
    const text  = mats.filter(m => m.content).map(m => m.content).join('\n').substring(0, 1500);
    const titles = mats.map(m => m.title).join(', ');
    return `Subject: ${subject?.name}\nUnit: ${unit?.title} (${unit?.description || ''})\nMaterials: ${titles}\n${text ? 'Content:\n' + text : ''}`;
  }

  // ── AI Summary ───────────────────────────────────────────────────────────────
  async function handleSummary() {
    if (summary) { setAiMode('summary'); return; }
    setAiMode('summary'); setAiLoading(true);
    try {
      const reply = await callGemini(`Give a clear exam-focused summary of this unit in 200-300 words with bold headings.\n\n${getUnitContext(activeUnit)}`);
      setSummary(reply);
    } catch (e) { setSummary('⚠️ ' + e.message); }
    finally { setAiLoading(false); }
  }

  // ── Quiz Bot ─────────────────────────────────────────────────────────────────
  async function startQuiz() {
    setAiMode('quiz');
    if (quizMsgs.length) return;
    setAiLoading(true);
    const welcome = await callGemini(`You are a quiz bot. ${getUnitContext(activeUnit)}\n\nGreet the student and ask your first question. After 5 questions give a score.`, 400).catch(() => "Hi! Let's test your knowledge. What is the main concept of this unit?");
    setQuizMsgs([{ role: 'assistant', text: welcome }]);
    setQuizHistory([{ role: 'assistant', content: welcome }]);
    setAiLoading(false);
  }

  async function sendQuizMessage() {
    if (!quizInput.trim() || aiLoading) return;
    const msg = quizInput.trim(); setQuizInput('');
    setQuizMsgs(p => [...p, { role: 'user', text: msg }]);
    setAiLoading(true);
    const hist = quizHistory.map(m => `${m.role === 'user' ? 'Student' : 'QuizBot'}: ${m.content}`).join('\n');
    try {
      const reply = await callGemini(`Quiz bot.\n${getUnitContext(activeUnit)}\n\n${hist}\nStudent: ${msg}\nQuizBot:`, 400);
      setQuizMsgs(p => [...p, { role: 'assistant', text: reply }]);
      setQuizHistory(p => [...p, { role: 'user', content: msg }, { role: 'assistant', content: reply }]);
    } catch (e) { setQuizMsgs(p => [...p, { role: 'assistant', text: '⚠️ ' + e.message }]); }
    finally { setAiLoading(false); }
  }

  // ── Flashcards ───────────────────────────────────────────────────────────────
  async function generateFlashcards() {
    setAiMode('flashcards');
    if (flashcards.length) return;
    setAiLoading(true);
    try {
      const raw    = await callGemini(`Create 8 flashcards. Reply ONLY as JSON array, no markdown:\n[{"question":"...","answer":"..."}]\n\n${getUnitContext(activeUnit)}`, 600, 0.5);
      const clean  = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean.match(/\[[\s\S]*\]/)?.[0] || clean);
      setFlashcards(parsed); setFcIndex(0); setFcFlipped(false);
    } catch (e) { setFlashcards([{ question: 'Error generating flashcards.', answer: e.message }]); }
    finally { setAiLoading(false); }
  }

  async function saveFlashcard(card) {
    const { data } = await supabase.from('flashcards').insert({ user_id: user.id, subject_id: subjectId, unit_id: activeUnit, question: card.question, answer: card.answer }).select().single();
    if (data) setSavedCards(p => [...p, data]);
  }

  // ── Student contribute ───────────────────────────────────────────────────────
  async function handleContribute() {
    if (!contribForm.title.trim()) return;
    setContributing(true); setContribMsg('');
    try {
      await supabase.from('pending_materials').insert({
        unit_id:      activeUnit,
        subject_id:   subjectId,
        title:        contribForm.title.trim(),
        type:         contribForm.type,
        url:          contribForm.url.trim() || null,
        content:      contribForm.content.trim() || null,
        description:  contribForm.description.trim() || null,
        submitted_by: user.id,
        submitter_name: profile?.name || user.email,
        status:       'pending',
      });
      setContribMsg('✅ Submitted! Staff will review your contribution.');
      setContribForm({ title: '', type: 'pdf', url: '', content: '', description: '' });
      setTimeout(() => { setShowContribute(false); setContribMsg(''); }, 2000);
    } catch (e) {
      setContribMsg('❌ Error: ' + e.message);
    } finally { setContributing(false); }
  }

  // ── Styles ───────────────────────────────────────────────────────────────────
  const bg      = isDark ? '#0f1117' : '#f8fafc';
  const surface = isDark ? '#141720' : 'white';
  const border  = isDark ? '#1e2433' : '#e5e7eb';
  const textPri = isDark ? '#e2e8f0' : '#1e293b';
  const textSec = isDark ? '#a0aec0' : '#64748b';
  const textMut = isDark ? '#4a5568' : '#94a3b8';
  const surfAlt = isDark ? '#0f1117'  : '#f8fafc';

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: bg }}>
      <div style={{ width: 36, height: 36, border: '3px solid #1e2433', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const activeUnitData = units.find(u => u.id === activeUnit);
  const activeMats     = materials[activeUnit] || [];
  const doneCount      = units.filter(u => progress[u.id]).length;

  return (
    <div style={{ display: 'flex', height: '100vh', background: bg, fontFamily: '"Inter",Arial,sans-serif', overflow: 'hidden' }}>

      {/* ── LEFT: Unit sidebar ── */}
      <div style={{ width: 250, background: surface, borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '1rem', borderBottom: `1px solid ${border}` }}>
          <Link to="/study-hub" style={{ color: '#667eea', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600 }}>← Study Hub</Link>
          <h2 style={{ color: textPri, fontSize: '0.95rem', fontWeight: 700, margin: '0.5rem 0 0.25rem' }}>{subject?.name}</h2>
          <div style={{ fontSize: '0.72rem', color: textMut }}>{subject?.department} · Sem {subject?.semester}</div>
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: textMut, marginBottom: '0.3rem' }}>
              <span>{doneCount}/{units.length} units</span>
              <span>{units.length ? Math.round(doneCount / units.length * 100) : 0}%</span>
            </div>
            <div style={{ height: 3, background: border, borderRadius: 2 }}>
              <div style={{ width: `${units.length ? doneCount / units.length * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg,#667eea,#764ba2)', borderRadius: 2, transition: 'width 0.4s' }} />
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {units.map(unit => (
            <div key={unit.id}
              onClick={() => { setActiveUnit(unit.id); setAiMode(null); setSummary(''); setQuizMsgs([]); setQuizHistory([]); setFlashcards([]); }}
              style={{ padding: '0.75rem', borderRadius: 10, marginBottom: '0.25rem', cursor: 'pointer', background: activeUnit === unit.id ? 'rgba(102,126,234,0.12)' : 'transparent', border: `1px solid ${activeUnit === unit.id ? 'rgba(102,126,234,0.25)' : 'transparent'}`, transition: 'all 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div onClick={e => { e.stopPropagation(); toggleProgress(unit.id); }}
                  style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${progress[unit.id] ? '#48bb78' : border}`, background: progress[unit.id] ? '#48bb78' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', transition: 'all 0.2s' }}>
                  {progress[unit.id] && <span style={{ color: 'white', fontSize: '0.6rem', fontWeight: 900 }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: textMut }}>Unit {unit.unit_number}</div>
                  <div style={{ fontSize: '0.82rem', color: activeUnit === unit.id ? textPri : textSec, fontWeight: activeUnit === unit.id ? 600 : 400, lineHeight: 1.3 }}>{unit.title}</div>
                </div>
              </div>
              <div style={{ marginTop: '0.35rem', paddingLeft: '1.5rem', fontSize: '0.68rem', color: textMut }}>
                {(materials[unit.id] || []).length} resource{(materials[unit.id] || []).length !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Unit header */}
        <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: '0.875rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: textMut }}>Unit {activeUnitData?.unit_number}</div>
            <h2 style={{ color: textPri, margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{activeUnitData?.title}</h2>
            {activeUnitData?.description && <p style={{ color: textSec, margin: '0.2rem 0 0', fontSize: '0.8rem' }}>{activeUnitData.description}</p>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {[
              { mode: 'summary',    icon: '🧠', label: 'AI Summary',  fn: handleSummary },
              { mode: 'quiz',       icon: '❓', label: 'Quiz Bot',    fn: startQuiz },
              { mode: 'flashcards', icon: '🃏', label: 'Flashcards',  fn: generateFlashcards },
            ].map(btn => (
              <button key={btn.mode} onClick={btn.fn}
                style={{ padding: '0.4rem 0.875rem', borderRadius: 8, border: `1px solid ${aiMode === btn.mode ? 'rgba(102,126,234,0.4)' : border}`, background: aiMode === btn.mode ? 'rgba(102,126,234,0.12)' : 'transparent', color: aiMode === btn.mode ? '#8b9cf4' : textSec, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                {btn.icon} {btn.label}
              </button>
            ))}
            <button onClick={() => toggleProgress(activeUnit)}
              style={{ padding: '0.4rem 0.875rem', borderRadius: 8, border: `1px solid ${progress[activeUnit] ? 'rgba(72,187,120,0.3)' : border}`, background: progress[activeUnit] ? 'rgba(72,187,120,0.1)' : 'transparent', color: progress[activeUnit] ? '#48bb78' : textSec, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
              {progress[activeUnit] ? '✓ Done' : 'Mark Done'}
            </button>
            {/* Contribute button — students only */}
            {!isStaff && (
              <button onClick={() => setShowContribute(true)}
                style={{ padding: '0.4rem 0.875rem', borderRadius: 8, border: '1px solid rgba(237,137,54,0.3)', background: 'rgba(237,137,54,0.1)', color: '#ed8936', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                📤 Contribute
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* Materials */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
            {activeMats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', background: surface, borderRadius: 16, border: `1px solid ${border}` }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📭</div>
                <p style={{ color: textSec }}>No materials uploaded for this unit yet.</p>
                {!isStaff && <p style={{ color: textMut, fontSize: '0.82rem' }}>Know a good resource? Click <strong style={{ color: '#ed8936' }}>Contribute</strong> to submit it for review.</p>}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {activeMats.map(mat => <MaterialCard key={mat.id} mat={mat} isDark={isDark} surface={surface} border={border} textPri={textPri} textSec={textSec} textMut={textMut} />)}
              </div>
            )}
          </div>

          {/* AI Panel */}
          {aiMode && (
            <div style={{ width: 370, background: surface, borderLeft: `1px solid ${border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

              {/* Summary */}
              {aiMode === 'summary' && (
                <>
                  <PanelHeader title="🧠 AI Summary" onClose={() => setAiMode(null)} surface={surface} border={border} textPri={textPri} />
                  <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    {aiLoading ? <div style={{ textAlign: 'center', padding: '2rem', color: textSec }}>🧠 Generating...</div>
                      : <div style={{ color: textSec, fontSize: '0.875rem', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{summary}</div>}
                  </div>
                  <div style={{ padding: '0.75rem', borderTop: `1px solid ${border}` }}>
                    <button onClick={() => { setSummary(''); handleSummary(); }} style={btnStyle('#667eea')}>↺ Regenerate</button>
                  </div>
                </>
              )}

              {/* Quiz Bot */}
              {aiMode === 'quiz' && (
                <>
                  <PanelHeader title="❓ Quiz Bot" onClose={() => setAiMode(null)} surface={surface} border={border} textPri={textPri} />
                  <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {quizMsgs.map((m, i) => (
                      <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                        <div style={{ background: m.role === 'user' ? 'rgba(102,126,234,0.12)' : (isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9'), color: textSec, padding: '0.65rem 0.875rem', borderRadius: m.role === 'user' ? '14px 14px 3px 14px' : '3px 14px 14px 14px', fontSize: '0.83rem', lineHeight: 1.7, border: `1px solid ${m.role === 'user' ? 'rgba(102,126,234,0.18)' : border}`, whiteSpace: 'pre-wrap' }}>{m.text}</div>
                      </div>
                    ))}
                    {aiLoading && quizMsgs.length > 0 && (
                      <div style={{ alignSelf: 'flex-start' }}>
                        <div style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9', border: `1px solid ${border}`, padding: '0.65rem', borderRadius: '3px 14px 14px 14px', display: 'flex', gap: 4 }}>
                          {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#667eea', animation: `bounce 1s ${i * 0.18}s infinite` }} />)}
                        </div>
                      </div>
                    )}
                    <div ref={quizEndRef} />
                  </div>
                  <div style={{ padding: '0.75rem', borderTop: `1px solid ${border}`, display: 'flex', gap: '0.5rem' }}>
                    <input value={quizInput} onChange={e => setQuizInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendQuizMessage()} placeholder="Your answer..."
                      style={{ flex: 1, background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc', border: `1px solid ${border}`, color: textPri, borderRadius: 10, padding: '0.6rem 0.875rem', fontSize: '0.83rem', outline: 'none' }} />
                    <button onClick={sendQuizMessage} disabled={aiLoading || !quizInput.trim()} style={{ padding: '0.6rem 0.875rem', background: aiLoading || !quizInput.trim() ? border : 'linear-gradient(135deg,#667eea,#764ba2)', color: aiLoading || !quizInput.trim() ? textMut : 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>→</button>
                  </div>
                </>
              )}

              {/* Flashcards */}
              {aiMode === 'flashcards' && (
                <>
                  <PanelHeader title="🃏 Flashcards" onClose={() => setAiMode(null)} surface={surface} border={border} textPri={textPri} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', gap: '1rem' }}>
                    {aiLoading ? <div style={{ color: textSec }}>🃏 Generating...</div>
                      : flashcards.length > 0 && (
                        <>
                          <div style={{ fontSize: '0.75rem', color: textMut }}>{fcIndex + 1} / {flashcards.length}</div>
                          <div onClick={() => setFcFlipped(f => !f)}
                            style={{ width: '100%', minHeight: 170, background: fcFlipped ? 'rgba(102,126,234,0.12)' : (isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'), border: `1px solid ${fcFlipped ? 'rgba(102,126,234,0.3)' : border}`, borderRadius: 16, padding: '1.5rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', transition: 'all 0.3s' }}>
                            <div style={{ fontSize: '0.7rem', color: textMut, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{fcFlipped ? 'Answer' : 'Question — tap to flip'}</div>
                            <div style={{ color: textPri, fontSize: '0.9rem', lineHeight: 1.7 }}>{fcFlipped ? flashcards[fcIndex].answer : flashcards[fcIndex].question}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                            <button onClick={() => { setFcIndex(i => Math.max(0, i - 1)); setFcFlipped(false); }} disabled={fcIndex === 0} style={{ flex: 1, padding: '0.5rem', background: 'transparent', border: `1px solid ${border}`, color: fcIndex === 0 ? textMut : textSec, borderRadius: 8, cursor: fcIndex === 0 ? 'not-allowed' : 'pointer', fontSize: '0.82rem' }}>← Prev</button>
                            <button onClick={() => { setFcIndex(i => Math.min(flashcards.length - 1, i + 1)); setFcFlipped(false); }} disabled={fcIndex === flashcards.length - 1} style={{ flex: 1, padding: '0.5rem', background: 'transparent', border: `1px solid ${border}`, color: fcIndex === flashcards.length - 1 ? textMut : textSec, borderRadius: 8, cursor: fcIndex === flashcards.length - 1 ? 'not-allowed' : 'pointer', fontSize: '0.82rem' }}>Next →</button>
                          </div>
                          {fcFlipped && (
                            <button onClick={() => saveFlashcard(flashcards[fcIndex])} style={btnStyle('#48bb78', '0.8rem')}>
                              💾 Save ({savedCards.length} saved)
                            </button>
                          )}
                        </>
                      )}
                  </div>
                  <div style={{ padding: '0.75rem', borderTop: `1px solid ${border}` }}>
                    <button onClick={() => { setFlashcards([]); generateFlashcards(); }} style={btnStyle('#667eea')}>↺ New Set</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Contribute Modal ── */}
      {showContribute && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setShowContribute(false)}>
          <div style={{ background: surface, borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 500, border: `1px solid ${border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ color: textPri, margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>📤 Contribute a Resource</h2>
                <p style={{ color: textMut, margin: '0.2rem 0 0', fontSize: '0.78rem' }}>Your submission will be reviewed by staff before going live</p>
              </div>
              <button onClick={() => setShowContribute(false)} style={{ background: 'none', border: 'none', color: textMut, cursor: 'pointer', fontSize: '1.4rem' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={labelStyle(textMut)}>Type</label>
                <select value={contribForm.type} onChange={e => setContribForm(f => ({ ...f, type: e.target.value }))} style={inputStyle(isDark, border, textPri)}>
                  <option value="pdf">📄 PDF / Notes Link</option>
                  <option value="video">🎥 YouTube Video</option>
                  <option value="link">🔗 External Link</option>
                  <option value="doc">📋 Google Doc / Slides</option>
                  <option value="text">📝 Write Notes</option>
                </select>
              </div>
              <div>
                <label style={labelStyle(textMut)}>Title *</label>
                <input value={contribForm.title} onChange={e => setContribForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Arrays cheat sheet" style={inputStyle(isDark, border, textPri)} />
              </div>
              {contribForm.type !== 'text' && (
                <div>
                  <label style={labelStyle(textMut)}>URL *</label>
                  <input value={contribForm.url} onChange={e => setContribForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." style={inputStyle(isDark, border, textPri)} />
                </div>
              )}
              {contribForm.type === 'text' && (
                <div>
                  <label style={labelStyle(textMut)}>Notes Content *</label>
                  <textarea value={contribForm.content} onChange={e => setContribForm(f => ({ ...f, content: e.target.value }))} rows={5} placeholder="Write your notes here..." style={{ ...inputStyle(isDark, border, textPri), resize: 'vertical' }} />
                </div>
              )}
              <div>
                <label style={labelStyle(textMut)}>Why is this helpful? (optional)</label>
                <input value={contribForm.description} onChange={e => setContribForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief note for the reviewer" style={inputStyle(isDark, border, textPri)} />
              </div>

              {contribMsg && (
                <div style={{ padding: '0.75rem', background: contribMsg.includes('✅') ? 'rgba(72,187,120,0.1)' : 'rgba(245,101,101,0.1)', borderRadius: 8, color: contribMsg.includes('✅') ? '#48bb78' : '#f56565', fontSize: '0.85rem', fontWeight: 600 }}>
                  {contribMsg}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowContribute(false)} style={{ padding: '0.6rem 1.25rem', background: 'transparent', color: textSec, border: `1px solid ${border}`, borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleContribute} disabled={contributing || !contribForm.title.trim()} style={{ padding: '0.6rem 1.5rem', background: contributing ? border : 'linear-gradient(135deg,#ed8936,#dd6b20)', color: contributing ? textMut : 'white', border: 'none', borderRadius: 8, cursor: contributing ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
                  {contributing ? 'Submitting...' : '📤 Submit for Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#2d3748;border-radius:2px}
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function PanelHeader({ title, onClose, surface, border, textPri }) {
  return (
    <div style={{ padding: '0.875rem 1rem', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: surface }}>
      <span style={{ color: textPri, fontWeight: 700, fontSize: '0.875rem' }}>{title}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
    </div>
  );
}

function MaterialCard({ mat, isDark, surface, border, textPri, textSec, textMut }) {
  const [expanded, setExpanded] = useState(false);
  const ytId = mat.type === 'video' ? getYouTubeId(mat.url || '') : null;
  const icons = { pdf: '📄', video: '🎥', link: '🔗', text: '📝', doc: '📋' };

  return (
    <div style={{ background: surface, borderRadius: 12, border: `1px solid ${border}`, overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem', cursor: mat.type === 'text' ? 'pointer' : 'default' }}
        onClick={() => mat.type === 'text' && setExpanded(e => !e)}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(102,126,234,0.1)', border: '1px solid rgba(102,126,234,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
          {icons[mat.type] || '📄'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: textPri, fontWeight: 600, fontSize: '0.9rem' }}>{mat.title}</div>
          {mat.description && <div style={{ color: textMut, fontSize: '0.78rem', marginTop: 2 }}>{mat.description}</div>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.68rem', color: textMut, background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', padding: '2px 8px', borderRadius: 6, border: `1px solid ${border}`, textTransform: 'uppercase' }}>{mat.type}</span>
          {mat.url && mat.type !== 'video' && (
            <a href={mat.url} target="_blank" rel="noreferrer" style={{ padding: '0.3rem 0.75rem', background: 'rgba(102,126,234,0.1)', color: '#8b9cf4', border: '1px solid rgba(102,126,234,0.2)', borderRadius: 7, fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none' }}>
              {mat.type === 'pdf' ? '⬇ Download' : '↗ Open'}
            </a>
          )}
          {mat.type === 'text' && <span style={{ color: textMut, fontSize: '0.75rem' }}>{expanded ? '▲' : '▼'}</span>}
        </div>
      </div>
      {mat.type === 'video' && ytId && (
        <div style={{ padding: '0 1.25rem 1rem' }}>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${border}` }}>
            <iframe width="100%" height="215" src={`https://www.youtube.com/embed/${ytId}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen style={{ display: 'block', border: 'none' }} />
          </div>
        </div>
      )}
      {mat.type === 'video' && !ytId && mat.url && (
        <div style={{ padding: '0 1.25rem 1rem' }}>
          <a href={mat.url} target="_blank" rel="noreferrer" style={{ display: 'block', padding: '0.75rem', background: 'rgba(102,126,234,0.08)', color: '#8b9cf4', border: '1px solid rgba(102,126,234,0.18)', borderRadius: 10, textDecoration: 'none', fontSize: '0.85rem', textAlign: 'center', fontWeight: 600 }}>▶ Watch Video</a>
        </div>
      )}
      {mat.type === 'text' && expanded && mat.content && (
        <div style={{ padding: '0 1.25rem 1rem', borderTop: `1px solid ${border}` }}>
          <div style={{ color: textSec, fontSize: '0.875rem', lineHeight: 1.8, whiteSpace: 'pre-wrap', paddingTop: '1rem' }}>{mat.content}</div>
        </div>
      )}
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function labelStyle(textMut) {
  return { fontSize: '0.75rem', fontWeight: 600, color: textMut, display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' };
}
function inputStyle(isDark, border, textPri) {
  return { width: '100%', padding: '0.65rem 0.875rem', border: `1.5px solid ${border}`, borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', background: isDark ? 'rgba(255,255,255,0.04)' : 'white', color: textPri, fontFamily: '"Inter",Arial,sans-serif' };
}
function btnStyle(color, fontSize = '0.82rem') {
  return { width: '100%', padding: '0.55rem', background: `${color}18`, color, border: `1px solid ${color}30`, borderRadius: 8, cursor: 'pointer', fontSize, fontWeight: 600 };
}
