// src/pages/KnowledgeQuiz.jsx
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const QUIZ_BANK = {
  python: [
    { q: "What will print(type(5)) output?", options: ["<class 'int'>","<class 'number'>","int","5"], answer: 0 },
    { q: "Which creates a list in Python?", options: ["{}","()","[]","<>"], answer: 2 },
    { q: "What does len('hello') return?", options: ["4","5","6","Error"], answer: 1 },
    { q: "Output of: for i in range(3): print(i)", options: ["1 2 3","0 1 2","0 1 2 3","1 2"], answer: 1 },
    { q: "Which keyword defines a function in Python?", options: ["function","func","def","define"], answer: 2 },
    { q: "What does append() do?", options: ["Remove last","Add to start","Add to end","Sort list"], answer: 2 },
    { q: "What is a dictionary?", options: ["Ordered list","Key-value pairs","Set of values","Tuple"], answer: 1 },
    { q: "What does 'self' mean in a class method?", options: ["Built-in variable","Refers to current instance","Like 'this' in Java","Refers to class"], answer: 1 },
  ],
  javascript: [
    { q: "Which keyword declares a block-scoped variable?", options: ["var","let","const","let and const"], answer: 3 },
    { q: "What does === check?", options: ["Value only","Type only","Value and type","Neither"], answer: 2 },
    { q: "typeof [] returns?", options: ["array","object","list","undefined"], answer: 1 },
    { q: "What is a Promise?", options: ["Creates objects","Handles async operations","Declares variables","Loops arrays"], answer: 1 },
    { q: "Which method transforms every array element?", options: ["forEach","filter","map","reduce"], answer: 2 },
  ],
  java: [
    { q: "Entry point of a Java program?", options: ["start()","main()","init()","run()"], answer: 1 },
    { q: "Which keyword prevents a variable from being changed?", options: ["static","private","final","const"], answer: 2 },
    { q: "What is inheritance?", options: ["Copying code","Class acquiring properties of another","Creating objects","Hiding variables"], answer: 1 },
    { q: "JVM stands for?", options: ["Java Virtual Machine","Java Variable Manager","Java Version Manager","Java Visual Mode"], answer: 0 },
    { q: "Which is NOT a Java primitive?", options: ["int","boolean","String","double"], answer: 2 },
  ],
  cpp: [
    { q: "What does :: do in C++?", options: ["Pointer access","Scope resolution","Bitwise OR","Null check"], answer: 1 },
    { q: "A pointer is?", options: ["A special loop","A variable storing memory address","A type of class","A built-in array"], answer: 1 },
    { q: "Header file needed for cout?", options: ["stdio.h","stdlib.h","iostream","string.h"], answer: 2 },
    { q: "A constructor is?", options: ["Called when object is created","Destroys objects","A type of loop","A header file"], answer: 0 },
    { q: "What does 'new' do in C++?", options: ["Declares variable","Creates file","Allocates heap memory","Defines class"], answer: 2 },
  ],
};

function getLevel(score, total) {
  const pct = (score / total) * 100;
  if (pct >= 80) return { level: 'HARD',   label: 'Advanced',     color: '#DC2626', emoji: '🔥' };
  if (pct >= 50) return { level: 'MEDIUM', label: 'Intermediate', color: '#D97706', emoji: '⚡' };
  return           { level: 'EASY',   label: 'Beginner',     color: '#16A34A', emoji: '🌱' };
}

export default function KnowledgeQuiz() {
  const navigate  = useNavigate();
  const [params]  = useSearchParams();
  const lang      = params.get('lang') || 'python';
  const questions = QUIZ_BANK[lang] || QUIZ_BANK.python;

  const [current,    setCurrent]    = useState(0);
  const [answers,    setAnswers]    = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [score,      setScore]      = useState(0);

  function handleAnswer(idx) { if (selected !== null) return; setSelected(idx); }

  function handleNext() {
    const isCorrect  = selected === questions[current].answer;
    const newAnswers = [...answers, { selected, correct: isCorrect }];
    setAnswers(newAnswers);
    if (current + 1 >= questions.length) {
      const finalScore = newAnswers.filter(a => a.correct).length;
      setScore(finalScore);
      setShowResult(true);
    } else {
      setCurrent(c => c + 1);
      setSelected(null);
    }
  }

  if (showResult) {
    const result = getLevel(score, questions.length);
    const pct    = Math.round((score / questions.length) * 100);
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={{ fontSize: '4rem', textAlign: 'center', marginBottom: '1rem' }}>{result.emoji}</div>
          <h1 style={{ ...S.title, color: result.color }}>{result.label} Level!</h1>
          <p style={S.sub}>You scored <strong>{score}/{questions.length}</strong> ({pct}%)</p>
          <div style={{ background: '#F3F4F6', borderRadius: 10, height: 12, marginBottom: '1.5rem', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 10, width: `${pct}%`, background: result.color, transition: 'width 1s' }} />
          </div>
          <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '1rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Starting you with <span style={{ color: result.color }}>{result.label}</span> questions</p>
            <p style={{ margin: '0.5rem 0 0', color: '#6B7280', fontSize: '0.85rem' }}>You can change difficulty anytime</p>
          </div>
          <button onClick={() => navigate(`/practice-hub?lang=${lang}&level=${result.level}`)} style={{ ...S.btn, background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white' }}>
            Start Practicing! 🚀
          </button>
        </div>
      </div>
    );
  }

  const q        = questions[current];
  const progress = (current / questions.length) * 100;

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <span style={S.step}>Step 2 of 2 — Knowledge Check</span>
          <button onClick={() => navigate(`/practice-hub?lang=${lang}&level=EASY`)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '0.85rem' }}>Skip →</button>
        </div>
        <div style={{ background: '#E5E7EB', borderRadius: 10, height: 8, marginBottom: '1.5rem' }}>
          <div style={{ height: '100%', borderRadius: 10, width: `${progress}%`, background: 'linear-gradient(90deg,#667eea,#764ba2)', transition: 'width 0.3s' }} />
        </div>
        <div style={{ color: '#6B7280', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Question {current + 1} of {questions.length}</div>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1F2937', marginBottom: '1.5rem' }}>{q.q}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {q.options.map((opt, i) => {
            const isCorrectAns = i === q.answer;
            const isSelected   = i === selected;
            const bg = selected === null ? 'white' : isCorrectAns ? '#DCFCE7' : isSelected ? '#FEE2E2' : 'white';
            const bd = selected === null ? '2px solid #E5E7EB' : isCorrectAns ? '2px solid #16A34A' : isSelected ? '2px solid #DC2626' : '2px solid #E5E7EB';
            return (
              <div key={i} onClick={() => handleAnswer(i)}
                style={{ padding: '0.9rem 1rem', borderRadius: 10, background: bg, border: bd, cursor: selected !== null ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', transition: 'all 0.2s' }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: selected !== null && isCorrectAns ? '#16A34A' : selected !== null && isSelected ? '#DC2626' : '#F3F4F6', color: selected !== null && (isCorrectAns || isSelected) ? 'white' : '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {selected !== null && isCorrectAns ? '✓' : selected !== null && isSelected ? '✗' : String.fromCharCode(65 + i)}
                </span>
                <span style={{ color: '#374151', fontSize: '0.95rem' }}>{opt}</span>
              </div>
            );
          })}
        </div>
        <button onClick={handleNext} disabled={selected === null}
          style={{ ...S.btn, ...(selected !== null ? { background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white' } : { background: '#E5E7EB', color: '#9CA3AF', cursor: 'not-allowed' }) }}>
          {current + 1 >= questions.length ? 'See Results 🎯' : 'Next →'}
        </button>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' },
  card: { background: 'white', borderRadius: 20, padding: '2.5rem', width: '100%', maxWidth: 600, boxShadow: '0 25px 60px rgba(0,0,0,0.25)' },
  step: { background: '#EEF2FF', color: '#6366F1', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 },
  title: { fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem', textAlign: 'center' },
  sub:   { color: '#6B7280', marginBottom: '1.5rem', textAlign: 'center' },
  btn:   { width: '100%', padding: '1rem', borderRadius: 10, border: 'none', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' },
};
