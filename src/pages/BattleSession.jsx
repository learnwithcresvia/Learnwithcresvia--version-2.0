import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import battleService from '../services/battleService';
import CodeEditor from '../components/CodeEditor';
import '../styles/battle.css';

export default function BattleSession() {
  const { battleId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [battle, setBattle] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [code, setCode] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState(null);
  const [startTime, setStartTime] = useState(Date.now());

  useEffect(() => {
    loadBattle();
  }, [battleId]);

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0 && currentQuestion) {
      // Time's up - auto submit
      handleSubmit();
    }
  }, [timeRemaining]);

  const loadBattle = async () => {
    const { data: battleData } = await battleService.getBattle(battleId);
    setBattle(battleData);

    if (battleData.status === 'COMPLETED') {
      // Show final results
      showFinalResults(battleData);
      return;
    }

    const { data: questionData } = await battleService.getCurrentQuestion(battleId);
    if (questionData) {
      setCurrentQuestion(questionData.question);
      setTimeRemaining(questionData.timeLimit);
      
      if (questionData.question.starter_code) {
        setCode(questionData.question.starter_code);
      }
    }

    setStartTime(Date.now());
  };

  const handleSubmit = async () => {
    if (!code.trim()) {
      alert('Please write some code!');
      return;
    }

    setIsSubmitting(true);

    const timeTaken = Math.floor((Date.now() - startTime) / 1000);

    try {
      const { data, error } = await battleService.submitBattleAnswer(
        battleId,
        currentQuestion.id,
        code,
        timeTaken
      );

      if (error) {
        alert('Error: ' + error.message);
        return;
      }

      setResults(data);
      setShowResults(true);

      // If bot battle, generate bot response
      if (battle.player2_name === 'Bot') {
        setTimeout(async () => {
          await battleService.generateBotResponse(currentQuestion.id, battle.difficulty);
          // Reload battle to get updated scores
          const { data: updatedBattle } = await battleService.getBattle(battleId);
          setBattle(updatedBattle);
        }, 2000);
      }
    } catch (err) {
      alert('Failed to submit: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextRound = async () => {
    const { data } = await battleService.nextRound(battleId);

    if (data.isComplete) {
      // Battle completed
      showFinalResults(data);
    } else {
      // Load next question
      setShowResults(false);
      setResults(null);
      setCode('');
      loadBattle();
    }
  };

  const showFinalResults = (battleData) => {
    const isPlayer1 = battleData.player1_id === user.id;
    const myScore = isPlayer1 ? battleData.player1_score : battleData.player2_score;
    const opponentScore = isPlayer1 ? battleData.player2_score : battleData.player1_score;
    const didWin = battleData.winner_id === user.id;
    const isDraw = !battleData.winner_id;

    navigate('/battle-arena', {
      state: {
        result: {
          didWin,
          isDraw,
          myScore,
          opponentScore,
          xpEarned: didWin ? 100 : 25,
        }
      }
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!battle || !currentQuestion) {
    return (
      <div className="battle-loading">
        <div className="spinner"></div>
        <p>Loading battle...</p>
      </div>
    );
  }

  const isPlayer1 = battle.player1_id === user.id;
  const myScore = isPlayer1 ? battle.player1_score : battle.player2_score;
  const opponentScore = isPlayer1 ? battle.player2_score : battle.player1_score;
  const opponentName = isPlayer1 ? battle.player2_name : 'You';

  return (
    <div className="battle-session">
      {/* Battle Header */}
      <div className="battle-session-header">
        <div className="battle-scores">
          <div className="score-box mine">
            <div className="score-label">You</div>
            <div className="score-value">{myScore}</div>
          </div>
          
          <div className="battle-info">
            <div className="round-info">
              Round {battle.current_question_index + 1} / {battle.total_rounds}
            </div>
            <div className={`timer ${timeRemaining < 30 ? 'warning' : ''}`}>
              ⏱️ {formatTime(timeRemaining)}
            </div>
          </div>

          <div className="score-box opponent">
            <div className="score-label">{opponentName}</div>
            <div className="score-value">{opponentScore}</div>
          </div>
        </div>
      </div>

      {/* Battle Content */}
      <div className="battle-content">
        {/* Question Panel */}
        <div className="battle-question-panel">
          <h2>{currentQuestion.title}</h2>
          
          <div className="question-meta">
            <span className={`difficulty ${currentQuestion.difficulty.toLowerCase()}`}>
              {currentQuestion.difficulty}
            </span>
            <span className="language">{currentQuestion.language}</span>
          </div>

          <div className="question-description">
            <div dangerouslySetInnerHTML={{ __html: currentQuestion.description.replace(/\n/g, '<br/>') }} />
          </div>

          {currentQuestion.test_cases && (
            <div className="example-cases">
              <h3>Examples</h3>
              {currentQuestion.test_cases.filter(tc => !tc.hidden).map((tc, idx) => (
                <div key={idx} className="example-case">
                  <div><strong>Input:</strong> <code>{tc.input}</code></div>
                  <div><strong>Output:</strong> <code>{tc.output}</code></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Code Editor Panel */}
        <div className="battle-editor-panel">
          <CodeEditor
            value={code}
            onChange={setCode}
            language={currentQuestion.language}
          />

          <div className="editor-actions">
            <button 
              className="btn-submit-battle" 
              onClick={handleSubmit}
              disabled={isSubmitting || timeRemaining === 0}
            >
              {isSubmitting ? 'Submitting...' : '✓ Submit Solution'}
            </button>
          </div>
        </div>
      </div>

      {/* Results Modal */}
      {showResults && results && (
        <div className="battle-results-modal">
          <div className="battle-results-content">
            <div className={`results-header ${results.isCorrect ? 'correct' : 'incorrect'}`}>
              <h2>{results.isCorrect ? '✅ Correct!' : '❌ Incorrect'}</h2>
              <p>You scored {results.pointsEarned} points</p>
              {results.speedBonus > 0 && (
                <p className="speed-bonus">+{results.speedBonus} speed bonus!</p>
              )}
            </div>

            <div className="results-body">
              <div className="test-results">
                <h3>Test Results: {results.passedTests}/{results.totalTests}</h3>
                {results.testResults?.map((test, idx) => (
                  <div key={idx} className={`test ${test.passed ? 'passed' : 'failed'}`}>
                    {test.passed ? '✓' : '✗'} Test {idx + 1}
                  </div>
                ))}
              </div>
            </div>

            <button className="btn-next-round" onClick={handleNextRound}>
              Next Round →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
