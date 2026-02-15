import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabaseClient';
import '../styles/leaderboard.css';

export default function Leaderboard() {
  const { profile } = useAuth();
  
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    department: '',
    year: '',
    period: 'all-time',
  });

  useEffect(() => {
    loadLeaderboard();
  }, [filters]);

  const loadLeaderboard = async () => {
    setLoading(true);

    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'STUDENT')
        .order('xp', { ascending: false })
        .limit(100);

      if (filters.department) {
        query = query.eq('department', filters.department);
      }

      if (filters.year) {
        query = query.eq('year', parseInt(filters.year));
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calculate ranks
      const rankedData = data.map((user, index) => ({
        ...user,
        rank: index + 1,
        winRate: user.total_battles > 0 
          ? Math.round((user.battles_won / user.total_battles) * 100) 
          : 0,
      }));

      setLeaderboard(rankedData);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const departments = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AI-ML'];
  const years = ['1', '2', '3', '4'];

  if (loading) {
    return (
      <div className="leaderboard-loading">
        <div className="spinner"></div>
        <p>Loading leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="leaderboard">
      {/* Header */}
      <div className="leaderboard-header">
        <div>
          <h1>🏆 Leaderboard</h1>
          <p>Top performers in coding challenges</p>
        </div>
        <Link to="/dashboard" className="btn-back">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Filters */}
      <div className="leaderboard-filters">
        <div className="filter-group">
          <label>Department</label>
          <select 
            value={filters.department}
            onChange={(e) => setFilters({...filters, department: e.target.value})}
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Year</label>
          <select 
            value={filters.year}
            onChange={(e) => setFilters({...filters, year: e.target.value})}
          >
            <option value="">All Years</option>
            {years.map(year => (
              <option key={year} value={year}>Year {year}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Period</label>
          <select 
            value={filters.period}
            onChange={(e) => setFilters({...filters, period: e.target.value})}
          >
            <option value="all-time">All Time</option>
            <option value="this-month">This Month</option>
            <option value="this-week">This Week</option>
          </select>
        </div>

        <button className="btn-reset" onClick={() => setFilters({ department: '', year: '', period: 'all-time' })}>
          Reset Filters
        </button>
      </div>

      {/* Top 3 Podium */}
      {leaderboard.length >= 3 && (
        <div className="podium-section">
          <div className="podium-card second">
            <div className="podium-medal">🥈</div>
            <div className="podium-rank">#2</div>
            <div className="podium-name">{leaderboard[1].name}</div>
            <div className="podium-xp">{leaderboard[1].xp} XP</div>
          </div>

          <div className="podium-card first">
            <div className="podium-medal">🥇</div>
            <div className="podium-rank">#1</div>
            <div className="podium-name">{leaderboard[0].name}</div>
            <div className="podium-xp">{leaderboard[0].xp} XP</div>
          </div>

          <div className="podium-card third">
            <div className="podium-medal">🥉</div>
            <div className="podium-rank">#3</div>
            <div className="podium-name">{leaderboard[2].name}</div>
            <div className="podium-xp">{leaderboard[2].xp} XP</div>
          </div>
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="leaderboard-table-container">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Department</th>
              <th>Year</th>
              <th>XP</th>
              <th>Streak</th>
              <th>Battles</th>
              <th>Win Rate</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((user) => (
              <tr 
                key={user.id} 
                className={user.id === profile?.id ? 'current-user' : ''}
              >
                <td className="rank-cell">
                  {user.rank <= 3 ? (
                    <span className="rank-medal">
                      {user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : '🥉'}
                    </span>
                  ) : (
                    <span className="rank-number">#{user.rank}</span>
                  )}
                </td>
                <td className="name-cell">
                  {user.name}
                  {user.id === profile?.id && <span className="you-badge">You</span>}
                </td>
                <td>{user.department}</td>
                <td>Year {user.year}</td>
                <td className="xp-cell">
                  <span className="xp-value">{user.xp}</span>
                </td>
                <td>
                  {user.current_streak > 0 && (
                    <span className="streak-badge">
                      🔥 {user.current_streak}
                    </span>
                  )}
                </td>
                <td>
                  <span className="battle-stats">
                    {user.battles_won}/{user.total_battles}
                  </span>
                </td>
                <td>
                  <span className={`win-rate ${user.winRate >= 70 ? 'high' : user.winRate >= 40 ? 'medium' : 'low'}`}>
                    {user.winRate}%
                  </span>
                </td>
                <td>{user.challenges_completed}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {leaderboard.length === 0 && (
          <div className="empty-leaderboard">
            <p>No students found with these filters</p>
            <button onClick={() => setFilters({ department: '', year: '', period: 'all-time' })}>
              Show All
            </button>
          </div>
        )}
      </div>

      {/* Your Position (if not in top 10) */}
      {profile && !leaderboard.slice(0, 10).find(u => u.id === profile.id) && (
        <div className="your-position">
          <h3>Your Position</h3>
          <div className="position-card">
            <div className="position-rank">
              #{leaderboard.findIndex(u => u.id === profile.id) + 1}
            </div>
            <div className="position-details">
              <div className="position-name">{profile.name}</div>
              <div className="position-stats">
                {profile.xp} XP • {profile.challenges_completed} Completed
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
