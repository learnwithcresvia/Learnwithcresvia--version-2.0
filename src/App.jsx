// src/App.jsx - SAFE VERSION
// Only imports pages that exist in a standard project setup

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthProvider from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';

// ── Core pages (these exist in your project) ──────────────────────────────
import HomePage              from './pages/HomePage';
import LoginPage             from './pages/LoginPage';
import SignupPage            from './pages/SignupPage';
import ProfileCompletionPage from './pages/ProfileCompletionPage';
import StudentDashboard      from './pages/StudentDashboard';
import PracticeHub           from './pages/PracticeHub';
import PracticeSession       from './pages/PracticeSession';
import BattleArena           from './pages/BattleArena';
import BattleSession         from './pages/BattleSession';
import Leaderboard           from './pages/Leaderboard';

// ── New pages (copy these to src/pages/ first) ────────────────────────────
import AdminDashboard        from './pages/AdminDashboard';
import StaffDashboard        from './pages/StaffDashboard';
import HODDashboard          from './pages/HODDashboard';
import LanguageSurvey        from './pages/LanguageSurvey';
import KnowledgeQuiz         from './pages/KnowledgeQuiz';
import QuestionCodingScreen  from './pages/QuestionCodingScreen';

// ── Spinner ───────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', flexDirection:'column', gap:'1rem' }}>
      <div style={{ width:40, height:40, border:'4px solid #e0e0e0', borderTop:'4px solid #667eea', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ color:'#999', margin:0 }}>Loading...</p>
    </div>
  );
}

// ── Route guards ──────────────────────────────────────────────────────────
const STAFF_ROLES = ['ADMIN', 'HOD', 'STAFF', 'COORDINATOR'];

function Protected({ children, needProfile = true }) {
  const { user, profile, loading } = useAuth();
  if (loading)           return <Spinner />;
  if (!user)             return <Navigate to="/login" replace />;
  if (!profile)          return <Spinner />; // profile still arriving

  const isStaff   = STAFF_ROLES.includes(profile.role);
  const completed = profile.profile_completed;

  if (needProfile && !isStaff && !completed) {
    return <Navigate to="/complete-profile" replace />;
  }
  return children;
}

function roleToDashboard(role, completed) {
  if (!completed && role === 'STUDENT') return '/complete-profile';
  switch(role) {
    case 'ADMIN':       return '/admin';
    case 'HOD':         return '/hod-dashboard';
    case 'COORDINATOR': return '/coordinator-dashboard';
    case 'STAFF':       return '/staff-dashboard';
    default:            return '/dashboard';
  }
}

function Public({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading)  return <Spinner />;
  if (!user)    return children;
  if (!profile) return <Spinner />;

  return <Navigate to={roleToDashboard(profile.role, profile.profile_completed)} replace />;
}

// ── Routes ────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      <Route path="/"        element={<HomePage />} />
      <Route path="/login"   element={<Public><LoginPage /></Public>} />
      <Route path="/signup"  element={<Public><SignupPage /></Public>} />

      <Route path="/complete-profile" element={<Protected needProfile={false}><ProfileCompletionPage /></Protected>} />

      <Route path="/dashboard"                     element={<Protected><StudentDashboard /></Protected>} />
      <Route path="/practice-hub"                  element={<Protected><PracticeHub /></Protected>} />
      <Route path="/practice/:sessionId"           element={<Protected><PracticeSession /></Protected>} />
      <Route path="/practice/question/:questionId" element={<Protected><QuestionCodingScreen /></Protected>} />
      <Route path="/battle-arena"                  element={<Protected><BattleArena /></Protected>} />
      <Route path="/battle/:battleId"              element={<Protected><BattleSession /></Protected>} />
      <Route path="/leaderboard"                   element={<Protected><Leaderboard /></Protected>} />
      <Route path="/language-survey"               element={<Protected><LanguageSurvey /></Protected>} />
      <Route path="/knowledge-quiz"                element={<Protected><KnowledgeQuiz /></Protected>} />

      <Route path="/admin"                         element={<Protected><AdminDashboard /></Protected>} />
      <Route path="/staff-dashboard"               element={<Protected><StaffDashboard /></Protected>} />
      <Route path="/coordinator-dashboard"         element={<Protected><StaffDashboard /></Protected>} />
      <Route path="/hod-dashboard"                 element={<Protected><HODDashboard /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
