// src/pages/BattleSession.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import battleService from '../services/battleService';

let MonacoEditor = null;
try { MonacoEditor = require('@monaco-editor/react').default; } catch {}

export default function BattleSession() {
  const { battleId }   = useParams();
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const { user }       = useAuth();

  const isHost  = searchParams.get('host') === 'true';
  const codeParam = searchParams.get('code');

  const [battle,          setBattle]          = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [code,            setCode]            = useState('');
  const [timeRemaining,   setTimeRemaining]   = useState(0);
  const [isSubmitting,    setIsSubmitting]    = useState(false);
  const [submitted,       setSubmitted]       = useState(false);
  const [results,         setResults]         = useState(null);
  const [opponentDone,    setOpponentDone]    = useState(false);
  const [phase,           setPhase]           = useState('loading'); // loading | waiting | countdown | playing | roundEnd | finished
  const [countdown,       setCountdown]       = useState(3);
  const [botThinking,     setBotThinking]     = useState(false);
  const [copiedCode,      setCopiedCode]      = useState(false);

  const startTimeRef  = useRef(Date.now());
  const channelRef    = useRef(null);
  const timerRef      = useRef(null);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    loadBattle();
    return () => {
      if (channelRef.current) battleService.unsubscribeFromBattle(channelRef.current);
      clearInterval(timerRef.current);
    };
  }, [battleId]);

  async function loadBattle() {
    const { data } = await battleService.getBattle(battleId);
    if (!data) { navigate('/battle-arena'); return; }
    setBattle(data);

    if (data.status === 'COMPLETED') {
      goToResults(data);
      return;
    }

    // Subscribe to realtime updates
    channelRef.current = battleService.subscribeToBattle(battleId, handleRealtimeUpdate);

    if (data.status === 'WAITING') {
      setPhase('waiting');
    } else {
      await loadQuestion(data);
    }
  }

  function handleRealtimeUpdate(updatedBattle) {
    setBattle(updatedBattle);

    // Opponent joined — start countdown
    if (updatedBattle.status === 'IN_PROGRESS' && phase === 'waiting') {
      startCountdown(updatedBattle);
      return;
    }

    // Check if opponent submitted this round
    const isP1 = updatedBattle.player1_id === user?.id;
    const opponentSubmitted = isP1 ? updatedBattle.player2_submitted : updatedBattle.player1_submitted;
    if (opponentSubmitted && !opponentDone) {
      setOpponentDone(true);
    }

    // Round index changed → new round
    if (battle && updatedBattle.current_question_index !== battle.current_question_index) {
      setSubmitted(false);
      setOpponentDone(false);
      setResults(null);
      loadQuestion(updatedBattle);
      setPhase('playing');
    }

    if (updatedBattle.status === 'COMPLETED') {
      goToResults(updatedBattle);
    }
  }

  async function loadQuestion(battleData) {
    const b = battleData || battle;
    const { data } = await battleService.getCurrentQuestion(battleId);
    if (!data) return;
    setCurrentQuestion(data.question);
    setCode(data.question.starter_code || getDefaultCode(data.question.language || 'python'));
    setTimeRemaining(data.timeLimit);
    startTimeRef.current = Date.now();

    // Bot starts immediately, P vs P does countdown
    if (b?.player2_name === 'Bot') {
      setPhase('playing');
      startTimer(data.timeLimit);
    } else {
      startCountdown(b);
    }
  }

  function startCountdown(battleData) {
    setPhase('countdown');
    setCountdown(3);
    let c = 3;
    const interval = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(interval);
        setPhase('playing');
        startTimer(battleData?.round_time_limit || 180);
      }
    }, 1000);
  }

  function startTimer(seconds) {
    clearInterval(timerRef.current);
    setTimeRemaining(seconds);
    let t = seconds;
    timerRef.current = setInterval(() => {
      t--;
      setTimeRemaining(t);
      if (t <= 0) {
        clearInterval(timerRef.current);
        if (!submitted) handleSubmit(true); // auto-submit on time out
      }
    }, 1000);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(isAutoSubmit = false) {
    if (submitted || isSubmitting) return;
    if (!code.trim() && !isAutoSubmit) return;

    clearInterval(timerRef.current);
    setIsSubmitting(true);

    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);

    const { data, error } = await battleService.submitBattleAnswer(
      battleId, currentQuestion.id, code, timeTaken
    );

    setIsSubmitting(false);
    setSubmitted(true);

    if (error) { console.error(error); return; }
    setResults(data);

    // Bot battle: simulate bot response then go to round end
    if (battle?.player2_name === 'Bot') {
      setBotThinking(true);
      await battleService.generateBotResponse(currentQuestion.id, battle.difficulty);
      setBotThinking(false);
      setPhase('roundEnd');
    } else {
      // P vs P: wait for opponent or show waiting state
      setPhase('roundEnd');
    }
  }

  // ── Next round ──────────────────────────────────────────────────────────────
  async function handleNextRound() {
    // Only player1 (host) advances the round for P vs P
    const isP1 = battle?.player1_id === user?.id;
    if (battle?.player2_name !== 'Bot' && !isP1) {
      // Non-host waits for realtime update
      return;
    }

    const { data } = await battleService.nextRound(battleId);
    if (data?.isComplete) {
      await battleService.completeBattle(battleId);
    }
  }

  function goToResults(battleData) {
    const isP1    = battleData.player1_id === user?.id;
    const myScore = isP1 ? battleData.player1_score : battleData.player2_score;
    const oppScore = isP1 ? battleData.player2_score : battleData.player1_score;
    navigate('/battle-arena', {
      state: {
        result: {
          didWin:      battleData.winner_id === user?.id,
          isDraw:      !battleData.winner_id,
          myScore,
          opponentScore: oppScore,
          xpEarned:    battleData.winner_id === user?.id ? 100 : 25,
        }
      }
    });
  }

  function getDefaultCode(lang) {
    const d = {
      python:     '# Write your solution here\n\ndef solution():\n    pass\n',
      javascript: '// Write your solution here\n\nfunction solution() {\n  \n}\n',
      java:       'public class Solution {\n    public static void main(String[] args) {\n        \n    }\n}\n',
      cpp:        '#include <iostream>\nusing namespace std;\nint main() {\n    \n    return 0;\n}\n',
    };
    return d[lang] || d.python;
  }

  const formatTime = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  // ── WAITING ROOM ────────────────────────────────────────────────────────────
  if (phase === 'waiting') return (
    <div style={S.centered}>
      <div style={S.waitingCard}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
        <h2 style={{ color: 'white', margin: '0 0 0.5rem' }}>Waiting for opponent...</h2>
        <p style={{ color: '#718096', marginBottom: '2rem' }}>Share this room code with your friend</p>

        <div style={S.roomCodeBox}>{codeParam || battle?.room_code}</div>

        <button
          onClick={() => { navigator.clipboard.writeText(codeParam || battle?.room_code); setCopiedCode(true); setTimeout(()=>setCopiedCode(false),2000); }}
          style={S.copyBtn}
        >
          {copiedCode ? '✅ Copied!' : '📋 Copy Code'}
        </button>

        <div style={S.pulsingDots}>
          <span>●</span><span>●</span><span>●</span>
        </div>

        <button onClick={() => { battleService.cancelBattle(battleId); navigate('/battle-arena'); }}
          style={S.cancelLink}>
          Cancel Battle
        </button>
      </div>
    </div>
  );

  // ── COUNTDOWN ───────────────────────────────────────────────────────────────
  if (phase === 'countdown') return (
    <div style={S.centered}>
      <div style={{ fontSize: '8rem', fontWeight: 900, color: '#667eea', animation: 'pulse 0.8s ease-in-out' }}>
        {countdown === 0 ? 'GO!' : countdown}
      </div>
      <p style={{ color: '#90CDF4', marginTop: '1rem', fontSize: '1.1rem' }}>Get ready to code!</p>
    </div>
  );

  // ── LOADING ─────────────────────────────────────────────────────────────────
  if (phase === 'loading' || !battle || !currentQuestion) return (
    <div style={S.centered}>
      <div style={S.spinner} />
      <p style={{ color: '#90CDF4', marginTop: '1rem' }}>Loading battle...</p>
    </div>
  );

  const isP1         = battle.player1_id === user?.id;
  const myScore      = isP1 ? battle.player1_score : battle.player2_score;
  const oppScore     = isP1 ? battle.player2_score : battle.player1_score;
  const oppName      = battle.player2_name || 'Opponent';
  const isBot        = battle.player2_name === 'Bot';
  const timerWarning = timeRemaining < 30;

  return (
    <div style={S.page}>

      {/* ── Header ── */}
      <div style={S.header}>
        {/* My score */}
        <div style={S.scoreBox}>
          <div style={S.scoreLabel}>You</div>
          <div style={S.scoreValue}>{myScore}</div>
          {submitted && <div style={{ color: '#68D391', fontSize: '0.75rem', marginTop: '2px' }}>✓ Submitted</div>}
        </div>

        {/* Center info */}
        <div style={S.centerInfo}>
          <div style={{ color: '#718096', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
            Round {battle.current_question_index + 1} / {battle.total_rounds}
          </div>
          <div style={{ ...S.timer, color: timerWarning ? '#f87171' : '#68D391' }}>
            ⏱ {formatTime(timeRemaining)}
          </div>
          <div style={{ color: '#4a5568', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {currentQuestion.difficulty} · {currentQuestion.language?.toUpperCase()}
          </div>
        </div>

        {/* Opponent score */}
        <div style={{ ...S.scoreBox, textAlign: 'right' }}>
          <div style={S.scoreLabel}>{oppName}</div>
          <div style={S.scoreValue}>{oppScore}</div>
          {isBot ? (
            <div style={{ color: '#718096', fontSize: '0.75rem', marginTop: '2px' }}>
              {botThinking ? '💭 Solving...' : '🤖 Bot'}
            </div>
          ) : opponentDone ? (
            <div style={{ color: '#F6E05E', fontSize: '0.75rem', marginTop: '2px' }}>✓ Submitted!</div>
          ) : submitted ? (
            <div style={{ color: '#718096', fontSize: '0.75rem', marginTop: '2px' }}>⌨️ Still coding...</div>
          ) : null}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={S.body}>

        {/* Question Panel */}
        <div style={S.questionPanel}>
          <h2 style={S.questionTitle}>{currentQuestion.title}</h2>
          <p style={S.questionDesc}>{currentQuestion.description}</p>

          {currentQuestion.test_cases?.filter(tc => !tc.hidden).slice(0, 2).map((tc, i) => (
            <div key={i} style={S.testCase}>
              <div style={{ color: '#718096', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Example {i + 1}</div>
              <div style={{ color: '#90CDF4', fontSize: '0.82rem' }}>Input: <code style={{ color: '#F6E05E' }}>{String(tc.input)}</code></div>
              <div style={{ color: '#90CDF4', fontSize: '0.82rem' }}>Output: <code style={{ color: '#68D391' }}>{String(tc.expected_output || tc.output)}</code></div>
            </div>
          ))}

          {/* Opponent status indicator (P vs P) */}
          {!isBot && (
            <div style={S.opponentStatus}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: opponentDone ? '#68D391' : '#F6E05E', animation: opponentDone ? 'none' : 'pulse 1s infinite' }} />
                <span style={{ color: '#CBD5E0', fontSize: '0.82rem' }}>
                  {opponentDone ? `${oppName} submitted!` : `${oppName} is coding...`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Editor Panel */}
        <div style={S.editorPanel}>
          <div style={S.editorToolbar}>
            <span style={{ color: '#90CDF4', fontSize: '0.85rem', fontWeight: 600 }}>
              {currentQuestion.language?.toUpperCase()}
            </span>
            {submitted && <span style={{ color: '#68D391', fontSize: '0.82rem' }}>✓ Submitted — waiting for round to end</span>}
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            {MonacoEditor ? (
              <MonacoEditor
                height="100%"
                language={currentQuestion.language || 'python'}
                value={code}
                onChange={v => !submitted && setCode(v || '')}
                theme="vs-dark"
                options={{ fontSize: 14, minimap: { enabled: false }, readOnly: submitted, scrollBeyondLastLine: false, wordWrap: 'on' }}
              />
            ) : (
              <textarea
                value={code}
                onChange={e => !submitted && setCode(e.target.value)}
                readOnly={submitted}
                style={{ width: '100%', height: '100%', background: '#1e1e1e', color: '#d4d4d4', border: 'none', padding: '1rem', fontFamily: 'monospace', fontSize: 14, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
              />
            )}
          </div>

          <div style={S.submitBar}>
            <button
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting || submitted || timeRemaining === 0}
              style={{
                ...S.submitBtn,
                background: submitted ? '#374151' : isSubmitting ? '#4a5568' : 'linear-gradient(135deg,#667eea,#764ba2)',
                cursor: (submitted || isSubmitting) ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? '⏳ Evaluating...' : submitted ? '✓ Submitted' : '⚡ Submit Solution'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Round End Overlay ── */}
      {phase === 'roundEnd' && results && (
        <div style={S.overlay}>
          <div style={S.roundEndCard}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
              {results.isCorrect ? '✅' : '❌'}
            </div>
            <h2 style={{ color: results.isCorrect ? '#68D391' : '#f87171', margin: '0 0 0.5rem' }}>
              {results.isCorrect ? 'Correct!' : 'Incorrect'}
            </h2>
            <p style={{ color: '#CBD5E0', marginBottom: '1rem' }}>
              {results.pointsEarned} points earned
              {results.speedBonus > 0 && <span style={{ color: '#F6E05E' }}> (+{results.speedBonus} speed bonus!)</span>}
            </p>

            <div style={S.testResultsRow}>
              {results.testResults?.map((t, i) => (
                <div key={i} style={{ ...S.testBadge, background: t.passed ? '#14532d' : '#7f1d1d' }}>
                  {t.passed ? '✓' : '✗'} Test {i + 1}
                </div>
              ))}
            </div>

            <p style={{ color: '#718096', fontSize: '0.85rem', margin: '1rem 0' }}>
              {battle.current_question_index + 1 < battle.total_rounds
                ? `Round ${battle.current_question_index + 1} of ${battle.total_rounds} complete`
                : 'Final round!'}
            </p>

            {/* Bot: player advances themselves. P vs P: player1 advances */}
            {(isBot || isP1) ? (
              <button onClick={handleNextRound} style={S.nextBtn}>
                {battle.current_question_index + 1 >= battle.total_rounds ? '🏁 See Final Results' : 'Next Round →'}
              </button>
            ) : (
              <p style={{ color: '#718096', fontSize: '0.85rem' }}>Waiting for host to advance...</p>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin   { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page:          { display:'flex', flexDirection:'column', height:'100vh', background:'#1a1a2e', fontFamily:'Arial,sans-serif', overflow:'hidden' },
  centered:      { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#1a1a2e' },
  spinner:       { width:40, height:40, border:'4px solid #2d3748', borderTopColor:'#667eea', borderRadius:'50%', animation:'spin 0.8s linear infinite' },
  header:        { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.75rem 1.5rem', background:'#0f3460', borderBottom:'1px solid #2a2a4a' },
  scoreBox:      { minWidth:120 },
  scoreLabel:    { color:'#718096', fontSize:'0.8rem' },
  scoreValue:    { color:'white', fontSize:'1.8rem', fontWeight:900 },
  centerInfo:    { textAlign:'center' },
  timer:         { fontSize:'1.6rem', fontWeight:700 },
  body:          { display:'flex', flex:1, minHeight:0 },
  questionPanel: { width:'35%', background:'#16213e', overflowY:'auto', padding:'1.25rem', borderRight:'1px solid #2a2a4a' },
  questionTitle: { color:'#E2E8F0', fontSize:'1.1rem', margin:'0 0 0.75rem' },
  questionDesc:  { color:'#CBD5E0', fontSize:'0.88rem', lineHeight:1.6, whiteSpace:'pre-wrap', marginBottom:'1rem' },
  testCase:      { background:'#2d3748', borderRadius:8, padding:'0.75rem', marginBottom:'0.75rem' },
  opponentStatus:{ marginTop:'1.5rem', background:'#2d3748', borderRadius:10, padding:'0.75rem' },
  editorPanel:   { flex:1, display:'flex', flexDirection:'column', minWidth:0 },
  editorToolbar: { background:'#0f3460', padding:'0.5rem 1rem', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #2a2a4a' },
  submitBar:     { padding:'0.75rem 1rem', background:'#0d1117', borderTop:'1px solid #2a2a4a' },
  submitBtn:     { width:'100%', padding:'0.75rem', color:'white', border:'none', borderRadius:8, fontWeight:700, fontSize:'1rem' },
  overlay:       { position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 },
  roundEndCard:  { background:'#16213e', borderRadius:20, padding:'2.5rem', textAlign:'center', border:'1px solid #2a2a4a', minWidth:340 },
  testResultsRow:{ display:'flex', gap:'0.5rem', flexWrap:'wrap', justifyContent:'center' },
  testBadge:     { padding:'4px 12px', borderRadius:20, color:'white', fontSize:'0.82rem', fontWeight:600 },
  nextBtn:       { marginTop:'0.5rem', padding:'0.75rem 2rem', background:'linear-gradient(135deg,#667eea,#764ba2)', color:'white', border:'none', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:'1rem' },
  waitingCard:   { background:'#16213e', borderRadius:20, padding:'3rem', textAlign:'center', border:'1px solid #2a2a4a', minWidth:360 },
  roomCodeBox:   { fontSize:'2.5rem', fontWeight:900, letterSpacing:'0.5rem', color:'white', background:'#2d3748', borderRadius:12, padding:'1rem 2rem', marginBottom:'1rem', fontFamily:'monospace' },
  copyBtn:       { padding:'0.6rem 1.5rem', background:'#667eea', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600, marginBottom:'2rem' },
  pulsingDots:   { display:'flex', gap:'0.5rem', justifyContent:'center', color:'#667eea', fontSize:'1.5rem', marginBottom:'2rem', animation:'pulse 1.2s infinite' },
  cancelLink:    { background:'none', border:'none', color:'#4a5568', cursor:'pointer', fontSize:'0.85rem', textDecoration:'underline' },
};
