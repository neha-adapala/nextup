import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import TaskList from './pages/TaskList';
import TaskComplete from './pages/TaskComplete';
import BreakReminder from './pages/BreakReminder';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ToastContainer';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={user ? <Navigate to="/dashboard" /> : <Login />} 
      />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route 
        path="/dashboard" 
        element={user ? <Dashboard /> : <Navigate to="/login" />} 
      />
      <Route 
        path="/tasks" 
        element={user ? <TaskList /> : <Navigate to="/login" />} 
      />
      <Route 
        path="/task-complete" 
        element={user ? <TaskComplete /> : <Navigate to="/login" />} 
      />
      <Route 
        path="/break-reminder" 
        element={user ? <BreakReminder /> : <Navigate to="/login" />} 
      />
      <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;

