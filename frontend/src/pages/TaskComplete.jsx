import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './TaskComplete.css';

function TaskComplete() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [taskName, setTaskName] = useState('');
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    if (location.state) {
      setTaskName(location.state.taskName || 'Task');
      setCompletedCount(location.state.completedCount || user?.completedTasksCount || 0);
    } else {
      // If no state, redirect to task list
      navigate('/tasks');
    }

    // Auto-redirect after 3 seconds to return location or tasks
    const returnTo = location.state?.returnTo || '/tasks';
    const timer = setTimeout(() => {
      navigate(returnTo);
    }, 3000);

    return () => clearTimeout(timer);
  }, [location.state, navigate, user]);

  return (
    <div className="task-complete-container">
      <div className="task-complete-card">
        <div className="success-icon">✓</div>
        <h1>Task Completed!</h1>
        <p className="task-name-display">"{taskName}"</p>
        <div className="completed-count">
          <span className="count-number">+1</span>
          <span className="count-label">task completed</span>
        </div>
        <div className="total-count">
          Total completed: <strong>{completedCount}</strong>
        </div>
        <div className="complete-actions">
          <button 
            onClick={() => navigate(location.state?.returnTo || '/tasks')} 
            className="back-to-tasks-button"
          >
            {location.state?.returnTo === '/break-reminder' ? 'Back to Break Reminder' : 'Back to Tasks'}
          </button>
          <button onClick={() => navigate('/dashboard')} className="go-to-dashboard-button">
            Go to Dashboard
          </button>
        </div>
        <p className="auto-redirect">Redirecting in 3 seconds...</p>
      </div>
    </div>
  );
}

export default TaskComplete;

