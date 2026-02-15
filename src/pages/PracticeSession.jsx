import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import practiceService from '../services/practiceService';
import questionService from '../services/questionService';
import CodeEditor from '../components/CodeEditor';
import ChatBot from '../components/ChatBot';
import '../styles/practice.css';

export default function PracticeSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);

  const [code, setCode] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [output, setOutput] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBot, setShowBot] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState(null);

  const [startTime, setStartTime] = useState(Date.now());

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    const { data: sessionData } = await practiceService.getSession(sessionId);
    setSession(sessionData);

    const { data: questionData } = await practiceService.getCurrentQuestion(sessionId);
    if (questionData) {
      setCurrentQuestion(questionData.question);
      setQuestionIndex(questionData.index);
      setTotalQuestions(questionData.total);
      
      // Set starter code
      if (questionData.question.starter_code) {
        setCode(questionData.question.starter_code);
      }
    }

    setStartTime(Date.now());
  };

  const handleRunCode = async () => {
    if (!code.trim()) {
      alert('Please write some code first!');
      return;
    }

    setIsSubmitting(true);
    setOutput({ status: 'running', message: 'Running your code...' });

    try {
      const { data, error } = await practiceService.submitAnswer(
        sessionId,
        currentQuestion.id,
        code
      );

      if (error) {
        setOutput({
          status: 'error',
          message: error.message,
        });
      } else {
        setResults(data);
        setShowResults(true);
      }
    } catch (err) {
      setOutput({
        status: 'error',
        message: 'Failed to run code: ' + err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitAnswer = async () => {
    const answer = currentQuestion.question_type === 'CODING' ? code : selectedAnswer;
    
    if (!answer.trim()) {
      alert('Please provide an answer!');
      return;
    }

    setIsSubmitting(true);

    const timeTaken = Math.floor((Date.now() - startTime) / 1000);

    try {
      const { data, error } = await practiceService.submitAnswer(
        sessionId,
        currentQuestion.id,
        answer
      );

      if (error) {
        alert('Error: ' + error.message);
        return;
      }

      setResults(data);
      setShowResults(true);
    } catch (err) {
      alert('Failed to submit: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextQuestion = async () => {
    const { data } = await practiceService.nextQuestion(sessionId);

    if (data.isComplete) {
      // Session completed
      navigate('/practice-hub');
      alert(`Session completed! You earned ${data.xp_earned} XP!`);
    } else {
      // Load next question
      setShowResults(false);
      setResults(null);
      setCode('');
      setSelectedAnswer('');
      setOutput(null);
      loadSession();
    }
  };

  const handleQuit = async () => {
    if (confirm('Are you sure you want to quit? Progress will be saved.')) {
      await practiceService.abandonSession(sessionId);
      navigate('/practice-hub');
    }
  };

  if (!session || !currentQuestion) {
    return (
      <div className="practice-loading">
        <div className="spinner"></div>
        <p>Loading question...</p>
      </div>
    );
  }

  return (
    <div className="practice-session">
      {/* Header */}
      <div className="session-header">
        <div className="header-left">
          <h2>{currentQuestion.title}</h2>
          <div className="progress-info">
            Question {questionIndex + 1} of {totalQuestions}
          </div>
        </div>
        <div className="header-right">
          <button className="btn-bot" onClick={() => setShowBot(!showBot)}>
            🤖 Ask Bot
          </button>
          <button className="btn-quit" onClick={handleQuit}>
            Quit
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="session-content">
        {/* Left Panel - Question */}
        <div className="question-panel">
          <div className="question-header-info">
            <span className={`difficulty-badge ${currentQuestion.difficulty.toLowerCase()}`}>
              {currentQuestion.difficulty}
            </span>
            <span className="question-type">{currentQuestion.question_type}</span>
            {currentQuestion.topic && (
              <span className="topic-badge">{currentQuestion.topic}</span>
            )}
          </div>

          <div className="question-description">
            <h3>Description</h3>
            <div dangerouslySetInnerHTML={{ __html: currentQuestion.description.replace(/\n/g, '<br/>') }} />
          </div>

          {currentQuestion.question_type === 'MCQ' && (
            <div className="mcq-options">
              <h3>Options</h3>
              {currentQuestion.options?.map((option, idx) => (
                <label key={idx} className="mcq-option">
                  <input
                    type="radio"
                    name="answer"
                    value={option.text}
                    checked={selectedAnswer === option.text}
                    onChange={(e) => setSelectedAnswer(e.target.value)}
                  />
                  <span>{option.text}</span>
                </label>
              ))}
            </div>
          )}

          {currentQuestion.test_cases && currentQuestion.test_cases.filter(tc => !tc.hidden).length > 0 && (
            <div className="test-cases">
              <h3>Example Test Cases</h3>
              {currentQuestion.test_cases.filter(tc => !tc.hidden).map((tc, idx) => (
                <div key={idx} className="test-case">
                  <div className="test-input">
                    <strong>Input:</strong>
                    <code>{tc.input}</code>
                  </div>
                  <div className="test-output">
                    <strong>Expected Output:</strong>
                    <code>{tc.output}</code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel - Code Editor or Answer */}
        <div className="editor-panel">
          {currentQuestion.question_type === 'CODING' ? (
            <>
              <CodeEditor
                value={code}
                onChange={setCode}
                language={currentQuestion.language || 'python'}
              />

              <div className="editor-actions">
                <button 
                  className="btn-run" 
                  onClick={handleRunCode}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Running...' : '▶ Run Code'}
                </button>
                <button 
                  className="btn-submit" 
                  onClick={handleSubmitAnswer}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : '✓ Submit Solution'}
                </button>
              </div>

              {output && (
                <div className={`output-panel ${output.status}`}>
                  <h4>Output</h4>
                  <pre>{output.message}</pre>
                </div>
              )}
            </>
          ) : (
            <div className="text-answer-panel">
              <h3>Your Answer</h3>
              <textarea
                value={selectedAnswer}
                onChange={(e) => setSelectedAnswer(e.target.value)}
                placeholder="Type your answer here..."
                rows={10}
              />
              <button 
                className="btn-submit" 
                onClick={handleSubmitAnswer}
                disabled={isSubmitting}
              >
                Submit Answer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results Modal */}
      {showResults && results && (
        <div className="results-modal">
          <div className="results-content">
            <div className={`results-header ${results.isCorrect ? 'correct' : 'incorrect'}`}>
              <h2>{results.isCorrect ? '✅ Correct!' : '❌ Incorrect'}</h2>
            </div>

            <div className="results-body">
              {results.testResults && (
                <div className="test-results">
                  <h3>Test Results: {results.passedTests}/{results.totalTests} Passed</h3>
                  {results.testResults.map((result, idx) => (
                    <div key={idx} className={`test-result ${result.passed ? 'passed' : 'failed'}`}>
                      <div className="test-name">
                        {result.passed ? '✓' : '✗'} Test Case {idx + 1}
                      </div>
                      {!result.passed && (
                        <div className="test-details">
                          <div><strong>Input:</strong> {result.input}</div>
                          <div><strong>Expected:</strong> {result.expectedOutput}</div>
                          <div><strong>Got:</strong> {result.actualOutput || 'Error'}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {results.isCorrect && (
                <div className="xp-earned">
                  <span className="xp-icon">⭐</span>
                  <span className="xp-text">+{results.pointsEarned} XP</span>
                </div>
              )}

              {results.explanation && (
                <div className="explanation">
                  <h3>Explanation</h3>
                  <p>{results.explanation}</p>
                </div>
              )}
            </div>

            <div className="results-actions">
              <button className="btn-next" onClick={handleNextQuestion}>
                Next Question →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Bot */}
      {showBot && (
        <ChatBot
          questionId={currentQuestion.id}
          sessionId={sessionId}
          onClose={() => setShowBot(false)}
        />
      )}
    </div>
  );
}
