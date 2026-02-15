// src/pages/ProfileCompletionPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabaseClient';

export default function ProfileCompletionPage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [name,       setName]       = useState('');
  const [department, setDepartment] = useState('');
  const [year,       setYear]       = useState('');
  const [error,      setError]      = useState('');
  const [saving,     setSaving]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim())  { setError('Please enter your name'); return; }
    if (!department)   { setError('Please select your department'); return; }
    if (!year)         { setError('Please select your year'); return; }

    setSaving(true);
    setError('');

    try {
      // Simple update — row already exists from signup trigger
      const { error: err } = await supabase
        .from('profiles')
        .update({
          name:              name.trim(),
          department,
          year:              parseInt(year),
          profile_completed: true,
        })
        .eq('id', user.id);

      if (err) {
        // If update fails, try upsert as fallback
        const { error: err2 } = await supabase
          .from('profiles')
          .upsert({
            id:                user.id,
            email:             user.email,
            name:              name.trim(),
            department,
            year:              parseInt(year),
            role:              'STUDENT',
            profile_completed: true,
          });

        if (err2) {
          setError('Could not save profile: ' + err2.message);
          setSaving(false);
          return;
        }
      }

      // Refresh auth context so it sees the updated profile
      await refreshProfile();
      navigate('/dashboard', { replace: true });

    } catch (e) {
      setError('Unexpected error: ' + e.message);
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '2.5rem', width: '100%', maxWidth: 480, boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.8rem', fontWeight: 800, color: '#1F2937' }}>Complete Your Profile</h2>
        <p style={{ margin: '0 0 2rem', color: '#6B7280' }}>Just a few details to get started!</p>

        {error && (
          <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#374151' }}>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              disabled={saving}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#374151' }}>Department</label>
            <select value={department} onChange={e => setDepartment(e.target.value)} disabled={saving} style={inputStyle}>
              <option value="">Select department</option>
              <option value="CSE">Computer Science (CSE)</option>
              <option value="ECE">Electronics & Communication (ECE)</option>
              <option value="EEE">Electrical Engineering (EEE)</option>
              <option value="MECH">Mechanical Engineering (MECH)</option>
              <option value="CIVIL">Civil Engineering (CIVIL)</option>
              <option value="IT">Information Technology (IT)</option>
              <option value="AI-ML">Artificial Intelligence (AI-ML)</option>
            </select>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#374151' }}>Year</label>
            <select value={year} onChange={e => setYear(e.target.value)} disabled={saving} style={inputStyle}>
              <option value="">Select year</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>
          </div>

          <button type="submit" disabled={saving} style={{
            width: '100%', padding: '1rem',
            background: saving ? '#E5E7EB' : 'linear-gradient(135deg, #667eea, #764ba2)',
            color: saving ? '#9CA3AF' : 'white',
            border: 'none', borderRadius: 10,
            fontSize: '1rem', fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}>
            {saving ? 'Saving...' : "Let's Go! 🚀"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '0.75rem 1rem',
  border: '2px solid #E5E7EB', borderRadius: 8,
  fontSize: '1rem', outline: 'none',
  boxSizing: 'border-box', background: 'white',
  transition: 'border-color 0.2s',
};
