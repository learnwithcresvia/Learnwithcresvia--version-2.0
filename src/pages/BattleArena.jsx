import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import battleService from '../services/battleService';
import '../styles/battle.css';

export default function BattleArena() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [recentBattles, setRecentBattles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [battleConfig, setBattleConfig] = useState({
    language: 'python',
    difficulty: 'MEDIUM',
    totalRounds: 3,
    timeLimit: 180,
    battleType: '1V1',
  });

  useEffect(() => {
    loadBattles();
  }, []);

  const loadBattles = async () => {
    setLoading(true);
    const { data } = await battleService.getUserBattles(10);
    setRecentBattles(data || []);
    setLoading(false);
  };

  const handleCreateBattle = async (opponentType) => {
    const config = {
      ...battleConfig,
      opponentId: opponentType === 'bot' ? null : undefined,
      opponentName: opponentType === 'bot' ? 'Bot' : undefined,
    };

    const { data: battle, error } = await battleService.createBattle(config);

    if (error) {
      alert('Error creating battle: ' + error.message);
      return;
    }

    // Navigate to battle
    navigate(`/battle/${battle.id}`);
  };

  if (loading) {
    return (
      <div className="battle-loading">
        <div className="spinner"></div>
        <p>Loading Battle Arena...</p>
      </div>
    );
  }

  return (
    <div className="battle-arena">
      {/* Header */}
      <div className="battle-header">
        <div>
          <h1>⚔️ Battle Arena</h1>
          <p>Compete in timed coding challenges</p>
        </div>
        <Link to="/dashboard" className="btn-back">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Stats Section */}
      <div className="battle-stats-section">
        <div className="stat-card">
          <div className="stat-icon">🏆</div>
          <div className="stat-info">
            <div className="stat-value">{profile?.battles_won || 0}</div>
            <div className="stat-label">Wins</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⚔️</div>
          <div className="stat-info">
            <div className="stat-value">{profile?.total_battles || 0}</div>
            <div className="stat-label">Total Battles</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <div className="stat-value">
              {profile?.total_battles > 0 
                ? Math.round((profile.battles_won / profile.total_battles) * 100) 
                : 0}%
            </div>
            <div className="stat-label">Win Rate</div>
          </div>
        </div>
      </div>

      {/* Create Battle Section */}
      <div className="create-battle-section">
        <h2>Start a New Battle</h2>
        
        <div className="battle-modes">
          <div className="battle-mode-card" onClick={() => setShowCreateModal(true)}>
            <div className="mode-icon">🤖</div>
            <h3>vs Bot</h3>
            <p>Practice against AI opponent</p>
            <button className="btn-mode">Start Battle</button>
          </div>

          <div className="battle-mode-card disabled">
            <div className="mode-icon">👥</div>
            <h3>vs Player</h3>
            <p>Challenge other students</p>
            <button className="btn-mode" disabled>Coming Soon</button>
          </div>

          <div className="battle-mode-card disabled">
            <div className="mode-icon">🏆</div>
            <h3>Tournament</h3>
            <p>Compete in brackets</p>
            <button className="btn-mode" disabled>Coming Soon</button>
          </div>
        </div>
      </div>

      {/* Recent Battles */}
      {recentBattles.length > 0 && (
        <div className="recent-battles-section">
          <h2>Recent Battles</h2>
          <div className="battles-list">
            {recentBattles.map(battle => (
              <BattleCard key={battle.id} battle={battle} currentUserId={user.id} />
            ))}
          </div>
        </div>
      )}

      {/* Create Battle Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Configure Battle</h2>
              <button className="btn-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="config-group">
                <label>Language</label>
                <select 
                  value={battleConfig.language}
                  onChange={(e) => setBattleConfig({...battleConfig, language: e.target.value})}
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                </select>
              </div>

              <div className="config-group">
                <label>Difficulty</label>
                <select 
                  value={battleConfig.difficulty}
                  onChange={(e) => setBattleConfig({...battleConfig, difficulty: e.target.value})}
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>

              <div className="config-group">
                <label>Number of Questions</label>
                <select 
                  value={battleConfig.totalRounds}
                  onChange={(e) => setBattleConfig({...battleConfig, totalRounds: parseInt(e.target.value)})}
                >
                  <option value="1">1 Question</option>
                  <option value="3">3 Questions</option>
                  <option value="5">5 Questions</option>
                </select>
              </div>

              <div className="config-group">
                <label>Time per Question</label>
                <select 
                  value={battleConfig.timeLimit}
                  onChange={(e) => setBattleConfig({...battleConfig, timeLimit: parseInt(e.target.value)})}
                >
                  <option value="120">2 minutes</option>
                  <option value="180">3 minutes</option>
                  <option value="300">5 minutes</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="btn-create" onClick={() => {
                handleCreateBattle('bot');
                setShowCreateModal(false);
              }}>
                Start Battle vs Bot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BattleCard({ battle, currentUserId }) {
  const navigate = useNavigate();

  const isPlayer1 = battle.player1_id === currentUserId;
  const myScore = isPlayer1 ? battle.player1_score : battle.player2_score;
  const opponentScore = isPlayer1 ? battle.player2_score : battle.player1_score;
  const opponentName = isPlayer1 ? battle.player2_name : 'You';
  
  const didWin = battle.winner_id === currentUserId;
  const isDraw = battle.status === 'COMPLETED' && !battle.winner_id;

  const getStatusColor = () => {
    if (battle.status !== 'COMPLETED') return '#ffc107';
    if (isDraw) return '#999';
    return didWin ? '#28a745' : '#dc3545';
  };

  const getStatusText = () => {
    if (battle.status === 'IN_PROGRESS') return 'In Progress';
    if (battle.status === 'WAITING') return 'Waiting';
    if (isDraw) return 'Draw';
    return didWin ? 'Victory' : 'Defeat';
  };

  return (
    <div className="battle-card">
      <div className="battle-card-header">
        <span className="battle-language">{battle.language}</span>
        <span 
          className="battle-status"
          style={{ color: getStatusColor() }}
        >
          {getStatusText()}
        </span>
      </div>

      <div className="battle-score">
        <div className="score-player">
          <div className="player-name">You</div>
          <div className="player-score">{myScore}</div>
        </div>
        <div className="score-vs">VS</div>
        <div className="score-player">
          <div className="player-name">{opponentName}</div>
          <div className="player-score">{opponentScore}</div>
        </div>
      </div>

      <div className="battle-card-footer">
        <span className="battle-date">
          {new Date(battle.created_at).toLocaleDateString()}
        </span>
        {battle.status === 'IN_PROGRESS' && (
          <button 
            className="btn-resume-battle"
            onClick={() => navigate(`/battle/${battle.id}`)}
          >
            Resume
          </button>
        )}
      </div>
    </div>
  );
}
