// src/components/StaffLessonEditor.jsx
// Used inside StaffStudyHub when a unit is selected
// Staff creates structured lessons: Theory → Example → Exercise

import { useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabaseClient';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const LANGS = ['python', 'javascript', 'java', 'c', 'cpp'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

async function callGemini(prompt, maxTokens = 1200) {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.5 } }),
  });
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

const EMPTY_LESSON = {
  title: '', order_num: 1,
  theory: '', example_code: '', example_lang: 'python',
  example_output: '', example_explain: '', is_published: false,
};
const EMPTY_EXERCISE = {
  problem: '', starter_code: '', language: 'python',
  difficulty: 'EASY', hint: '', solution: '', xp_reward: 10,
  test_cases: [{ input: '', expected_output: '', is_hidden: false }],
};

export default function StaffLessonEditor({ unitId, subjectId, unitTitle }) {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [lessons,      setLessons]      = useState([]);
  const [selLesson,    setSelLesson]    = useState(null);
  const [lessonForm,   setLessonForm]   = useState(EMPTY_LESSON);
  const [exForm,       setExForm]       = useState(EMPTY_EXERCISE);
  const [hasExercise,  setHasExercise]  = useState(false);
  const [activeTab,    setActiveTab]    = useState('theory'); // theory | example | exercise
  const [saving,       setSaving]       = useState(false);
  const [msg,          setMsg]          = useState('');
  const [aiLoading,    setAiLoading]    = useState(false);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => { if (unitId) loadLessons(); }, [unitId]);

  async function loadLessons() {
    setLoading(true);
    const { data } = await supabase
      .from('lessons')
      .select('*, lesson_exercises(*)')
      .eq('unit_id', unitId)
      .order('order_num');
    setLessons(data || []);
    setLoading(false);
  }

  function selectLesson(lesson) {
    setSelLesson(lesson);
    setLessonForm({
      title:          lesson.title,
      order_num:      lesson.order_num,
      theory:         lesson.theory || '',
      example_code:   lesson.example_code || '',
      example_lang:   lesson.example_lang || 'python',
      example_output: lesson.example_output || '',
      example_explain:lesson.example_explain || '',
      is_published:   lesson.is_published,
    });
    const ex = lesson.lesson_exercises?.[0];
    if (ex) {
      setHasExercise(true);
      setExForm({
        problem:     ex.problem,
        starter_code:ex.starter_code || '',
        language:    ex.language || 'python',
        difficulty:  ex.difficulty || 'EASY',
        hint:        ex.hint || '',
        solution:    ex.solution || '',
        xp_reward:   ex.xp_reward || 10,
        test_cases:  ex.test_cases?.length ? ex.test_cases : [{ input: '', expected_output: '', is_hidden: false }],
      });
    } else {
      setHasExercise(false);
      setExForm(EMPTY_EXERCISE);
    }
    setActiveTab('theory');
  }

  function newLesson() {
    setSelLesson(null);
    setLessonForm({ ...EMPTY_LESSON, order_num: lessons.length + 1 });
    setExForm(EMPTY_EXERCISE);
    setHasExercise(false);
    setActiveTab('theory');
  }

  function flash(m, err = false) {
    setMsg({ text: m, err });
    setTimeout(() => setMsg(''), 3000);
  }

  // ── Save lesson ──────────────────────────────────────────────────────────────
  async function saveLesson() {
    if (!lessonForm.title.trim()) { flash('Title is required', true); return; }
    setSaving(true);

    let lessonId = selLesson?.id;
    const payload = { ...lessonForm, unit_id: unitId, subject_id: subjectId, created_by: user.id, updated_at: new Date().toISOString() };

    if (selLesson) {
      await supabase.from('lessons').update(payload).eq('id', selLesson.id);
    } else {
      const { data } = await supabase.from('lessons').insert(payload).select().single();
      lessonId = data?.id;
    }

    // Save exercise if toggled on
    if (hasExercise && lessonId) {
      const exPayload = { ...exForm, lesson_id: lessonId };
      const existing = selLesson?.lesson_exercises?.[0];
      if (existing) {
        await supabase.from('lesson_exercises').update(exPayload).eq('id', existing.id);
      } else {
        await supabase.from('lesson_exercises').insert(exPayload);
      }
    } else if (!hasExercise && selLesson?.lesson_exercises?.[0]) {
      await supabase.from('lesson_exercises').delete().eq('lesson_id', selLesson.id);
    }

    await loadLessons();
    flash('✅ Lesson saved!');
    setSaving(false);
  }

  async function deleteLesson(id) {
    if (!confirm('Delete this lesson and its exercise?')) return;
    await supabase.from('lessons').delete().eq('id', id);
    if (selLesson?.id === id) { setSelLesson(null); setLessonForm(EMPTY_LESSON); }
    await loadLessons();
    flash('Lesson deleted.');
  }

  async function togglePublish(lesson) {
    await supabase.from('lessons').update({ is_published: !lesson.is_published }).eq('id', lesson.id);
    await loadLessons();
    if (selLesson?.id === lesson.id) setLessonForm(f => ({ ...f, is_published: !f.is_published }));
  }

  // ── Test case helpers ────────────────────────────────────────────────────────
  function addTestCase() {
    setExForm(f => ({ ...f, test_cases: [...f.test_cases, { input: '', expected_output: '', is_hidden: false }] }));
  }
  function updateTestCase(i, field, val) {
    setExForm(f => ({ ...f, test_cases: f.test_cases.map((tc, idx) => idx === i ? { ...tc, [field]: val } : tc) }));
  }
  function removeTestCase(i) {
    setExForm(f => ({ ...f, test_cases: f.test_cases.filter((_, idx) => idx !== i) }));
  }

  // ── AI Generate Theory ────────────────────────────────────────────────────────
  async function aiGenerateTheory() {
    if (!lessonForm.title.trim()) { flash('Enter a lesson title first', true); return; }
    setAiLoading(true);
    try {
      const text = await callGemini(
        `Write clear, structured theory content for a lesson titled "${lessonForm.title}" in a college coding course.
Use this format:
- Start with a brief intro paragraph
- Use **bold** for key terms
- Use \`inline code\` for syntax
- Use code blocks with \`\`\` for examples
- End with a "Key Takeaways" section
Keep it focused, 300-500 words, no fluff.`, 1200
      );
      setLessonForm(f => ({ ...f, theory: text }));
    } catch (e) { flash('AI error: ' + e.message, true); }
    setAiLoading(false);
  }

  // ── AI Generate Exercise ──────────────────────────────────────────────────────
  async function aiGenerateExercise() {
    if (!lessonForm.title.trim()) { flash('Enter a lesson title first', true); return; }
    setAiLoading(true);
    try {
      const raw = await callGemini(
        `Create a coding exercise for the topic "${lessonForm.title}" in ${exForm.language}.
Difficulty: ${exForm.difficulty}
Reply ONLY as JSON, no markdown:
{
  "problem": "clear problem statement with input/output format described",
  "starter_code": "partial or empty code to give student",
  "hint": "one helpful hint without giving away the answer",
  "solution": "complete working solution",
  "test_cases": [
    {"input": "sample input", "expected_output": "expected output", "is_hidden": false},
    {"input": "sample input 2", "expected_output": "expected output 2", "is_hidden": false},
    {"input": "edge case", "expected_output": "edge output", "is_hidden": true}
  ]
}`, 1000
      );
      const clean  = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean.match(/\{[\s\S]*\}/)?.[0] || clean);
      setExForm(f => ({
        ...f,
        problem:      parsed.problem || f.problem,
        starter_code: parsed.starter_code || f.starter_code,
        hint:         parsed.hint || f.hint,
        solution:     parsed.solution || f.solution,
        test_cases:   parsed.test_cases?.length ? parsed.test_cases : f.test_cases,
      }));
      flash('✅ Exercise generated!');
    } catch (e) { flash('AI error: ' + e.message, true); }
    setAiLoading(false);
  }

  // ── Theme ─────────────────────────────────────────────────────────────────────
  const bg      = isDark ? '#0f1117' : '#f8fafc';
  const surface = isDark ? '#141720' : '#ffffff';
  const border  = isDark ? '#1e2433' : '#e5e7eb';
  const textPri = isDark ? '#e2e8f0' : '#1e293b';
  const textSec = isDark ? '#a0aec0' : '#64748b';
  const textMut = isDark ? '#4a5568' : '#94a3b8';
  const surfAlt = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc';

  const inp = { width: '100%', padding: '0.6rem 0.875rem', border: `1.5px solid ${border}`, borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', background: isDark ? 'rgba(255,255,255,0.04)' : 'white', color: textPri, fontFamily: '"Inter",Arial,sans-serif' };
  const ta  = { ...inp, resize: 'vertical', fontFamily: '"Fira Code",monospace', fontSize: '0.82rem', lineHeight: 1.6 };
  const lbl = { fontSize: '0.72rem', fontWeight: 700, color: textMut, display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const tabBtn = (t) => ({ padding: '0.45rem 0.875rem', border: 'none', cursor: 'pointer', fontWeight: activeTab === t ? 700 : 500, fontSize: '0.82rem', background: 'transparent', borderBottom: `2px solid ${activeTab === t ? '#667eea' : 'transparent'}`, color: activeTab === t ? '#667eea' : textMut, transition: 'all 0.15s', fontFamily: '"Inter",Arial,sans-serif' });
  const btn = (c, ghost = false) => ({ padding: '0.45rem 1rem', background: ghost ? 'transparent' : c, color: ghost ? c : 'white', border: `1px solid ${ghost ? c + '50' : 'transparent'}`, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', fontFamily: '"Inter",Arial,sans-serif' });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.25rem', height: '100%' }}>

      {/* ── Lesson list ── */}
      <div style={{ background: surface, borderRadius: 12, border: `1px solid ${border}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0.75rem', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: textPri }}>📚 Lessons</span>
          <button onClick={newLesson} style={{ ...btn('#667eea'), padding: '0.25rem 0.65rem', fontSize: '0.72rem' }}>+ New</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.4rem' }}>
          {loading && <div style={{ textAlign: 'center', padding: '2rem', color: textMut, fontSize: '0.82rem' }}>Loading...</div>}
          {!loading && lessons.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: textMut, fontSize: '0.78rem', lineHeight: 1.7 }}>No lessons yet.<br />Click "+ New" to create the first lesson.</div>
          )}
          {lessons.map(l => (
            <div key={l.id}
              onClick={() => selectLesson(l)}
              style={{ padding: '0.65rem 0.75rem', borderRadius: 8, marginBottom: '0.25rem', cursor: 'pointer', background: selLesson?.id === l.id ? 'rgba(102,126,234,0.1)' : 'transparent', border: `1px solid ${selLesson?.id === l.id ? 'rgba(102,126,234,0.2)' : 'transparent'}`, transition: 'all 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.68rem', color: textMut }}>Lesson {l.order_num}</div>
                  <div style={{ fontSize: '0.8rem', color: textPri, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  {l.lesson_exercises?.length > 0 && <span title="Has exercise" style={{ fontSize: '0.65rem', color: '#667eea' }}>💻</span>}
                  <span style={{ fontSize: '0.65rem', color: l.is_published ? '#48bb78' : textMut }}>
                    {l.is_published ? '●' : '○'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Editor panel ── */}
      <div style={{ background: surface, borderRadius: 12, border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selLesson && lessonForm.title === '' ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: textMut }}>
            <div style={{ fontSize: '3rem' }}>📝</div>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Select a lesson to edit or click "+ New"</p>
            <button onClick={newLesson} style={{ ...btn('#667eea'), padding: '0.6rem 1.5rem' }}>+ Create First Lesson</button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 0 }}>
                {['theory', 'example', 'exercise'].map(t => (
                  <button key={t} style={tabBtn(t)} onClick={() => setActiveTab(t)}>
                    {t === 'theory' ? '📖 Theory' : t === 'example' ? '💡 Example' : '✏️ Exercise'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {msg && <span style={{ fontSize: '0.78rem', color: msg.err ? '#f56565' : '#48bb78', fontWeight: 600 }}>{msg.text || msg}</span>}
                {selLesson && (
                  <button onClick={() => togglePublish(selLesson)} style={{ ...btn(selLesson.is_published ? '#ed8936' : '#48bb78', true), padding: '0.35rem 0.75rem', fontSize: '0.72rem' }}>
                    {selLesson.is_published ? '⬇ Unpublish' : '▲ Publish'}
                  </button>
                )}
                <button onClick={saveLesson} disabled={saving} style={{ ...btn('#667eea'), opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving...' : '💾 Save'}
                </button>
                {selLesson && (
                  <button onClick={() => deleteLesson(selLesson.id)} style={{ ...btn('#f56565', true), padding: '0.35rem 0.65rem', fontSize: '0.72rem' }}>🗑</button>
                )}
              </div>
            </div>

            {/* Common: title + order */}
            <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${border}`, display: 'flex', gap: '1rem', alignItems: 'flex-end', background: surfAlt, flexShrink: 0 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Lesson Title *</label>
                <input value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Arithmetic Operators" style={inp} />
              </div>
              <div style={{ width: 100 }}>
                <label style={lbl}>Order #</label>
                <input type="number" min={1} value={lessonForm.order_num} onChange={e => setLessonForm(f => ({ ...f, order_num: parseInt(e.target.value) || 1 }))} style={inp} />
              </div>
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>

              {/* ── THEORY ── */}
              {activeTab === 'theory' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={lbl}>Theory Content (supports **bold** and `code` and ```code blocks```)</label>
                    <button onClick={aiGenerateTheory} disabled={aiLoading} style={{ ...btn('#9f7aea', true), padding: '0.3rem 0.75rem', fontSize: '0.72rem', flexShrink: 0 }}>
                      {aiLoading ? '✨ Generating...' : '✨ AI Generate'}
                    </button>
                  </div>
                  <textarea value={lessonForm.theory} onChange={e => setLessonForm(f => ({ ...f, theory: e.target.value }))} rows={20} placeholder="Write the theory/concept explanation here...
  
You can use:
**bold text** for key terms
`inline code` for syntax
```
code block
``` for examples" style={ta} />
                </div>
              )}

              {/* ── EXAMPLE ── */}
              {activeTab === 'example' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Language</label>
                      <select value={lessonForm.example_lang} onChange={e => setLessonForm(f => ({ ...f, example_lang: e.target.value }))} style={inp}>
                        {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Example Code (shown read-only to students, they can run it)</label>
                    <textarea value={lessonForm.example_code} onChange={e => setLessonForm(f => ({ ...f, example_code: e.target.value }))} rows={12} placeholder="# Example code students can run and observe" style={ta} />
                  </div>
                  <div>
                    <label style={lbl}>Expected Output (shown alongside code)</label>
                    <textarea value={lessonForm.example_output} onChange={e => setLessonForm(f => ({ ...f, example_output: e.target.value }))} rows={3} placeholder="What this code prints..." style={ta} />
                  </div>
                  <div>
                    <label style={lbl}>Explanation (what does this code demonstrate?)</label>
                    <textarea value={lessonForm.example_explain} onChange={e => setLessonForm(f => ({ ...f, example_explain: e.target.value }))} rows={4} placeholder="This example shows how... Notice that..." style={ta} />
                  </div>
                </div>
              )}

              {/* ── EXERCISE ── */}
              {activeTab === 'exercise' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                      <div onClick={() => setHasExercise(h => !h)} style={{ width: 36, height: 20, borderRadius: 10, background: hasExercise ? '#667eea' : border, position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: hasExercise ? 19 : 3, transition: 'left 0.2s' }} />
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: textPri }}>Include a coding exercise</span>
                    </label>
                    {hasExercise && (
                      <button onClick={aiGenerateExercise} disabled={aiLoading} style={{ ...btn('#9f7aea', true), padding: '0.3rem 0.75rem', fontSize: '0.72rem' }}>
                        {aiLoading ? '✨ Generating...' : '✨ AI Generate'}
                      </button>
                    )}
                  </div>

                  {hasExercise && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 100px', gap: '0.75rem' }}>
                        <div>
                          <label style={lbl}>Language</label>
                          <select value={exForm.language} onChange={e => setExForm(f => ({ ...f, language: e.target.value }))} style={inp}>
                            {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={lbl}>Difficulty</label>
                          <select value={exForm.difficulty} onChange={e => setExForm(f => ({ ...f, difficulty: e.target.value }))} style={inp}>
                            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={lbl}>XP Reward</label>
                          <input type="number" min={5} value={exForm.xp_reward} onChange={e => setExForm(f => ({ ...f, xp_reward: parseInt(e.target.value) || 10 }))} style={inp} />
                        </div>
                      </div>

                      <div>
                        <label style={lbl}>Problem Statement *</label>
                        <textarea value={exForm.problem} onChange={e => setExForm(f => ({ ...f, problem: e.target.value }))} rows={5} placeholder="Write a program that takes two numbers as input and prints their sum.

Input format: Two integers on separate lines
Output format: Their sum" style={ta} />
                      </div>

                      <div>
                        <label style={lbl}>Starter Code (optional — partial code to give students)</label>
                        <textarea value={exForm.starter_code} onChange={e => setExForm(f => ({ ...f, starter_code: e.target.value }))} rows={5} placeholder="# Complete the function below..." style={ta} />
                      </div>

                      <div>
                        <label style={lbl}>Hint (shown after student requests it)</label>
                        <input value={exForm.hint} onChange={e => setExForm(f => ({ ...f, hint: e.target.value }))} placeholder="Think about how to read input first..." style={inp} />
                      </div>

                      <div>
                        <label style={lbl}>Solution (shown after 3 failed attempts)</label>
                        <textarea value={exForm.solution} onChange={e => setExForm(f => ({ ...f, solution: e.target.value }))} rows={6} placeholder="Complete working solution..." style={ta} />
                      </div>

                      {/* Test cases */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <label style={lbl}>Test Cases</label>
                          <button onClick={addTestCase} style={{ ...btn('#48bb78', true), padding: '0.25rem 0.65rem', fontSize: '0.72rem' }}>+ Add</button>
                        </div>
                        {exForm.test_cases.map((tc, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center', padding: '0.75rem', background: surfAlt, borderRadius: 8, border: `1px solid ${border}` }}>
                            <div>
                              <label style={{ fontSize: '0.65rem', color: textMut, display: 'block', marginBottom: 2 }}>INPUT</label>
                              <input value={tc.input} onChange={e => updateTestCase(i, 'input', e.target.value)} placeholder="stdin input" style={{ ...inp, padding: '0.4rem 0.6rem', fontSize: '0.78rem' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.65rem', color: textMut, display: 'block', marginBottom: 2 }}>EXPECTED OUTPUT</label>
                              <input value={tc.expected_output} onChange={e => updateTestCase(i, 'expected_output', e.target.value)} placeholder="expected stdout" style={{ ...inp, padding: '0.4rem 0.6rem', fontSize: '0.78rem' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                              <label style={{ fontSize: '0.62rem', color: textMut }}>Hidden</label>
                              <input type="checkbox" checked={tc.is_hidden} onChange={e => updateTestCase(i, 'is_hidden', e.target.checked)} />
                            </div>
                            <button onClick={() => removeTestCase(i)} style={{ background: 'none', border: 'none', color: '#f56565', cursor: 'pointer', fontSize: '1rem', padding: '0.25rem' }}>✕</button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
