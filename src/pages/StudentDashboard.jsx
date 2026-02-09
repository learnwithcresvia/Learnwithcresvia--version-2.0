import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabaseClient';
import '../styles/dashboard.css';

export default function StudentDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [stats, setStats] = useState(null);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [leaderboardPosition, setLeaderboardPosition] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      loadDashboardData();
    }
  }, [profile]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load recent submissions
      const { data: submissions } = await supabase
        .from('submissions')
        .select('*, challenge:challenges(title, difficulty, mode)')
        .eq('user_id', user.id)
        .order('submitted_at', { ascending: false })
        .limit(5);

      setRecentSubmissions(submissions || []);

      // Load achievements
      const { data: userAchievements } = await supabase
        .from('user_achievements')
        .select('*, achievement:achievements(*)')
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false })
        .limit(3);

      setAchievements(userAchievements || []);

      // Calculate additional stats
      const { data: allSubmissions } = await supabase
        .from('submissions')
        .select('status')
        .eq('user_id', user.id);

      const successRate = allSubmissions?.length > 0 
        ? Math.round((allSubmissions.filter(s => s.status === 'PASSED').length / allSubmissions.length) * 100)
        : 0;

      setStats({
        ...profile,
        successRate,
        totalAttempts: allSubmissions?.length || 0,
      });

      // Get leaderboard position
      const { count: globalCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'STUDENT')
        .gt('xp', profile.xp);

      const { count: deptCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('department', profile.department)
        .eq('role', 'STUDENT')
        .gt('xp', profile.xp);

      setLeaderboardPosition({
        global: (globalCount || 0) + 1,
        department: (deptCount || 0) + 1,
      });

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

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
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>🎓 LearnWithCresvia</h1>
        </div>
        <nav className="header-nav">
          <Link to="/dashboard" className="nav-link active">Dashboard</Link>
          <Link to="/battle-arena" className="nav-link">Battle</Link>
          <Link to="/practice-hub" className="nav-link">Practice</Link>
          <Link to="/leaderboard" className="nav-link">Leaderboard</Link>
        </nav>
        <div className="header-right">
          <span className="user-name">{profile?.name}</span>
          <button onClick={handleSignOut} className="btn-logout">
            Sign Out
          </button>
        </div>
      </header>

      <div className="dashboard-container">
        {/* Welcome Section */}
        <section className="welcome-section">
          <div className="welcome-content">
            <h2>Welcome back, {profile?.name?.split(' ')[0]}! 👋</h2>
            <p className="subtitle">
              {profile.department} • Year {profile.year}
              {profile.batch && ` • Section ${profile.batch}`}
            </p>
          </div>
          <div className="welcome-actions">
            <Link to="/battle-arena" className="btn-cta battle">
              ⚔️ Start Battle
            </Link>
            <Link to="/practice-hub" className="btn-cta practice">
              📚 Practice
            </Link>
          </div>
        </section>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card xp-card">
            <div className="stat-header">
              <div className="stat-icon">⚡</div>
              <span className="stat-label">Total XP</span>
            </div>
            <div className="stat-value">{stats?.xp || 0}</div>
            <div className="stat-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${(stats?.xp % 100)}%` }}
                ></div>
              </div>
              <small>{stats?.xp % 100}/100 to next level</small>
            </div>
          </div>

          <div className="stat-card streak-card">
            <div className="stat-header">
              <div className="stat-icon">🔥</div>
              <span className="stat-label">Streak</span>
            </div>
            <div className="stat-value">{stats?.current_streak || 0} days</div>
            <small>Best: {stats?.longest_streak || 0} days</small>
          </div>

          <div className="stat-card battles-card">
            <div className="stat-header">
              <div className="stat-icon">⚔️</div>
              <span className="stat-label">Battles</span>
            </div>
            <div className="stat-value">
              {stats?.battles_won || 0}/{stats?.total_battles || 0}
            </div>
            <small>
              {stats?.total_battles > 0 
                ? `${Math.round((stats.battles_won / stats.total_battles) * 100)}% win rate`
                : 'No battles yet'}
            </small>
          </div>

          <div className="stat-card success-card">
            <div className="stat-header">
              <div className="stat-icon">🎯</div>
              <span className="stat-label">Success Rate</span>
            </div>
            <div className="stat-value">{stats?.successRate || 0}%</div>
            <small>{stats?.challenges_completed || 0} completed</small>
          </div>
        </div>

        {/* Main Content */}
        <div className="content-grid">
          {/* Left Column */}
          <div className="left-column">
            {/* Recent Activity */}
            <section className="section-card">
              <h3>📝 Recent Activity</h3>
              {recentSubmissions.length > 0 ? (
                <div className="activity-list">
                  {recentSubmissions.map((submission) => (
                    <div key={submission.id} className="activity-item">
                      <div className={`status-icon ${submission.status.toLowerCase()}`}>
                        {submission.status === 'PASSED' ? '✅' : '❌'}
                      </div>
                      <div className="activity-details">
                        <h4>{submission.challenge?.title}</h4>
                        <div className="activity-meta">
                          <span className={`badge ${submission.challenge?.difficulty.toLowerCase()}`}>
                            {submission.challenge?.difficulty}
                          </span>
                          <span className="mode-badge">{submission.challenge?.mode}</span>
                          <span className="test-results">
                            {submission.passed_tests}/{submission.total_tests} tests
                          </span>
                        </div>
                        <small className="timestamp">
                          {new Date(submission.submitted_at).toLocaleString()}
                        </small>
                      </div>
                      {submission.xp_earned > 0 && (
                        <div className="xp-badge">+{submission.xp_earned} XP</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">🚀</div>
                  <p>No submissions yet</p>
                  <Link to="/battle-arena" className="btn-start">
                    Start Your First Challenge
                  </Link>
                </div>
              )}
            </section>
          </div>

          {/* Right Column */}
          <div className="right-column">
            {/* Rank Card */}
            <section className="section-card rank-card">
              <h3>🏆 Your Rank</h3>
              <div className="rank-grid">
                <div className="rank-item">
                  <div className="rank-number">#{leaderboardPosition?.global || '—'}</div>
                  <p>Global</p>
                </div>
                <div className="rank-item">
                  <div className="rank-number">#{leaderboardPosition?.department || '—'}</div>
                  <p>{profile?.department}</p>
                </div>
              </div>
              <Link to="/leaderboard" className="link-more">
                View Leaderboard →
              </Link>
            </section>

            {/* Achievements */}
            <section className="section-card">
              <h3>🏅 Recent Achievements</h3>
              {achievements.length > 0 ? (
                <div className="achievement-list">
                  {achievements.map((item) => (
                    <div key={item.achievement_id} className="achievement-item">
                      <div 
                        className="achievement-badge"
                        style={{ backgroundColor: item.achievement.badge_color }}
                      >
                        {item.achievement.icon}
                      </div>
                      <div className="achievement-info">
                        <h4>{item.achievement.name}</h4>
                        <p>{item.achievement.description}</p>
                        <small>+{item.achievement.xp_reward} XP</small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state-small">
                  <p>Complete challenges to unlock achievements!</p>
                </div>
              )}
            </section>

            {/* Quick Stats */}
            <section className="section-card">
              <h3>📊 Stats</h3>
              <div className="stats-list">
                <div className="stats-row">
                  <span>Total Attempts</span>
                  <strong>{stats?.totalAttempts || 0}</strong>
                </div>
                <div className="stats-row">
                  <span>Completed</span>
                  <strong>{stats?.challenges_completed || 0}</strong>
                </div>
                <div className="stats-row">
                  <span>Success Rate</span>
                  <strong>{stats?.successRate || 0}%</strong>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
