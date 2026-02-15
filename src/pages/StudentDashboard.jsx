// src/pages/StudentDashboard.jsx - FINAL CLEAN VERSION

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabaseClient';
import '../styles/dashboard.css';

export default function StudentDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [stats,              setStats]              = useState(null);
  const [recentSubmissions,  setRecentSubmissions]  = useState([]);
  const [leaderboardPosition,setLeaderboardPosition]= useState(null);
  const [loading,            setLoading]            = useState(true);

  useEffect(() => {
    // Always call — function handles null profile gracefully
    loadDashboardData();
  }, [profile]);

  async function loadDashboardData() {
    if (!user) { setLoading(false); return; }
    try {
      setLoading(true);

      // Recent practice attempts
      const { data: submissions } = await supabase
        .from('practice_attempts')
        .select('*, question:questions(title, difficulty, topic)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentSubmissions(submissions || []);

      // Stats
      const { data: allAttempts } = await supabase
        .from('practice_attempts')
        .select('is_correct')
        .eq('user_id', user.id);

      const total   = allAttempts?.length || 0;
      const correct = allAttempts?.filter(a => a.is_correct).length || 0;

      setStats({
        ...(profile || {}),  
        totalAttempts: total,
        successRate:   total > 0 ? Math.round((correct / total) * 100) : 0,
      });

      // Leaderboard position
      const { count: above } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'STUDENT')
        .gt('xp', profile?.xp || 0);

      setLeaderboardPosition((above || 0) + 1);

    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  // ✅ Sign out — simple and direct
  async function handleSignOut() {
    try {
      await Promise.race([
        signOut(),
        new Promise(r => setTimeout(r, 1500))
      ]);
    } catch {}
    window.location.href = '/login';
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">

      {/* ── Header ── */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>🎓 LearnWithCresvia</h1>
        </div>

        <nav className="header-nav">
          <Link to="/dashboard"    className="nav-link active">Dashboard</Link>
          <Link to="/practice-hub" className="nav-link">Practice</Link>
          <Link to="/battle-arena" className="nav-link">Battle</Link>
          <Link to="/leaderboard"  className="nav-link">Leaderboard</Link>
        </nav>

        <div className="header-right">
          <span className="user-name">{profile?.name || user?.email}</span>
          {profile?.role === 'ADMIN' && (
            <Link to="/admin" className="btn-admin">👑 Admin</Link>
          )}
          <button onClick={handleSignOut} className="btn-logout">
            Sign Out
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="dashboard-container">

        {/* Welcome */}
        <div className="welcome-section">
          <div className="welcome-content">
            <h2>Welcome back, {profile?.name?.split(' ')[0] || 'there'}! 👋</h2>
            <p className="subtitle">{profile?.department} · Year {profile?.year}</p>
          </div>
          <div className="welcome-actions">
            <Link to="/language-survey" className="btn-cta practice">🚀 Start Practice</Link>
            <Link to="/battle-arena" className="btn-cta battle">⚔️ Battle</Link>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon">⭐</div>
              <div className="stat-label">Total XP</div>
            </div>
            <div className="stat-value">{profile?.xp || 0}</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon">✅</div>
              <div className="stat-label">Questions Solved</div>
            </div>
            <div className="stat-value">{profile?.challenges_completed || 0}</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon">⚔️</div>
              <div className="stat-label">Battles Won</div>
            </div>
            <div className="stat-value">{profile?.battles_won || 0}</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon">📊</div>
              <div className="stat-label">Success Rate</div>
            </div>
            <div className="stat-value">{stats?.successRate || 0}%</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon">🏆</div>
              <div className="stat-label">Global Rank</div>
            </div>
            <div className="stat-value">#{leaderboardPosition || '—'}</div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="section-card">
          <h3>📋 Recent Activity</h3>
          {recentSubmissions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🚀</div>
              <p>No activity yet. Start your first practice session!</p>
              <Link to="/practice-hub" className="btn-start">Start Practicing</Link>
            </div>
          ) : (
            <div className="activity-list">
              {recentSubmissions.map(attempt => (
                <div key={attempt.id} className="activity-item">
                  <div className="status-icon">{attempt.is_correct ? '✅' : '❌'}</div>
                  <div className="activity-details">
                    <h4>{attempt.question?.title || 'Question'}</h4>
                    <div className="activity-meta">
                      <span className={`badge ${attempt.question?.difficulty?.toLowerCase()}`}>
                        {attempt.question?.difficulty}
                      </span>
                      {attempt.question?.topic && (
                        <span className="mode-badge">{attempt.question.topic}</span>
                      )}
                    </div>
                    <span className="test-results">
                      {attempt.is_correct ? `+${attempt.points_earned} XP` : 'Incorrect'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
