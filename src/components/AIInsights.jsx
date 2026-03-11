// src/components/AIInsights.jsx
// Gemini-powered insights — MANUAL TRIGGER ONLY (no auto-load on mount)
// Caches results in Supabase ai_cache table to save API quota

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../utils/supabaseClient';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function callGemini(prompt) {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) throw new Error('Gemini API key not configured');
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
    }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `Gemini ${res.status}`); }
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Cache key per user+role so insights are personalized but still cached
function getCacheKey(userId, mode) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `insights_${mode}_${userId}_${today}`;
}

export default function AIInsights({ mode = 'student' }) {
  const { user, profile } = useAuth();
  const { isDark } = useTheme();

  const [insights,   setInsights]   = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [fromCache,  setFromCache]  = useState(false);
  const [generated,  setGenerated]  = useState(false);

  async function generateInsights() {
    if (!user || !profile) return;
    setLoading(true); setError(''); setFromCache(false);

    try {
      // 1. Check Supabase cache (cached per user per day)
      const cacheKey = getCacheKey(user.id, mode);
      const { data: cached } = await supabase
        .from('ai_cache')
        .select('content, updated_at')
        .eq('unit_id', null)          // insights have no unit_id
        .eq('type', cacheKey)
        .maybeSingle().catch(() => ({ data: null }));

      if (cached) {
        setInsights(JSON.parse(cached.content));
        setFromCache(true);
        setGenerated(true);
        setLoading(false);
        return;
      }

      // 2. Build prompt based on role
      let prompt = '';
      if (mode === 'student') {
        prompt = `You are a helpful academic coach. A student has these stats:
- Name: ${profile.name || 'Student'}
- Department: ${profile.department || 'CSE'}
- Year: ${profile.year || 1}
- Total XP: ${profile.xp || 0}
- Questions Solved: ${profile.challenges_completed || 0}
- Battles Won: ${profile.battles_won || 0}

Give exactly 3 short, actionable, motivating insights to help them improve. 
Format as JSON array only, no markdown:
[{"icon":"emoji","title":"short title","tip":"1-2 sentence actionable advice"}]`;
      } else {
        prompt = `You are an academic advisor. A staff member manages:
- Department: ${profile.department || 'CSE'}
- Role: ${profile.role}

Give exactly 3 short insights about improving student engagement and coding performance.
Format as JSON array only, no markdown:
[{"icon":"emoji","title":"short title","tip":"1-2 sentence actionable advice"}]`;
      }

      // 3. Call Gemini
      const raw     = await callGemini(prompt);
      const clean   = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      const parsed  = JSON.parse(clean.match(/\[[\s\S]*\]/)?.[0] || clean);

      setInsights(parsed);
      setGenerated(true);

      // 4. Cache for today (store with null unit_id, type = cache key)
      await supabase.from('ai_cache').upsert(
        { unit_id: null, type: cacheKey, content: JSON.stringify(parsed), updated_at: new Date().toISOString() },
        { onConflict: 'unit_id,type' }
      ).catch(() => {}); // don't block on cache write failure

    } catch (e) {
      setError(e.message.includes('quota') || e.message.includes('429')
        ? '⚠️ API limit reached. Try again tomorrow or switch to mobile data.'
        : '⚠️ ' + e.message
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Theme ─────────────────────────────────────────────────────────────────────
  const bg      = isDark ? '#141720' : '#ffffff';
  const border  = isDark ? '#1e2433' : '#e5e7eb';
  const textPri = isDark ? '#e2e8f0' : '#1e293b';
  const textSec = isDark ? '#a0aec0' : '#64748b';
  const textMut = isDark ? '#4a5568' : '#94a3b8';

  // ── Not yet triggered — show the prompt button ────────────────────────────────
  if (!generated && !loading) {
    return (
      <div style={{ background: isDark ? 'rgba(102,126,234,0.06)' : 'rgba(79,70,229,0.03)', border: `1px dashed ${isDark ? 'rgba(102,126,234,0.2)' : 'rgba(79,70,229,0.15)'}`, borderRadius: 14, padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <div style={{ fontWeight: 700, color: textPri, fontSize: '0.9rem', marginBottom: '0.2rem' }}>✨ AI Insights</div>
          <div style={{ color: textMut, fontSize: '0.8rem' }}>Get personalized tips based on your progress — generated once per day</div>
        </div>
        <button
          onClick={generateInsights}
          style={{ padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: '"Inter",Arial,sans-serif' }}
        >
          ✨ Generate
        </button>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', color: textSec }}>
          <div style={{ width: 18, height: 18, border: `2px solid ${border}`, borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: '0.875rem' }}>Generating your insights...</span>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ background: 'rgba(245,101,101,0.08)', border: '1px solid rgba(245,101,101,0.2)', borderRadius: 14, padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#f56565', fontSize: '0.875rem' }}>{error}</span>
        <button onClick={generateInsights} style={{ background: 'none', border: '1px solid rgba(245,101,101,0.3)', color: '#f56565', borderRadius: 7, padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.78rem' }}>Retry</button>
      </div>
    );
  }

  // ── Insights cards ────────────────────────────────────────────────────────────
  if (!insights?.length) return null;

  const colors = ['#667eea', '#48bb78', '#ed8936'];

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 700, color: textPri, fontSize: '0.875rem' }}>✨ AI Insights</span>
          {fromCache && (
            <span style={{ fontSize: '0.68rem', color: '#48bb78', background: 'rgba(72,187,120,0.1)', padding: '1px 7px', borderRadius: 6, border: '1px solid rgba(72,187,120,0.2)', fontWeight: 600 }}>
              ⚡ from cache
            </span>
          )}
        </div>
        <button
          onClick={generateInsights}
          style={{ background: 'none', border: `1px solid ${border}`, color: textMut, borderRadius: 7, padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.72rem' }}
        >
          ↺ Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.875rem' }}>
        {insights.map((insight, i) => (
          <div key={i} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '1rem', borderTop: `3px solid ${colors[i] || '#667eea'}` }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{insight.icon}</div>
            <div style={{ fontWeight: 700, color: textPri, fontSize: '0.85rem', marginBottom: '0.35rem' }}>{insight.title}</div>
            <div style={{ color: textSec, fontSize: '0.8rem', lineHeight: 1.6 }}>{insight.tip}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
