// src/pages/LanguageSurvey.jsx
// Survey 1: Which language do you want to learn?

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabaseClient';

const LANGUAGES = [
  { id: 'python',     label: 'Python',      icon: '🐍', desc: 'Great for beginners, AI/ML, data science' },
  { id: 'javascript', label: 'JavaScript',  icon: '⚡', desc: 'Web development, frontend & backend' },
  { id: 'java',       label: 'Java',        icon: '☕', desc: 'Enterprise apps, Android development' },
  { id: 'cpp',        label: 'C++',         icon: '⚙️', desc: 'Systems programming, competitive coding' },
];

export default function LanguageSurvey() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [selected, setSelected] = useState('');
  const [saving,   setSaving]   = useState(false);

  async function handleNext() {
    if (!selected) return;
    setSaving(true);

    // Save language preference to profile
    await supabase
      .from('profiles')
      .update({ preferred_language: selected })
      .eq('id', user.id);

    // Go to knowledge quiz
    navigate(`/knowledge-quiz?lang=${selected}`);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.step}>Step 1 of 2</div>
        <h1 style={styles.title}>What do you want to learn? 🎯</h1>
        <p style={styles.sub}>Choose your programming language to get personalised questions</p>

        <div style={styles.grid}>
          {LANGUAGES.map(lang => (
            <div
              key={lang.id}
              onClick={() => setSelected(lang.id)}
              style={{
                ...styles.langCard,
                ...(selected === lang.id ? styles.langCardSelected : {}),
              }}
            >
              <div style={styles.langIcon}>{lang.icon}</div>
              <div style={styles.langLabel}>{lang.label}</div>
              <div style={styles.langDesc}>{lang.desc}</div>
              {selected === lang.id && <div style={styles.check}>✓</div>}
            </div>
          ))}
        </div>

        <button
          onClick={handleNext}
          disabled={!selected || saving}
          style={{
            ...styles.btn,
            ...(selected ? styles.btnActive : styles.btnDisabled),
          }}
        >
          {saving ? 'Saving...' : 'Next: Knowledge Check →'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '2rem',
  },
  card: {
    background: 'white', borderRadius: 20, padding: '2.5rem',
    width: '100%', maxWidth: 640,
    boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
    textAlign: 'center',
  },
  step: {
    background: '#EEF2FF', color: '#6366F1', padding: '4px 12px',
    borderRadius: 20, fontSize: 13, fontWeight: 600,
    display: 'inline-block', marginBottom: '1rem',
  },
  title: { fontSize: '1.8rem', fontWeight: 800, color: '#1F2937', margin: '0 0 0.5rem' },
  sub:   { color: '#6B7280', marginBottom: '2rem', fontSize: '1rem' },
  grid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' },
  langCard: {
    border: '2px solid #E5E7EB', borderRadius: 12, padding: '1.5rem',
    cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
    textAlign: 'left',
  },
  langCardSelected: {
    border: '2px solid #6366F1', background: '#EEF2FF',
    transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
  },
  langIcon:  { fontSize: '2rem', marginBottom: '0.5rem' },
  langLabel: { fontWeight: 700, fontSize: '1.1rem', color: '#1F2937', marginBottom: '0.25rem' },
  langDesc:  { fontSize: '0.8rem', color: '#6B7280' },
  check: {
    position: 'absolute', top: 10, right: 10,
    background: '#6366F1', color: 'white',
    width: 22, height: 22, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700,
  },
  btn: {
    width: '100%', padding: '1rem', borderRadius: 10,
    border: 'none', fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
    transition: 'all 0.2s',
  },
  btnActive:   { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white' },
  btnDisabled: { background: '#E5E7EB', color: '#9CA3AF', cursor: 'not-allowed' },
};
