// src/pages/BattleArena.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import battleService from '../services/battleService';

export default function BattleArena() {
  const { user, profile } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [recentBattles,   setRecentBattles]   = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [modal,           setModal]           = useState(null); // 'bot' | 'create' | 'join'
  const [roomCode,        setRoomCode]        = useState('');
  const [joinCode,        setJoinCode]        = useState('');
  const [joining,         setJoining]         = useState(false);
  const [creating,        setCreating]        = useState(false);
  const [error,           setError]           = useState('');
  const [lastResult,      setLastResult]      = useState(location.state?.result || null);

  const [battleConfig, setBattleConfig] = useState({
    language:    'python',
    difficulty:  'MEDIUM',
    totalRounds: 3,
    timeLimit:   180,
  });

  useEffect(() => { loadBattles(); }, []);

  async function loadBattles() {
    setLoading(true);
    const { data } = await battleService.getUserBattles(10);
    setRecentBattles(data || []);
    setLoading(false);
  }

  // ── Create vs Bot ───────────────────────────────────────────────────────────
  async function handleCreateBot() {
    setCreating(true);
    setError('');
    const { data, error } = await battleService.createBattle({ ...battleConfig, isPlayerVsPlayer: false });
    setCreating(false);
    if (error) { setError(error.message); return; }
    navigate(`/battle/${data.id}`);
  }

  // ── Create P vs P room ──────────────────────────────────────────────────────
  async function handleCreateRoom() {
    setCreating(true);
    setError('');
    const { data, error } = await battleService.createBattle({ ...battleConfig, isPlayerVsPlayer: true });
    setCreating(false);
    if (error) { setError(error.message); return; }
    setRoomCode(data.room_code);
    // Navigate to battle — it will show "waiting for opponent" screen
    navigate(`/battle/${data.id}?host=true&code=${data.room_code}`);
  }

  // ── Join P vs P room ────────────────────────────────────────────────────────
  async function handleJoinRoom() {
    if (!joinCode.trim()) return;
    setJoining(true);
    setError('');
    const { data, error } = await battleService.joinByRoomCode(joinCode.trim());
    setJoining(false);
    if (error) { setError(error.message); return; }
    navigate(`/battle/${data.id}`);
  }

  if (loading) return (
    <div style={styles.centered}>
      <div style={styles.spinner} />
      <p style={{ color: '#90CDF4', marginTop: '1rem' }}>Loading Battle Arena...</p>
    </div>
  );

  return (
    <div style={styles.page}>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>⚔️ Battle Arena</h1>
          <p style={styles.subtitle}>Compete in timed coding challenges</p>
        </div>
        <Link to="/dashboard" style={styles.backBtn}>← Dashboard</Link>
      </div>

      {/* Last Battle Result Banner */}
      {lastResult && (
        <div style={{ ...styles.resultBanner, background: lastResult.didWin ? '#14532d' : lastResult.isDraw ? '#374151' : '#7f1d1d' }}>
          <span style={{ fontSize: '1.5rem' }}>{lastResult.didWin ? '🏆' : lastResult.isDraw ? '🤝' : '💀'}</span>
          <div>
            <div style={{ fontWeight: 700, color: 'white' }}>
              {lastResult.didWin ? 'Victory!' : lastResult.isDraw ? 'Draw!' : 'Defeat!'}
            </div>
            <div style={{ color: '#CBD5E0', fontSize: '0.85rem' }}>
              {lastResult.myScore} vs {lastResult.opponentScore} · +{lastResult.xpEarned} XP earned
            </div>
          </div>
          <button onClick={() => setLastResult(null)} style={styles.dismissBtn}>✕</button>
        </div>
      )}

      {/* Stats */}
      <div style={styles.statsRow}>
        {[
          { icon: '🏆', value: profile?.battles_won  || 0, label: 'Wins'   },
          { icon: '⚔️', value: profile?.total_battles || 0, label: 'Battles' },
          { icon: '📊', value: profile?.total_battles > 0 ? Math.round((profile.battles_won / profile.total_battles) * 100) + '%' : '0%', label: 'Win Rate' },
        ].map(s => (
          <div key={s.label} style={styles.statCard}>
            <span style={{ fontSize: '2rem' }}>{s.icon}</span>
            <div style={styles.statValue}>{s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Battle Modes */}
      <h2 style={styles.sectionTitle}>Start a Battle</h2>
      <div style={styles.modesRow}>

        {/* vs Bot */}
        <div style={styles.modeCard}>
          <div style={styles.modeIcon}>🤖</div>
          <h3 style={styles.modeName}>vs Bot</h3>
          <p style={styles.modeDesc}>Practice against AI. No waiting, start instantly.</p>
          <button style={styles.modeBtn} onClick={() => { setModal('bot'); setError(''); }}>
            Start Battle
          </button>
        </div>

        {/* vs Player */}
        <div style={{ ...styles.modeCard, borderColor: '#667eea' }}>
          <div style={styles.modeIcon}>👥</div>
          <h3 style={styles.modeName}>vs Player</h3>
          <p style={styles.modeDesc}>Create a room or join a friend with a code.</p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button style={{ ...styles.modeBtn, flex: 1, fontSize: '0.8rem' }} onClick={() => { setModal('create'); setError(''); }}>
              Create Room
            </button>
            <button style={{ ...styles.modeBtn, flex: 1, fontSize: '0.8rem', background: '#2d3748' }} onClick={() => { setModal('join'); setError(''); }}>
              Join Room
            </button>
          </div>
        </div>

        {/* Tournament */}
        <div style={{ ...styles.modeCard, opacity: 0.5 }}>
          <div style={styles.modeIcon}>🏆</div>
          <h3 style={styles.modeName}>Tournament</h3>
          <p style={styles.modeDesc}>Bracket-style competition. Coming soon!</p>
          <button style={{ ...styles.modeBtn, background: '#374151', cursor: 'not-allowed' }} disabled>
            Coming Soon
          </button>
        </div>
      </div>

      {/* Recent Battles */}
      {recentBattles.length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>Recent Battles</h2>
          <div style={styles.battlesList}>
            {recentBattles.map(b => (
              <BattleCard key={b.id} battle={b} currentUserId={user.id} navigate={navigate} />
            ))}
          </div>
        </>
      )}

      {/* ── MODALS ── */}
      {modal && (
        <div style={styles.overlay} onClick={() => setModal(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>

            {/* Bot Config Modal */}
            {modal === 'bot' && (
              <>
                <ModalHeader title="⚔️ Battle vs Bot" onClose={() => setModal(null)} />
                <BattleConfigForm config={battleConfig} setConfig={setBattleConfig} />
                {error && <p style={styles.errorText}>{error}</p>}
                <div style={styles.modalFooter}>
                  <button style={styles.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
                  <button style={styles.createBtn} onClick={handleCreateBot} disabled={creating}>
                    {creating ? 'Starting...' : '🤖 Start vs Bot'}
                  </button>
                </div>
              </>
            )}

            {/* Create P vs P Room */}
            {modal === 'create' && (
              <>
                <ModalHeader title="👥 Create Battle Room" onClose={() => setModal(null)} />
                <BattleConfigForm config={battleConfig} setConfig={setBattleConfig} />
                {error && <p style={styles.errorText}>{error}</p>}
                <div style={styles.modalFooter}>
                  <button style={styles.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
                  <button style={styles.createBtn} onClick={handleCreateRoom} disabled={creating}>
                    {creating ? 'Creating...' : '🚀 Create Room'}
                  </button>
                </div>
              </>
            )}

            {/* Join Room */}
            {modal === 'join' && (
              <>
                <ModalHeader title="🔑 Join Battle Room" onClose={() => setModal(null)} />
                <p style={{ color: '#90CDF4', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  Enter the 6-character room code your friend shared with you.
                </p>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABC123"
                  maxLength={6}
                  style={styles.codeInput}
                />
                {error && <p style={styles.errorText}>{error}</p>}
                <div style={styles.modalFooter}>
                  <button style={styles.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
                  <button style={styles.createBtn} onClick={handleJoinRoom} disabled={joining || joinCode.length < 6}>
                    {joining ? 'Joining...' : '⚡ Join Battle'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ModalHeader({ title, onClose }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
      <h2 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>{title}</h2>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#718096', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
    </div>
  );
}

function BattleConfigForm({ config, setConfig }) {
  const field = (label, key, options) => (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ color: '#90CDF4', fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem' }}>{label}</label>
      <select value={config[key]} onChange={e => setConfig(c => ({ ...c, [key]: isNaN(e.target.value) ? e.target.value : parseInt(e.target.value) }))}
        style={{ width: '100%', background: '#2d3748', color: 'white', border: '1px solid #4a5568', borderRadius: 8, padding: '0.6rem', fontSize: '0.9rem' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <>
      {field('Language', 'language', [
        { value: 'python', label: 'Python' }, { value: 'javascript', label: 'JavaScript' },
        { value: 'java',   label: 'Java'   }, { value: 'cpp',        label: 'C++' },
      ])}
      {field('Difficulty', 'difficulty', [
        { value: 'EASY', label: 'Easy' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HARD', label: 'Hard' },
      ])}
      {field('Questions', 'totalRounds', [
        { value: 1, label: '1 Question' }, { value: 3, label: '3 Questions' }, { value: 5, label: '5 Questions' },
      ])}
      {field('Time per Question', 'timeLimit', [
        { value: 120, label: '2 minutes' }, { value: 180, label: '3 minutes' }, { value: 300, label: '5 minutes' },
      ])}
    </>
  );
}

function BattleCard({ battle, currentUserId, navigate }) {
  const isP1         = battle.player1_id === currentUserId;
  const myScore      = isP1 ? battle.player1_score : battle.player2_score;
  const oppScore     = isP1 ? battle.player2_score : battle.player1_score;
  const oppName      = battle.player2_name || 'Player 2';
  const didWin       = battle.winner_id === currentUserId;
  const isDraw       = battle.status === 'COMPLETED' && !battle.winner_id;
  const statusColor  = battle.status !== 'COMPLETED' ? '#ffc107' : isDraw ? '#9ca3af' : didWin ? '#34d399' : '#f87171';
  const statusText   = battle.status === 'IN_PROGRESS' ? 'In Progress' : battle.status === 'WAITING' ? 'Waiting' : isDraw ? 'Draw' : didWin ? 'Victory' : 'Defeat';

  return (
    <div style={styles.battleCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ background: '#2d3748', color: '#90CDF4', padding: '2px 10px', borderRadius: 10, fontSize: '0.78rem' }}>{battle.language}</span>
        <span style={{ color: statusColor, fontWeight: 700, fontSize: '0.85rem' }}>{statusText}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#CBD5E0', fontSize: '0.8rem' }}>You</div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: '1.4rem' }}>{myScore}</div>
        </div>
        <div style={{ color: '#4a5568', fontWeight: 700 }}>VS</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#CBD5E0', fontSize: '0.8rem' }}>{oppName}</div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: '1.4rem' }}>{oppScore}</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#4a5568', fontSize: '0.78rem' }}>{new Date(battle.created_at).toLocaleDateString()}</span>
        {battle.status === 'IN_PROGRESS' && (
          <button onClick={() => navigate(`/battle/${battle.id}`)}
            style={{ background: '#667eea', color: 'white', border: 'none', borderRadius: 6, padding: '0.3rem 0.8rem', cursor: 'pointer', fontSize: '0.82rem' }}>
            Resume →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  page:        { minHeight: '100vh', background: '#1a1a2e', color: 'white', padding: '2rem', fontFamily: 'Arial, sans-serif' },
  centered:    { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1a1a2e' },
  spinner:     { width: 40, height: 40, border: '4px solid #2d3748', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' },
  title:       { margin: 0, fontSize: '2rem', background: 'linear-gradient(135deg,#667eea,#764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  subtitle:    { color: '#718096', margin: '0.25rem 0 0' },
  backBtn:     { color: '#667eea', textDecoration: 'none', fontSize: '0.9rem' },
  resultBanner:{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem', borderRadius: 12, marginBottom: '1.5rem', position: 'relative' },
  dismissBtn:  { position: 'absolute', right: '1rem', background: 'none', border: 'none', color: '#718096', cursor: 'pointer', fontSize: '1rem' },
  statsRow:    { display: 'flex', gap: '1rem', marginBottom: '2rem' },
  statCard:    { flex: 1, background: '#16213e', borderRadius: 12, padding: '1.25rem', textAlign: 'center', border: '1px solid #2a2a4a' },
  statValue:   { fontSize: '1.8rem', fontWeight: 700, color: 'white', margin: '0.25rem 0' },
  statLabel:   { color: '#718096', fontSize: '0.8rem' },
  sectionTitle:{ color: '#E2E8F0', marginBottom: '1rem', fontSize: '1.1rem' },
  modesRow:    { display: 'flex', gap: '1rem', marginBottom: '2rem' },
  modeCard:    { flex: 1, background: '#16213e', borderRadius: 16, padding: '1.5rem', border: '1px solid #2a2a4a', textAlign: 'center' },
  modeIcon:    { fontSize: '2.5rem', marginBottom: '0.75rem' },
  modeName:    { color: 'white', margin: '0 0 0.5rem', fontSize: '1.1rem' },
  modeDesc:    { color: '#718096', fontSize: '0.85rem', margin: 0 },
  modeBtn:     { marginTop: '1rem', width: '100%', padding: '0.7rem', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' },
  battlesList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' },
  battleCard:  { background: '#16213e', borderRadius: 12, padding: '1rem', border: '1px solid #2a2a4a' },
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal:       { background: '#16213e', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 480, border: '1px solid #2a2a4a' },
  modalFooter: { display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' },
  cancelBtn:   { padding: '0.6rem 1.2rem', background: '#2d3748', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' },
  createBtn:   { padding: '0.6rem 1.5rem', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 },
  codeInput:   { width: '100%', background: '#2d3748', border: '2px solid #667eea', color: 'white', borderRadius: 10, padding: '1rem', fontSize: '2rem', textAlign: 'center', letterSpacing: '0.5rem', outline: 'none', boxSizing: 'border-box', fontWeight: 700 },
  errorText:   { color: '#f87171', fontSize: '0.85rem', marginTop: '0.5rem' },
};
