// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthProvider from './contexts/AuthContext';
import { ThemeProvider } from './hooks/useTheme';
import { useAuth } from './hooks/useAuth';
import AppLayout from './components/AppLayout';

// ── Core pages ────────────────────────────────────────────────────────────────
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
import QuestionCodingScreen  from './pages/QuestionCodingScreen';
import LanguageSurvey        from './pages/LanguageSurvey';
import KnowledgeQuiz         from './pages/KnowledgeQuiz';
import AnnouncementsPage     from './pages/AnnouncementsPage';

// ── Staff / Admin ─────────────────────────────────────────────────────────────
import AdminDashboard        from './pages/AdminDashboard';
import AIQuestionGenerator   from './pages/AIQuestionGenerator';
import DirectorDashboard     from './pages/DirectorDashboard';
import StaffDashboard        from './pages/StaffDashboard';
import HODDashboard          from './pages/HODDashboard';

// ── Study Hub ─────────────────────────────────────────────────────────────────
import StudyHub              from './pages/StudyHub';
import SubjectPage           from './pages/SubjectPage';
import StaffStudyHub         from './pages/StaffStudyHub';

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', flexDirection:'column', gap:'1rem', background:'#0f1117' }}>
      <div style={{ width:40, height:40, border:'4px solid #1e2433', borderTop:'4px solid #667eea', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ color:'#4a5568', margin:0, fontFamily:'"Inter",sans-serif' }}>Loading...</p>
    </div>
  );
}

// ── Route guards ──────────────────────────────────────────────────────────────
const STAFF_ROLES = ['ADMIN', 'DIRECTOR', 'HOD', 'STAFF', 'COORDINATOR'];

// Wraps children in AppLayout (sidebar) — only for authenticated pages
function WithLayout({ children }) {
  return <AppLayout>{children}</AppLayout>;
}

function Protected({ children, needProfile = true, allowRoles, withLayout = true }) {
  const { user, profile, loading } = useAuth();
  if (loading)  return <Spinner />;
  if (!user)    return <Navigate to="/login" replace />;
  if (!profile) return <Spinner />;

  const isStaff = STAFF_ROLES.includes(profile.role);

  if (needProfile && !isStaff && !profile.profile_completed) {
    return <Navigate to="/complete-profile" replace />;
  }
  if (allowRoles && !allowRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return withLayout ? <WithLayout>{children}</WithLayout> : children;
}

function StaffOnly({ children }) {
  return <Protected allowRoles={STAFF_ROLES}>{children}</Protected>;
}

function Public({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading)  return <Spinner />;
  if (!user)    return children;
  if (!profile) return <Spinner />;
  return <Navigate to={roleToDashboard(profile.role, profile.profile_completed)} replace />;
}

function roleToDashboard(role, completed) {
  if (!completed && role === 'STUDENT') return '/complete-profile';
  switch (role) {
    case 'ADMIN':       return '/admin';
    case 'DIRECTOR':    return '/director-dashboard';
    case 'HOD':         return '/hod-dashboard';
    case 'COORDINATOR': return '/coordinator-dashboard';
    case 'STAFF':       return '/staff-dashboard';
    default:            return '/dashboard';
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* Public — no layout */}
      <Route path="/"       element={<HomePage />} />
      <Route path="/login"  element={<Public><LoginPage /></Public>} />
      <Route path="/signup" element={<Public><SignupPage /></Public>} />

      {/* Onboarding — no sidebar yet (profile not complete) */}
      <Route path="/complete-profile" element={<Protected needProfile={false} withLayout={false}><ProfileCompletionPage /></Protected>} />
      <Route path="/language-survey"  element={<Protected withLayout={false}><LanguageSurvey /></Protected>} />
      <Route path="/knowledge-quiz"   element={<Protected withLayout={false}><KnowledgeQuiz /></Protected>} />

      {/* ── Student (all get sidebar) ── */}
      <Route path="/dashboard"                     element={<Protected><StudentDashboard /></Protected>} />
      <Route path="/practice-hub"                  element={<Protected><PracticeHub /></Protected>} />
      <Route path="/practice/:sessionId"           element={<Protected><PracticeSession /></Protected>} />
      <Route path="/practice/question/:questionId" element={<Protected><QuestionCodingScreen /></Protected>} />
      <Route path="/battle-arena"                  element={<Protected><BattleArena /></Protected>} />
      <Route path="/battle/:battleId"              element={<Protected><BattleSession /></Protected>} />
      <Route path="/leaderboard"                   element={<Protected><Leaderboard /></Protected>} />
      <Route path="/announcements"                 element={<Protected><AnnouncementsPage /></Protected>} />

      {/* ── Study Hub ── */}
      {/* Students: browse + contribute */}
      <Route path="/study-hub"                     element={<Protected><StudyHub /></Protected>} />
      <Route path="/study-hub/subject/:subjectId"  element={<Protected><SubjectPage /></Protected>} />
      {/* Staff + HOD + Admin: manage + review pending contributions */}
      <Route path="/study-hub/manage"              element={<StaffOnly><StaffStudyHub /></StaffOnly>} />

      {/* ── Staff ── */}
      <Route path="/staff-dashboard"               element={<Protected><StaffDashboard /></Protected>} />
      <Route path="/coordinator-dashboard"         element={<Protected><StaffDashboard /></Protected>} />
      <Route path="/hod-dashboard"                 element={<Protected><HODDashboard /></Protected>} />
      <Route path="/ai-question-generator"         element={<Protected><AIQuestionGenerator /></Protected>} />

      {/* ── Admin / Director ── */}
      <Route path="/admin"                         element={<Protected><AdminDashboard /></Protected>} />
      <Route path="/director-dashboard"            element={<Protected><DirectorDashboard /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AppRoutes />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
