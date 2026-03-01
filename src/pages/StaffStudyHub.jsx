// src/pages/StaffStudyHub.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../utils/supabaseClient';

const DEPARTMENTS = ['CSE','IT','ECE','EEE','MECH','CIVIL','AIDS','AIML'];
const SEMESTERS   = [1,2,3,4,5,6,7,8];
const MAT_TYPES   = [
  { value:'pdf',   label:'📄 PDF / Notes',        hint:'Google Drive / Dropbox link' },
  { value:'video', label:'🎥 YouTube Video',       hint:'YouTube URL' },
  { value:'link',  label:'🔗 External Link',       hint:'Any website URL' },
  { value:'doc',   label:'📋 Google Doc / Slides', hint:'Google Doc share link' },
  { value:'text',  label:'📝 Write Text Directly', hint:'Type notes inline' },
];

const EMPTY_SUBJECT  = { name:'', code:'', department:'CSE', semester:1, description:'' };
const EMPTY_UNIT     = { title:'', unit_number:1, description:'' };
const EMPTY_MATERIAL = { title:'', type:'pdf', url:'', content:'', description:'' };

export default function StaffStudyHub() {
  const { user, profile } = useAuth();
  const { isDark } = useTheme();

  const [tab,       setTab]       = useState('manage'); // 'manage' | 'pending'
  const [subjects,  setSubjects]  = useState([]);
  const [units,     setUnits]     = useState([]);
  const [materials, setMaterials] = useState([]);
  const [pending,   setPending]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [pendLoading, setPendLoading] = useState(false);

  const [filterDept, setFilterDept] = useState(profile?.department || 'CSE');
  const [filterSubj, setFilterSubj] = useState('');
  const [filterUnit, setFilterUnit] = useState('');

  const [showSubjModal, setShowSubjModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showMatModal,  setShowMatModal]  = useState(false);
  const [editSubj,      setEditSubj]      = useState(null);
  const [editUnit,      setEditUnit]      = useState(null);

  const [subjForm, setSubjForm] = useState(EMPTY_SUBJECT);
  const [unitForm, setUnitForm] = useState(EMPTY_UNIT);
  const [matForm,  setMatForm]  = useState(EMPTY_MATERIAL);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState('');

  useEffect(() => { loadSubjects(); }, [filterDept]);
  useEffect(() => { if (filterSubj) loadUnits(filterSubj); else setUnits([]); }, [filterSubj]);
  useEffect(() => { if (filterUnit) loadMaterials(filterUnit); else setMaterials([]); }, [filterUnit]);
  useEffect(() => { if (tab === 'pending') loadPending(); }, [tab]);

  async function loadSubjects() {
    setLoading(true);
    const { data } = await supabase.from('subjects').select('*').eq('department', filterDept).order('semester').order('name');
    setSubjects(data || []); setLoading(false);
  }
  async function loadUnits(sid) {
    const { data } = await supabase.from('units').select('*').eq('subject_id', sid).order('unit_number');
    setUnits(data || []);
  }
  async function loadMaterials(uid) {
    const { data } = await supabase.from('study_materials').select('*').eq('unit_id', uid).order('created_at');
    setMaterials(data || []);
  }
  async function loadPending() {
    setPendLoading(true);
    const { data } = await supabase
      .from('pending_materials')
      .select('*, subject:subjects(name,department), unit:units(title,unit_number)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setPending(data || []);
    setPendLoading(false);
  }

  function flash(m, isError = false) {
    setMsg({ text: m, error: isError });
    setTimeout(() => setMsg(''), 3500);
  }

  // ── Subject CRUD ─────────────────────────────────────────────────────────────
  async function saveSubject() {
    if (!subjForm.name.trim()) return;
    setSaving(true);
    if (editSubj) {
      await supabase.from('subjects').update({ ...subjForm, semester: parseInt(subjForm.semester) }).eq('id', editSubj.id);
    } else {
      await supabase.from('subjects').insert({ ...subjForm, semester: parseInt(subjForm.semester), created_by: user.id });
    }
    setShowSubjModal(false); setEditSubj(null); setSubjForm(EMPTY_SUBJECT);
    loadSubjects(); flash(editSubj ? 'Subject updated!' : 'Subject created!');
    setSaving(false);
  }
  async function deleteSubject(id) {
    if (!confirm('Delete this subject and all its units/materials?')) return;
    await supabase.from('subjects').delete().eq('id', id);
    loadSubjects(); flash('Subject deleted.');
  }

  // ── Unit CRUD ────────────────────────────────────────────────────────────────
  async function saveUnit() {
    if (!unitForm.title.trim() || !filterSubj) return;
    setSaving(true);
    if (editUnit) {
      await supabase.from('units').update({ ...unitForm, unit_number: parseInt(unitForm.unit_number) }).eq('id', editUnit.id);
    } else {
      await supabase.from('units').insert({ ...unitForm, unit_number: parseInt(unitForm.unit_number), subject_id: filterSubj });
    }
    setShowUnitModal(false); setEditUnit(null); setUnitForm(EMPTY_UNIT);
    loadUnits(filterSubj); flash(editUnit ? 'Unit updated!' : 'Unit added!');
    setSaving(false);
  }
  async function deleteUnit(id) {
    if (!confirm('Delete this unit and all its materials?')) return;
    await supabase.from('units').delete().eq('id', id);
    loadUnits(filterSubj); flash('Unit deleted.');
  }

  // ── Material CRUD ────────────────────────────────────────────────────────────
  async function saveMaterial() {
    if (!matForm.title.trim() || !filterUnit) return;
    setSaving(true);
    await supabase.from('study_materials').insert({ ...matForm, unit_id: filterUnit, subject_id: filterSubj, uploaded_by: user.id });
    setShowMatModal(false); setMatForm(EMPTY_MATERIAL);
    loadMaterials(filterUnit); flash('Material added!');
    setSaving(false);
  }
  async function deleteMaterial(id) {
    if (!confirm('Delete this material?')) return;
    await supabase.from('study_materials').delete().eq('id', id);
    loadMaterials(filterUnit); flash('Material deleted.');
  }

  // ── Pending review actions ───────────────────────────────────────────────────
  async function approvePending(item) {
    setSaving(true);
    // Copy to study_materials
    await supabase.from('study_materials').insert({
      unit_id:     item.unit_id,
      subject_id:  item.subject_id,
      title:       item.title,
      type:        item.type,
      url:         item.url,
      content:     item.content,
      description: item.description,
      uploaded_by: user.id,
    });
    // Mark pending as approved
    await supabase.from('pending_materials').update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', item.id);
    setPending(p => p.filter(x => x.id !== item.id));
    flash('✅ Approved and published!');
    setSaving(false);
  }

  async function rejectPending(id, reason = '') {
    await supabase.from('pending_materials').update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString(), rejection_reason: reason }).eq('id', id);
    setPending(p => p.filter(x => x.id !== id));
    flash('Contribution rejected.');
  }

  // ── Styles ───────────────────────────────────────────────────────────────────
  const bg      = isDark ? '#0f1117' : '#f8fafc';
  const surface = isDark ? '#141720' : 'white';
  const border  = isDark ? '#1e2433' : '#e5e7eb';
  const textPri = isDark ? '#e2e8f0' : '#1e293b';
  const textSec = isDark ? '#a0aec0' : '#64748b';
  const textMut = isDark ? '#4a5568' : '#94a3b8';
  const surfAlt = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc';

  const col = { background: surface, borderRadius: 14, border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', minHeight: 500 };
  const colHdr = { padding: '0.875rem 1rem', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const colBody = { flex: 1, overflowY: 'auto', padding: '0.5rem' };
  const item = (active) => ({ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: 10, marginBottom: '0.35rem', background: active ? 'rgba(102,126,234,0.1)' : surfAlt, border: `1px solid ${active ? 'rgba(102,126,234,0.25)' : border}`, cursor: 'pointer', transition: 'all 0.15s' });
  const inp = { width: '100%', padding: '0.65rem 0.875rem', border: `1.5px solid ${border}`, borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', background: isDark ? 'rgba(255,255,255,0.04)' : 'white', color: textPri, fontFamily: '"Inter",Arial,sans-serif' };
  const addBtn = { padding: '0.3rem 0.875rem', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, fontFamily: '"Inter",Arial,sans-serif' };
  const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '0.2rem 0.4rem', borderRadius: 5 };
  const empty = { textAlign: 'center', color: textMut, fontSize: '0.82rem', padding: '3rem 1rem', lineHeight: 1.7 };

  const filteredByDept = subjects.filter(s => s.department === filterDept);
  const selectedSubjName = subjects.find(s => s.id === filterSubj)?.name || '';
  const selectedUnitName = units.find(u => u.id === filterUnit)?.title || '';

  return (
    <div style={{ minHeight: '100vh', background: bg, color: textPri, fontFamily: '"Inter",Arial,sans-serif' }}>

      {/* Header */}
      <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: '1.1rem 2rem' }}>
        <div style={{ maxWidth: 1150, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 0.2rem', color: textPri }}>📚 Study Hub Manager</h1>
            <p style={{ color: textMut, margin: 0, fontSize: '0.82rem' }}>Add and manage learning materials for students</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {/* Pending badge */}
            <button onClick={() => setTab('pending')}
              style={{ padding: '0.5rem 1rem', background: tab === 'pending' ? 'rgba(237,137,54,0.15)' : 'transparent', color: '#ed8936', border: `1px solid ${tab === 'pending' ? 'rgba(237,137,54,0.3)' : border}`, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              📥 Review Contributions {pending.length > 0 && <span style={{ background: '#ed8936', color: 'white', borderRadius: '50%', padding: '1px 6px', fontSize: '0.7rem' }}>{pending.length}</span>}
            </button>
            <button onClick={() => setTab('manage')}
              style={{ padding: '0.5rem 1rem', background: tab === 'manage' ? 'rgba(102,126,234,0.15)' : 'transparent', color: '#667eea', border: `1px solid ${tab === 'manage' ? 'rgba(102,126,234,0.3)' : border}`, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
              📋 Manage
            </button>
            <Link to="/study-hub" style={{ textDecoration: 'none', color: textSec, background: surfAlt, border: `1px solid ${border}`, padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.82rem' }}>👁 Student View</Link>
          </div>
        </div>
      </div>

      {/* Flash message */}
      {msg && (
        <div style={{ background: msg.error ? 'rgba(245,101,101,0.15)' : 'rgba(72,187,120,0.15)', border: `1px solid ${msg.error ? 'rgba(245,101,101,0.3)' : 'rgba(72,187,120,0.3)'}`, color: msg.error ? '#f56565' : '#48bb78', padding: '0.75rem 2rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600 }}>
          {msg.text || msg}
        </div>
      )}

      {/* ── PENDING REVIEW TAB ── */}
      {tab === 'pending' && (
        <div style={{ maxWidth: 900, margin: '2rem auto', padding: '0 2rem' }}>
          <h2 style={{ color: textPri, fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem' }}>📥 Student Contributions Awaiting Review</h2>

          {pendLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: textMut }}>Loading...</div>
          ) : pending.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', background: surface, borderRadius: 16, border: `1px solid ${border}` }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
              <p style={{ color: textSec }}>No pending contributions — you're all caught up!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pending.map(p => (
                <div key={p.id} style={{ background: surface, borderRadius: 14, border: `1px solid ${border}`, overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: textPri, fontSize: '0.95rem' }}>{p.title}</div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ background: 'rgba(237,137,54,0.1)', color: '#ed8936', padding: '1px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, border: '1px solid rgba(237,137,54,0.2)' }}>{p.type}</span>
                        <span style={{ background: surfAlt, color: textMut, padding: '1px 8px', borderRadius: 20, fontSize: '0.7rem', border: `1px solid ${border}` }}>{p.subject?.name || '—'}</span>
                        <span style={{ background: surfAlt, color: textMut, padding: '1px 8px', borderRadius: 20, fontSize: '0.7rem', border: `1px solid ${border}` }}>Unit {p.unit?.unit_number}: {p.unit?.title}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: textMut, textAlign: 'right' }}>
                      <div>Submitted by <strong style={{ color: textSec }}>{p.submitter_name}</strong></div>
                      <div>{new Date(p.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <div style={{ padding: '0.875rem 1.25rem' }}>
                    {p.description && <p style={{ color: textSec, fontSize: '0.85rem', margin: '0 0 0.75rem' }}>"{p.description}"</p>}
                    {p.url && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <span style={{ color: textMut, fontSize: '0.78rem' }}>URL: </span>
                        <a href={p.url} target="_blank" rel="noreferrer" style={{ color: '#667eea', fontSize: '0.82rem', wordBreak: 'break-all' }}>{p.url}</a>
                      </div>
                    )}
                    {p.content && (
                      <div style={{ background: surfAlt, borderRadius: 8, padding: '0.75rem', fontSize: '0.82rem', color: textSec, maxHeight: 100, overflowY: 'auto', border: `1px solid ${border}`, marginBottom: '0.75rem' }}>
                        {p.content.substring(0, 300)}{p.content.length > 300 ? '...' : ''}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button onClick={() => approvePending(p)} disabled={saving}
                        style={{ padding: '0.5rem 1.25rem', background: 'rgba(72,187,120,0.12)', color: '#48bb78', border: '1px solid rgba(72,187,120,0.25)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                        ✅ Approve & Publish
                      </button>
                      <button onClick={() => { const r = prompt('Reason for rejection (optional):'); rejectPending(p.id, r || ''); }}
                        style={{ padding: '0.5rem 1.25rem', background: 'rgba(245,101,101,0.08)', color: '#f56565', border: '1px solid rgba(245,101,101,0.2)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MANAGE TAB ── */}
      {tab === 'manage' && (
        <div style={{ maxWidth: 1150, margin: '0 auto', padding: '2rem' }}>

          {/* Department pills */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            {DEPARTMENTS.map(d => (
              <button key={d} onClick={() => { setFilterDept(d); setFilterSubj(''); setFilterUnit(''); }}
                style={{ padding: '0.4rem 1rem', borderRadius: 20, border: `1px solid ${filterDept === d ? '#667eea' : border}`, background: filterDept === d ? 'rgba(102,126,234,0.15)' : 'transparent', color: filterDept === d ? '#8b9cf4' : textMut, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                {d}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>

            {/* ── Subjects ── */}
            <div style={col}>
              <div style={colHdr}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: textPri }}>📘 Subjects</span>
                <button style={addBtn} onClick={() => { setSubjForm({ ...EMPTY_SUBJECT, department: filterDept }); setEditSubj(null); setShowSubjModal(true); }}>+ Add</button>
              </div>
              <div style={colBody}>
                {loading ? <div style={empty}>Loading...</div>
                  : filteredByDept.length === 0 ? <div style={empty}>No subjects for {filterDept}.<br />Add one to get started.</div>
                  : filteredByDept.map(subj => (
                    <div key={subj.id} onClick={() => { setFilterSubj(subj.id); setFilterUnit(''); }} style={item(filterSubj === subj.id)}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: textPri }}>{subj.name}</div>
                        <div style={{ fontSize: '0.72rem', color: textMut }}>Sem {subj.semester}{subj.code ? ` · ${subj.code}` : ''}</div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setEditSubj(subj); setSubjForm({ name: subj.name, code: subj.code || '', department: subj.department, semester: subj.semester, description: subj.description || '' }); setShowSubjModal(true); }} style={iconBtn}>✏️</button>
                      <button onClick={e => { e.stopPropagation(); deleteSubject(subj.id); }} style={{ ...iconBtn, color: '#f56565' }}>🗑</button>
                    </div>
                  ))}
              </div>
            </div>

            {/* ── Units ── */}
            <div style={col}>
              <div style={colHdr}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: textPri }}>📑 Units {selectedSubjName ? `— ${selectedSubjName}` : ''}</span>
                <button style={addBtn} onClick={() => { if (!filterSubj) { flash('Select a subject first', true); return; } setEditUnit(null); setUnitForm({ ...EMPTY_UNIT, unit_number: units.length + 1 }); setShowUnitModal(true); }}>+ Add</button>
              </div>
              <div style={colBody}>
                {!filterSubj ? <div style={empty}>← Select a subject</div>
                  : units.length === 0 ? <div style={empty}>No units yet.<br />Add Unit 1 to start.</div>
                  : units.map(unit => (
                    <div key={unit.id} onClick={() => setFilterUnit(unit.id)} style={item(filterUnit === unit.id)}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: textPri }}>Unit {unit.unit_number}: {unit.title}</div>
                        {unit.description && <div style={{ fontSize: '0.72rem', color: textMut }}>{unit.description.substring(0, 50)}</div>}
                      </div>
                      <button onClick={e => { e.stopPropagation(); setEditUnit(unit); setUnitForm({ title: unit.title, unit_number: unit.unit_number, description: unit.description || '' }); setShowUnitModal(true); }} style={iconBtn}>✏️</button>
                      <button onClick={e => { e.stopPropagation(); deleteUnit(unit.id); }} style={{ ...iconBtn, color: '#f56565' }}>🗑</button>
                    </div>
                  ))}
              </div>
            </div>

            {/* ── Materials ── */}
            <div style={col}>
              <div style={colHdr}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: textPri }}>📎 Materials {selectedUnitName ? `— ${selectedUnitName}` : ''}</span>
                <button style={addBtn} onClick={() => { if (!filterUnit) { flash('Select a unit first', true); return; } setMatForm(EMPTY_MATERIAL); setShowMatModal(true); }}>+ Add</button>
              </div>
              <div style={colBody}>
                {!filterUnit ? <div style={empty}>← Select a unit</div>
                  : materials.length === 0 ? <div style={empty}>No materials yet.<br />Add PDFs, videos or notes.</div>
                  : materials.map(mat => (
                    <div key={mat.id} style={{ ...item(false), flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: textPri }}>{mat.title}</div>
                        <button onClick={() => deleteMaterial(mat.id)} style={{ ...iconBtn, color: '#f56565' }}>🗑</button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', background: 'rgba(102,126,234,0.1)', color: '#8b9cf4', padding: '1px 7px', borderRadius: 6, border: '1px solid rgba(102,126,234,0.2)', textTransform: 'uppercase' }}>{mat.type}</span>
                        {mat.url && <a href={mat.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: '#667eea', textDecoration: 'none' }}>↗ Open</a>}
                      </div>
                      {mat.description && <div style={{ fontSize: '0.72rem', color: textMut }}>{mat.description}</div>}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showSubjModal && (
        <Modal title={editSubj ? 'Edit Subject' : 'Add Subject'} onClose={() => { setShowSubjModal(false); setEditSubj(null); }} surface={surface} border={border} textPri={textPri} textMut={textMut}>
          <FormField label="Subject Name *" textMut={textMut}><input value={subjForm.name} onChange={e => setSubjForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Data Structures" style={inp} /></FormField>
          <FormField label="Subject Code" textMut={textMut}><input value={subjForm.code} onChange={e => setSubjForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. CS3301" style={inp} /></FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="Department" textMut={textMut}><select value={subjForm.department} onChange={e => setSubjForm(f => ({ ...f, department: e.target.value }))} style={inp}>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></FormField>
            <FormField label="Semester" textMut={textMut}><select value={subjForm.semester} onChange={e => setSubjForm(f => ({ ...f, semester: e.target.value }))} style={inp}>{SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}</select></FormField>
          </div>
          <FormField label="Description" textMut={textMut}><textarea value={subjForm.description} onChange={e => setSubjForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} /></FormField>
          <ModalFooter onCancel={() => { setShowSubjModal(false); setEditSubj(null); }} onSave={saveSubject} saving={saving} label={editSubj ? 'Update' : 'Create'} border={border} textSec={textSec} />
        </Modal>
      )}

      {showUnitModal && (
        <Modal title={editUnit ? 'Edit Unit' : 'Add Unit'} onClose={() => { setShowUnitModal(false); setEditUnit(null); }} surface={surface} border={border} textPri={textPri} textMut={textMut}>
          <FormField label="Unit Number" textMut={textMut}><input type="number" min={1} value={unitForm.unit_number} onChange={e => setUnitForm(f => ({ ...f, unit_number: e.target.value }))} style={inp} /></FormField>
          <FormField label="Unit Title *" textMut={textMut}><input value={unitForm.title} onChange={e => setUnitForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Arrays and Linked Lists" style={inp} /></FormField>
          <FormField label="Description" textMut={textMut}><textarea value={unitForm.description} onChange={e => setUnitForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} /></FormField>
          <ModalFooter onCancel={() => { setShowUnitModal(false); setEditUnit(null); }} onSave={saveUnit} saving={saving} label={editUnit ? 'Update' : 'Add Unit'} border={border} textSec={textSec} />
        </Modal>
      )}

      {showMatModal && (
        <Modal title="Add Learning Material" onClose={() => setShowMatModal(false)} surface={surface} border={border} textPri={textPri} textMut={textMut}>
          <FormField label="Material Type" textMut={textMut}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {MAT_TYPES.map(t => (
                <button key={t.value} onClick={() => setMatForm(f => ({ ...f, type: t.value }))}
                  style={{ padding: '0.55rem', borderRadius: 8, border: `1px solid ${matForm.type === t.value ? 'rgba(102,126,234,0.4)' : border}`, background: matForm.type === t.value ? 'rgba(102,126,234,0.12)' : 'transparent', color: matForm.type === t.value ? '#8b9cf4' : textMut, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, textAlign: 'left' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </FormField>
          <FormField label="Title *" textMut={textMut}><input value={matForm.title} onChange={e => setMatForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Arrays Introduction" style={inp} /></FormField>
          {matForm.type !== 'text' && (
            <FormField label={`URL (${MAT_TYPES.find(t => t.value === matForm.type)?.hint})`} textMut={textMut}>
              <input value={matForm.url} onChange={e => setMatForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." style={inp} />
            </FormField>
          )}
          {matForm.type === 'text' && (
            <FormField label="Content *" textMut={textMut}><textarea value={matForm.content} onChange={e => setMatForm(f => ({ ...f, content: e.target.value }))} rows={6} style={{ ...inp, resize: 'vertical' }} /></FormField>
          )}
          <FormField label="Description (optional)" textMut={textMut}><input value={matForm.description} onChange={e => setMatForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief note" style={inp} /></FormField>
          <ModalFooter onCancel={() => setShowMatModal(false)} onSave={saveMaterial} saving={saving} label="Add Material" border={border} textSec={textSec} />
        </Modal>
      )}
    </div>
  );
}

// ── Shared modal components ───────────────────────────────────────────────────
function Modal({ title, onClose, children, surface, border, textPri }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: surface, borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 520, border: `1px solid ${border}`, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: textPri, margin: 0, fontSize: '1.05rem', fontWeight: 700, fontFamily: '"Inter",Arial,sans-serif' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: '1.4rem' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, children, textMut }) {
  return (
    <div>
      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: textMut, display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: '"Inter",Arial,sans-serif' }}>{label}</label>
      {children}
    </div>
  );
}

function ModalFooter({ onCancel, onSave, saving, label, border, textSec }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
      <button onClick={onCancel} style={{ padding: '0.6rem 1.25rem', background: 'transparent', color: textSec, border: `1px solid ${border}`, borderRadius: 8, cursor: 'pointer', fontFamily: '"Inter",Arial,sans-serif' }}>Cancel</button>
      <button onClick={onSave} disabled={saving} style={{ padding: '0.6rem 1.5rem', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: saving ? 0.7 : 1, fontFamily: '"Inter",Arial,sans-serif' }}>{saving ? 'Saving...' : label}</button>
    </div>
  );
}
