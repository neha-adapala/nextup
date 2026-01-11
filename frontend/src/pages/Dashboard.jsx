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
  const [productivityTimeRemaining, setProductivityTimeRemaining] = useState(null);

  // Calculate productivity period countdown (time until next break)
  useEffect(() => {
    if (!calendarData?.hasBreak || !calendarData.nextBreak.start) {
      // Default to 2 hours if no break data
      setProductivityTimeRemaining(2 * 3600);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const breakStart = new Date(calendarData.nextBreak.start);
      const remaining = Math.max(0, Math.floor((breakStart.getTime() - now.getTime()) / 1000));
      setProductivityTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [calendarData]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatDueDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear().toString().slice(-2);
    return `DUE ${month}/${day}/${year}`;
  };

  const formatNextPeriodDate = (dateString) => {
    if (!dateString) {
      // Default fallback date
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 1);
      defaultDate.setHours(15, 50, 0, 0);
      dateString = defaultDate.toISOString();
    }
    const date = new Date(dateString);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = String(minutes).padStart(2, '0');
    return {
      date: `${month} ${day}`,
      time: `${displayHours}:${displayMinutes} ${ampm}`
    };
  };

  const isTimerAtZero = productivityTimeRemaining !== null && productivityTimeRemaining <= 0;
  
  // Get next period info - if timer is at zero, show next break, otherwise calculate from current break end
  const getNextPeriodInfo = () => {
    if (calendarData?.hasBreak && calendarData.nextBreak.start) {
      // If we're in a break, the next period starts when this break ends
      if (isTimerAtZero && calendarData.nextBreak.end) {
        return formatNextPeriodDate(calendarData.nextBreak.end);
      }
      // Otherwise, show when the next break starts (which is when current period ends)
      return formatNextPeriodDate(calendarData.nextBreak.start);
    }
    // Fallback to default
    return formatNextPeriodDate(null);
  };

  const nextPeriodInfo = getNextPeriodInfo();

  return (
    <div className="dashboard-container">
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
          {/* Productivity Timer Section */}
          <div className="productivity-timer-section">
            {isTimerAtZero ? (
              <>
                <p className="productivity-timer-label productivity-timer-label-dark">YOUR NEXT PRODUCTIVITY PERIOD IS AT:</p>
                <div className="productivity-period-display">
                  <div className="period-date">{nextPeriodInfo.date}</div>
                  <div className="period-time">{nextPeriodInfo.time}</div>
                </div>
              </>
            ) : (
              <>
                <p className="productivity-timer-label productivity-timer-label-orange">YOUR CURRENT PRODUCTIVITY PERIOD ENDS IN:</p>
                <div className="productivity-timer-display">
                  {productivityTimeRemaining !== null ? formatTime(productivityTimeRemaining) : '2:00:00'}
                </div>
              </>
            )}
          </div>

          {/* Current Tasks Section */}
          <div className="current-tasks-section">
            <h2 className={`current-tasks-header ${isTimerAtZero ? 'current-tasks-header-dark' : ''}`}>
              {isTimerAtZero ? 'UPCOMING TASKS' : 'CURRENT TASKS'}
            </h2>
            
            {todayTasks.length > 0 ? (
              <div className="current-tasks-list">
                {todayTasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="current-task-card">
                    <div className="task-card-header">
                      <div className="task-duration-badge">
                        <span className="clock-icon">🕐</span>
                        <span>{task.estimatedMinutes || 15} min</span>
                      </div>
                      {task.dueDate && (
                        <div className="task-due-date">{formatDueDate(task.dueDate)}</div>
                      )}
                    </div>
                    <h3 className="task-title">{task.name || 'Task main descriptor'}</h3>
                    <p className="task-description">{task.description || 'Lorem ipsum description stuff'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-tasks-message">
                <p>No tasks for today</p>
              </div>
            )}

            {/* Bottom Navigation */}
            <div className="bottom-navigation">
              <div className="nav-icon"></div>
              <div className="nav-icon"></div>
              <div className="nav-icon"></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;

