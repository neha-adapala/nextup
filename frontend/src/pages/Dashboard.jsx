import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../components/ToastContainer';
import './Dashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError, showInfo } = useToast();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [taskStats, setTaskStats] = useState(null);
  const [calendarData, setCalendarData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      fetchData();
      
      // Check for break reminders every 30 seconds (F-005)
      const breakCheckInterval = setInterval(async () => {
        try {
          const token = localStorage.getItem('token');
          const headers = { Authorization: `Bearer ${token}` };
          
          const response = await axios.get(`${API_URL}/api/calendar/break-reminder`, { headers });
          
          // If break is starting/has started, navigate to reminder screen
          if (response.data.success && response.data.hasBreak && response.data.isBreakTime) {
            navigate('/break-reminder');
          }
        } catch (error) {
          console.error('Error checking for break:', error);
          // Don't show error to user, just log it
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(breakCheckInterval);
    }
  }, [user, navigate]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch tasks, calendar, and refresh user data in parallel
      const [tasksResponse, calendarResponse] = await Promise.allSettled([
        axios.get(`${API_URL}/api/tasks?refresh=true`, { headers }),
        axios.get(`${API_URL}/api/calendar/next-break`, { headers }),
        axios.get(`${API_URL}/api/auth/verify`, { headers }) // Refresh user data to get updated completed count
      ]);

      if (tasksResponse.status === 'fulfilled') {
        setTasks(tasksResponse.value.data.tasks || []);
        setTaskStats(tasksResponse.value.data.stats || {});
      } else {
        console.error('Tasks fetch error:', tasksResponse.reason);
        const errorMsg = tasksResponse.reason?.response?.data?.message || 'Failed to fetch tasks';
        setError(errorMsg);
        showError(errorMsg);
      }

      if (calendarResponse.status === 'fulfilled') {
        setCalendarData(calendarResponse.value.data);
      } else {
        console.error('Calendar fetch error:', calendarResponse.reason);
        // Calendar errors are non-critical, don't show toast for them
      }

      // Update user completed count if verify succeeded
      if (tasksResponse.status === 'fulfilled' && tasksResponse.value.data.stats) {
        // User data will be updated when tasks are completed
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      const errorMsg = error.response?.data?.message || 'Failed to fetch data';
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleRefresh = () => {
    fetchData();
    showInfo('Refreshing dashboard...');
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
        setTasks(tasks.filter(task => task.id !== taskId));
        // Update stats
        if (taskStats) {
          setTaskStats({
            ...taskStats,
            completedTasks: (taskStats.completedTasks || 0) + 1,
            totalTasks: Math.max(0, (taskStats.totalTasks || 0) - 1)
          });
        }
        // Refresh user data to get updated completed count from database
        // The completion screen will show the correct count from response.data.completedTasksCount
        // Show success toast before navigating
        showSuccess(`Task "${response.data.task.name}" completed!`);
        // Show completion screen immediately with updated count
        navigate('/task-complete', { 
          state: { 
            taskName: response.data.task.name,
            completedCount: response.data.completedTasksCount 
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

  // Filter tasks for today
  const getTodayTasks = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return tasks.filter(task => {
      // Include tasks that:
      // 1. Are due today (dueDate is today)
      // 2. Were created today
      // 3. Don't have a due date but were created today
      const taskDate = task.dueDate ? new Date(task.dueDate) : new Date(task.createdAt);
      taskDate.setHours(0, 0, 0, 0);
      
      if (task.dueDate) {
        // Task has a due date - include if due today
        return taskDate.getTime() === today.getTime();
      } else {
        // No due date - include if created today
        const createdDate = new Date(task.createdAt);
        createdDate.setHours(0, 0, 0, 0);
        return createdDate.getTime() === today.getTime();
      }
    });
  };

  const todayTasks = getTodayTasks();

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Welcome, {user?.name || 'User'}!</h1>
        <div className="header-actions">
          <button onClick={handleRefresh} className="refresh-button" disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading your dashboard...</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <p className="error-message">{error}</p>
            <button onClick={handleRefresh} className="retry-button">Try Again</button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Completed Count - Prominent Display (S-002 requirement) */}
            <section className="dashboard-section completed-count-section">
              <div className="completed-count-card">
                <div className="completed-icon">✓</div>
                <div className="completed-count-content">
                  <h2 className="completed-count-number">{user?.completedTasksCount || 0}</h2>
                  <p className="completed-count-label">Tasks Completed</p>
                </div>
                <div className="completed-count-message">
                  Great job! Keep it up! 🎉
                </div>
              </div>
            </section>

            {/* Next Break Section (S-002 requirement) */}
            <section className="dashboard-section">
              <div className="section-header">
                <h2>Next Break</h2>
                {calendarData?.hasBreak && calendarData.nextBreak.isStartingSoon && (
                  <button 
                    onClick={() => navigate('/break-reminder')} 
                    className="view-break-reminder-button"
                  >
                    View Break Reminder →
                  </button>
                )}
              </div>
              {calendarData?.hasBreak ? (
                <div className="next-break-card">
                  <div className="break-header">
                    <span className="break-icon">⏰</span>
                    {calendarData.nextBreak.isStartingSoon && (
                      <span className="break-alert-badge">Starting Soon!</span>
                    )}
                  </div>
                  <div className="break-time">
                    <span className="break-label">Starts:</span>
                    <span className="break-value">
                      {new Date(calendarData.nextBreak.start).toLocaleDateString()} at {new Date(calendarData.nextBreak.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="break-duration">
                    <span className="break-label">Duration:</span>
                    <span className="break-value">{calendarData.nextBreak.durationMinutes} minutes</span>
                  </div>
                  {calendarData.nextBreak.minutesUntilStart !== undefined && (
                    <div className="break-countdown">
                      {calendarData.nextBreak.minutesUntilStart > 0 ? (
                        <span>{calendarData.nextBreak.minutesUntilStart} minutes until break starts</span>
                      ) : (
                        <div>
                          <span className="break-now">Break time now! 🎉</span>
                          <button 
                            onClick={() => navigate('/break-reminder')} 
                            className="view-reminder-button"
                            style={{ marginTop: '12px', width: '100%' }}
                          >
                            View Tasks for This Break
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-break-message">
                  <p>No free time found in the next 24 hours</p>
                  <button onClick={handleRefresh} className="refresh-break-button">
                    Refresh Calendar
                  </button>
                </div>
              )}
            </section>

            {/* Today's Tasks Section (S-002 requirement) */}
            <section className="dashboard-section">
              <div className="section-header">
                <h2>Today's Tasks</h2>
                <button 
                  onClick={() => navigate('/tasks')} 
                  className="view-all-tasks-button"
                >
                  View All Tasks →
                </button>
              </div>
              {todayTasks.length > 0 ? (
                <div className="today-tasks-list">
                  {todayTasks.slice(0, 5).map((task) => {
                    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.done;
                    const importanceColors = {
                      5: '#ef4444',
                      4: '#f59e0b',
                      3: '#3b82f6',
                      2: '#6b7280',
                      1: '#9ca3af'
                    };
                    const importanceLabels = {
                      5: 'Critical',
                      4: 'High',
                      3: 'Medium',
                      2: 'Low',
                      1: 'Very Low'
                    };
                    
                    return (
                      <div 
                        key={task.id} 
                        className={`today-task-item ${isOverdue ? 'overdue' : ''}`}
                        style={{ borderLeftColor: importanceColors[task.importance] || '#3b82f6' }}
                      >
                        <div className="today-task-main">
                          <h3 className="today-task-name">{task.name}</h3>
                          <span 
                            className="today-task-importance"
                            style={{ backgroundColor: importanceColors[task.importance] || '#3b82f6' }}
                          >
                            {task.importance} - {importanceLabels[task.importance]}
                          </span>
                        </div>
                        {task.description && (
                          <p className="today-task-description">{task.description}</p>
                        )}
                        <div className="today-task-footer">
                          <div className="today-task-meta">
                            {task.dueDate && (
                              <span className={`today-task-due ${isOverdue ? 'overdue' : ''}`}>
                                📅 Due: {new Date(task.dueDate).toLocaleDateString()} {new Date(task.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {task.estimatedMinutes && (
                              <span className="today-task-time">
                                ⏱️ {task.estimatedMinutes} min
                              </span>
                            )}
                            {task.source === 'email' && (
                              <span className="today-task-source">
                                📧 {task.sourceData?.emailFrom ? `From ${task.sourceData.emailFrom.split('<')[0].trim() || task.sourceData.emailFrom}` : 'From email'}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleCompleteTask(task.id)}
                            className="complete-task-button-small"
                          >
                            ✓ Complete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {todayTasks.length > 5 && (
                    <p className="more-tasks-info">
                      +{todayTasks.length - 5} more tasks today. <button onClick={() => navigate('/tasks')} className="link-button">View all</button>
                    </p>
                  )}
                </div>
              ) : (
                <div className="no-data-section">
                  <p className="no-data">No tasks for today</p>
                  <button 
                    onClick={() => navigate('/tasks')} 
                    className="go-to-tasks-button"
                  >
                    Add Tasks
                  </button>
                </div>
              )}
            </section>

            {/* Summary Stats Section */}
            <section className="dashboard-section">
              <h2>Summary</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{taskStats?.totalTasks || 0}</div>
                  <div className="stat-label">Total Tasks</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{todayTasks.length}</div>
                  <div className="stat-label">Today's Tasks</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value overdue-stat">{taskStats?.overdueTasks || 0}</div>
                  <div className="stat-label">Overdue</div>
                </div>
                <div className="stat-card highlight-stat">
                  <div className="stat-value">{user?.completedTasksCount || 0}</div>
                  <div className="stat-label">Completed</div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default Dashboard;

