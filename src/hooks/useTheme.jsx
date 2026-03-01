// src/hooks/useTheme.jsx
import { useState, useEffect, createContext, useContext } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('cresvia_theme') || 'light'; } catch { return 'light'; }
  });

  useEffect(() => {
    try { localStorage.setItem('cresvia_theme', theme); } catch {}
  }, [theme]);

  const toggle  = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  const isDark  = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, toggle, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Graceful fallback if used outside provider
    return { theme: 'light', toggle: () => {}, isDark: false };
  }
  return ctx;
}

// ── Toggle button — drop anywhere ────────────────────────────────────────────
export function ThemeToggle({ style = {} }) {
  const { isDark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      style={{
        padding: '0.4rem 0.875rem',
        background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}`,
        borderRadius: 20,
        cursor: 'pointer',
        fontSize: '0.82rem',
        color: isDark ? '#e2e8f0' : '#374151',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        fontFamily: '"Inter", Arial, sans-serif',
        fontWeight: 600,
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {isDark ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}

// ── Theme-aware style helper ──────────────────────────────────────────────────
// Returns an object of common styles that flip between dark/light automatically.
// Usage:  const T = useThemeStyles();
//         <div style={{ ...T.page }}>
export function useThemeStyles() {
  const { isDark } = useTheme();

  return {
    isDark,
    // Page background
    page: {
      minHeight: '100vh',
      background: isDark ? '#0f1117' : '#F0F4FF',
      fontFamily: 'Arial, sans-serif',
      color: isDark ? '#e2e8f0' : '#1F2937',
    },
    // Card / panel
    card: {
      background: isDark ? '#141720' : 'white',
      borderRadius: 14,
      padding: '1.5rem',
      boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.07)',
    },
    // Table header cell
    th: {
      padding: '0.75rem 1rem',
      textAlign: 'left',
      color: isDark ? '#4a5568' : '#6B7280',
      fontWeight: 600,
      fontSize: '0.82rem',
      borderBottom: `1px solid ${isDark ? '#1e2433' : '#E5E7EB'}`,
      background: isDark ? '#0f1117' : '#F9FAFB',
    },
    // Table data cell
    td: {
      padding: '0.75rem 1rem',
      fontSize: '0.88rem',
      borderBottom: `1px solid ${isDark ? '#1e2433' : '#F3F4F6'}`,
      color: isDark ? '#a0aec0' : '#374151',
    },
    // Table row alternating
    rowEven: { background: isDark ? '#141720' : 'white' },
    rowOdd:  { background: isDark ? '#0f1117' : '#F9FAFB' },
    // Input / select / textarea
    input: {
      width: '100%',
      padding: '0.6rem 0.9rem',
      border: `1.5px solid ${isDark ? '#2d3748' : '#E5E7EB'}`,
      borderRadius: 8,
      fontSize: '0.9rem',
      outline: 'none',
      boxSizing: 'border-box',
      background: isDark ? 'rgba(255,255,255,0.05)' : 'white',
      color: isDark ? '#e2e8f0' : '#1F2937',
      fontFamily: 'Arial, sans-serif',
    },
    // Text colours
    textPrimary:   isDark ? '#e2e8f0' : '#1F2937',
    textSecondary: isDark ? '#a0aec0' : '#6B7280',
    textMuted:     isDark ? '#4a5568' : '#9CA3AF',
    border:        isDark ? '#1e2433' : '#E5E7EB',
    surface:       isDark ? '#141720' : 'white',
    surfaceAlt:    isDark ? '#0f1117' : '#F9FAFB',
  };
}
