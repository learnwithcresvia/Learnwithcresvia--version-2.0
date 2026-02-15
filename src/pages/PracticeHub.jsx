import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import questionService from '../services/questionService';
import practiceService from '../services/practiceService';
import '../styles/practice.css';

export default function PracticeHub() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [questions, setQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    language: params.get('lang') || 'python',
    difficulty: params.get('level') || '',
    topic: '',
    questionType: '',
  });

  const [topics, setTopics] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, questions]);

  const loadData = async () => {
    setLoading(true);
    const { data: allQuestions } = await questionService.getQuestions();
    setQuestions(allQuestions || []);
    const { data: topicsList } = await questionService.getTopics('python');
    setTopics(topicsList || []);
    const { data: sessions } = await practiceService.getUserHistory(5);
    setRecentSessions(sessions || []);
    setLoading(false);
  };

  const applyFilters = () => {
    let filtered = [...questions];
    if (filters.language && filters.language !== 'all') {
      filtered = filtered.filter(q => q.language === filters.language || q.language === 'all');
    }
    if (filters.difficulty) {
      filtered = filtered.filter(q => q.difficulty === filters.difficulty);
    }
    if (filters.topic) {
      filtered = filtered.filter(q => q.topic === filters.topic);
    }
    if (filters.questionType) {
      filtered = filtered.filter(q => q.question_type === filters.questionType);
    }
    setFilteredQuestions(filtered);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleStartPractice = async () => {
    if (filteredQuestions.length === 0) {
      alert('No questions match your filters!');
      return;
    }
    const { data: session, error } = await practiceService.createSession({
      language: filters.language || 'python',
      difficulty: filters.difficulty || 'EASY',
      topic: filters.topic || null,
      questionCount: 10,
    });
    if (error) {
      alert('Error creating session: ' + error.message);
      return;
    }
    navigate(`/practice/${session.id}`);
  };

  const handleQuickPractice = async (difficulty) => {
    const { data: session } = await practiceService.createSession({
      language: 'python',
      difficulty: difficulty,
      questionCount: 5,
    });
    if (session) {
      navigate(`/practice/${session.id}`);
    }
  };

  if (loading) {
    return (
      <div className="practice-loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div className="spinner" style={{ border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '1rem', color: '#64748b', fontWeight: '500' }}>Loading your curriculum...</p>
      </div>
    );
  }

  return (
    <div className="practice-hub" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      
      {/* Header */}
      <div className="practice-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: '800', color: '#1e293b', marginBottom: '0.5rem' }}>📚 Practice Hub</h1>
          <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Master your craft through focused daily challenges.</p>
        </div>
        <Link to="/dashboard" className="btn-back" style={{ textDecoration: 'none', color: '#3b82f6', fontWeight: '600', padding: '0.5rem 1rem', borderRadius: '8px', background: '#eff6ff' }}>
          ← Dashboard
        </Link>
      </div>

      {/* Quick Start Cards */}
      <section style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: '#334155' }}>Quick Start</h2>
        <div className="quick-start-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {[
            { level: 'EASY', icon: '🌱', color: '#22c55e', label: 'Beginner', desc: 'Fundamentals & Syntax' },
            { level: 'MEDIUM', icon: '🚀', color: '#f59e0b', label: 'Intermediate', desc: 'Logic & Algorithms' },
            { level: 'HARD', icon: '🔥', color: '#ef4444', label: 'Advanced', desc: 'Complex Systems' }
          ].map((item) => (
            <div 
              key={item.level} 
              className={`quick-card ${item.level.toLowerCase()}`} 
              onClick={() => handleQuickPractice(item.level)}
              style={{ 
                cursor: 'pointer', padding: '2rem', borderRadius: '16px', border: `1px solid ${item.color}20`,
                background: `linear-gradient(145deg, #ffffff, ${item.color}05)`, transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgb(0 0 0 / 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.1)'; }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{item.icon}</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1e293b' }}>{item.label}</h3>
              <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>{item.desc}</p>
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: item.color, background: `${item.color}15`, padding: '4px 12px', borderRadius: '99px' }}>
                +XP Available
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Filters Section */}
      <div className="filters-section" style={{ background: '#f8fafc', padding: '2rem', borderRadius: '20px', border: '1px solid #e2e8f0', marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem' }}>Custom Training</h2>
        <div className="filters-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {[
            { label: 'Language', key: 'language', options: [['python', 'Python'], ['javascript', 'JavaScript'], ['java', 'Java'], ['cpp', 'C++'], ['all', 'All Languages']] },
            { label: 'Difficulty', key: 'difficulty', options: [['', 'All Levels'], ['EASY', 'Easy'], ['MEDIUM', 'Medium'], ['HARD', 'Hard']] },
            { label: 'Topic', key: 'topic', options: [['', 'All Topics'], ...topics.map(t => [t, t])] },
            { label: 'Type', key: 'questionType', options: [['', 'All Types'], ['CODING', 'Coding'], ['MCQ', 'Multiple Choice'], ['OUTPUT', 'Output']] }
          ].map(f => (
            <div className="filter-group" key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569' }}>{f.label}</label>
              <select 
                value={filters[f.key]} 
                onChange={(e) => handleFilterChange(f.key, e.target.value)}
                style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', background: 'white' }}
              >
                {f.options.map(opt => <option key={opt[0]} value={opt[0]}>{opt[1]}</option>)}
              </select>
            </div>
          ))}
        </div>

        <button 
          className="btn-start-practice" 
          onClick={handleStartPractice}
          style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: '700', fontSize: '1.1rem', cursor: 'pointer', transition: 'background 0.2s' }}
          onMouseEnter={(e) => e.target.style.background = '#2563eb'}
          onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
        >
          Start Practice Session ({filteredQuestions.length} Questions)
        </button>
      </div>

      {/* Questions Preview */}
      <div className="questions-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Explore Questions</h2>
          <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Showing {Math.min(filteredQuestions.length, 12)} of {filteredQuestions.length}</span>
        </div>
        
        {filteredQuestions.length === 0 ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: '4rem', background: '#f1f5f9', borderRadius: '16px' }}>
            <p style={{ color: '#64748b', marginBottom: '1rem' }}>No questions match your current filters.</p>
            <button 
              onClick={() => setFilters({ language: 'python', difficulty: '', topic: '', questionType: '' })}
              style={{ color: '#3b82f6', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Reset all filters
            </button>
          </div>
        ) : (
          <div className="questions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {filteredQuestions.slice(0, 12).map(question => (
              <QuestionCard key={question.id} question={question} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <div className="recent-sessions-section" style={{ marginTop: '5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem' }}>Your History</h2>
          <div className="sessions-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recentSessions.map(session => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionCard({ question }) {
  const navigate = useNavigate();
  const difficultyColors = { EASY: '#22c55e', MEDIUM: '#f59e0b', HARD: '#ef4444' };

  return (
    <div 
      className="question-card" 
      onClick={() => navigate(`/practice/question/${question.id}`)} 
      style={{ 
        cursor: 'pointer', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', 
        background: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        transition: 'all 0.2s ease-in-out'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1e293b', margin: 0, flex: 1 }}>{question.title}</h3>
          <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'white', background: difficultyColors[question.difficulty], padding: '2px 8px', borderRadius: '4px', marginLeft: '8px' }}>
            {question.difficulty}
          </span>
        </div>
        <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: '1.5', marginBottom: '1.25rem' }}>
          {question.description?.substring(0, 80)}...
        </p>
      </div>

      <div className="question-footer" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '6px' }}>{question.language}</span>
          <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '6px' }}>{question.question_type}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#f59e0b', fontWeight: '700', fontSize: '0.9rem' }}>⭐ {question.points} XP</span>
          {question.usage_count > 0 && <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{question.success_rate}% success</span>}
        </div>
      </div>
    </div>
  );
}

function SessionCard({ session }) {
  const navigate = useNavigate();
  const getStatusColor = (status) => ({ COMPLETED: '#22c55e', IN_PROGRESS: '#3b82f6', ABANDONED: '#94a3b8' }[status] || '#666');

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#3b82f6' }}>
          {session.language?.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: '700', color: '#1e293b' }}>{session.language} Practice</div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{new Date(session.started_at).toLocaleDateString()}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Score</div>
          <div style={{ fontWeight: '700' }}>{session.correct_answers}/{session.total_questions}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Status</div>
          <div style={{ fontWeight: '700', color: getStatusColor(session.status), fontSize: '0.85rem' }}>{session.status}</div>
        </div>
        {session.status === 'IN_PROGRESS' && (
          <button 
            onClick={() => navigate(`/practice/${session.id}`)}
            style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: '600', cursor: 'pointer' }}
          >
            Resume
          </button>
        )}
      </div>
    </div>
  );
}