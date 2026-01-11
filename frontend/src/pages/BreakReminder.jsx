import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../components/ToastContainer';
import './BreakReminder.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function BreakReminder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError, showInfo } = useToast();
  const [loading, setLoading] = useState(true);
  const [reminderData, setReminderData] = useState(null);
  const [error, setError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    if (user) {
      fetchBreakReminder();
      // Refresh every 30 seconds to check if break has started
      const interval = setInterval(() => {
        fetchBreakReminder();
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    } else {
      navigate('/login');
    }
  }, [user, navigate]);

  // Update countdown timer every second
  useEffect(() => {
    if (!reminderData?.hasBreak || reminderData?.isBreakTime) {
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const breakStart = new Date(reminderData.nextBreak.start);
      const remaining = Math.max(0, Math.floor((breakStart.getTime() - now.getTime()) / 1000));
      setTimeRemaining(remaining);

      // If break has started, refresh data
      if (remaining === 0) {
        fetchBreakReminder();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reminderData]);

  const fetchBreakReminder = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/calendar/break-reminder`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setReminderData(response.data);
        
        // Calculate initial time remaining if break hasn't started
        if (response.data.hasBreak && !response.data.isBreakTime) {
          const now = new Date();
          const breakStart = new Date(response.data.nextBreak.start);
          const remaining = Math.max(0, Math.floor((breakStart.getTime() - now.getTime()) / 1000));
          setTimeRemaining(remaining);
        }
      }
    } catch (error) {
      console.error('Error fetching break reminder:', error);
      const errorMsg = error.response?.data?.message || 'Could not get break reminder.';
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/tasks/${taskId}/complete`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        // Remove completed task from list
        setReminderData(prev => ({
          ...prev,
          suggestedTasks: prev.suggestedTasks.filter(task => task.id !== taskId),
          taskCount: prev.taskCount - 1
        }));
        
        // Show success toast before navigating
        showSuccess(`Task "${response.data.task.name}" completed!`);
        
        // Show completion screen
        navigate('/task-complete', { 
          state: { 
            taskName: response.data.task.name,
            completedCount: response.data.completedTasksCount,
            returnTo: '/break-reminder'
          } 
        });
      }
    } catch (error) {
      console.error('Error completing task:', error);
      const errorMsg = error.response?.data?.message || 'Could not complete task.';
      setError(errorMsg);
      showError(errorMsg);
    }
  };

  const formatTimeRemaining = (seconds) => {
    if (seconds < 60) {
      return `${seconds} seconds`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes < 60) {
      return secs > 0 ? `${minutes}m ${secs}s` : `${minutes} minutes`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
  };

  const getImportanceColor = (importance) => {
    if (importance >= 5) return '#ef4444';
    if (importance >= 4) return '#f59e0b';
    if (importance >= 3) return '#3b82f6';
    return '#6b7280';
  };

  const getImportanceLabel = (importance) => {
    if (importance >= 5) return 'Critical';
    if (importance >= 4) return 'High';
    if (importance >= 3) return 'Medium';
    return 'Low';
  };

  if (loading) {
    return (
      <div className="break-reminder-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Checking for breaks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="break-reminder-container">
        <div className="error-state">
          <p className="error-message">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="back-button">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // If no break found or break not starting yet
  if (!reminderData?.hasBreak || !reminderData?.isBreakTime) {
    return (
      <div className="break-reminder-container">
        <div className="no-break-state">
          <h1>⏰ No Break Starting Yet</h1>
          {reminderData?.hasBreak && timeRemaining && (
            <div className="countdown-display">
              <p className="countdown-label">Next break starts in:</p>
              <p className="countdown-time">{formatTimeRemaining(timeRemaining)}</p>
              <p className="countdown-break-time">
                {new Date(reminderData.nextBreak.start).toLocaleString()}
              </p>
              <p className="countdown-duration">
                Duration: {reminderData.nextBreak.durationMinutes} minutes
              </p>
            </div>
          )}
          {!reminderData?.hasBreak && (
            <p className="no-break-message">No breaks found in the next 24 hours</p>
          )}
          <button onClick={() => navigate('/dashboard')} className="back-to-dashboard-button">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Break is starting/has started - show reminder screen (S-003)
  const { nextBreak, suggestedTasks, taskCount, breakDuration } = reminderData;
  const breakStart = new Date(nextBreak.start);
  const breakEnd = new Date(nextBreak.end);

  return (
    <div className="break-reminder-container">
      <div className="break-reminder-card">
        <div className="break-header">
          <div className="break-icon-large">⏰</div>
          <div className="break-title-section">
            <h1 className="break-title">Break Time!</h1>
            <p className="break-subtitle">Here are tasks you can finish:</p>
          </div>
        </div>

        <div className="break-info-card">
          <div className="break-info-row">
            <span className="break-info-label">Duration:</span>
            <span className="break-info-value">{breakDuration} minutes</span>
          </div>
          <div className="break-info-row">
            <span className="break-info-label">Starts:</span>
            <span className="break-info-value">{breakStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="break-info-row">
            <span className="break-info-label">Ends:</span>
            <span className="break-info-value">{breakEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {suggestedTasks && suggestedTasks.length > 0 ? (
          <div className="suggested-tasks-section">
            <h2 className="suggested-tasks-title">
              Suggested Tasks ({taskCount} {taskCount === 1 ? 'task' : 'tasks'} fit this break)
            </h2>
            <div className="suggested-tasks-list">
              {suggestedTasks.map((task) => {
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.done;
                
                return (
                  <div 
                    key={task.id} 
                    className={`suggested-task-item ${isOverdue ? 'overdue' : ''}`}
                    style={{ borderLeftColor: getImportanceColor(task.importance) }}
                  >
                    <div className="suggested-task-header">
                      <div className="suggested-task-name-section">
                        <h3 className="suggested-task-name">{task.name}</h3>
                        {task.source === 'email' && (
                          <span className="task-source-badge email">
                            {task.sourceData?.emailFrom ? `From ${task.sourceData.emailFrom.split('<')[0].trim() || task.sourceData.emailFrom}` : 'From Email'}
                          </span>
                        )}
                        {task.source === 'manual' && (
                          <span className="task-source-badge manual">Custom</span>
                        )}
                      </div>
                      <span 
                        className="suggested-task-importance"
                        style={{ backgroundColor: getImportanceColor(task.importance) }}
                      >
                        {task.importance} - {getImportanceLabel(task.importance)}
                      </span>
                    </div>

                    {task.description && (
                      <p className="suggested-task-description">{task.description}</p>
                    )}

                    <div className="suggested-task-footer">
                      <div className="suggested-task-meta">
                        {task.dueDate && (
                          <span className={`suggested-task-due ${isOverdue ? 'overdue' : ''}`}>
                            📅 Due: {new Date(task.dueDate).toLocaleDateString()} {new Date(task.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {task.estimatedMinutes && (
                          <span className="suggested-task-time">
                            ⏱️ {task.estimatedMinutes} min
                          </span>
                        )}
                        {!task.estimatedMinutes && (
                          <span className="suggested-task-time no-estimate">
                            ⏱️ No time estimate
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleCompleteTask(task.id)}
                        className="complete-task-button"
                      >
                        ✓ Complete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="no-tasks-section">
            <div className="no-tasks-icon">📝</div>
            <h2 className="no-tasks-title">No tasks fit this break</h2>
            <p className="no-tasks-message">
              All your tasks are longer than {breakDuration} minutes, or you don't have any tasks.
            </p>
            <div className="no-tasks-actions">
              <button 
                onClick={() => navigate('/tasks')} 
                className="view-all-tasks-button"
              >
                View All Tasks
              </button>
              <button 
                onClick={() => navigate('/dashboard')} 
                className="back-to-dashboard-button"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}

        <div className="break-reminder-actions">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="back-to-dashboard-button-secondary"
          >
            Back to Dashboard
          </button>
          <button 
            onClick={() => {
              fetchBreakReminder();
              showInfo('Refreshing break reminder...');
            }}
            className="refresh-button"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

export default BreakReminder;

