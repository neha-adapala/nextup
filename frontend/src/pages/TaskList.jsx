import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../components/ToastContainer';
import ConfirmationDialog from '../components/ConfirmationDialog';
import SkeletonLoader from '../components/SkeletonLoader';
import './TaskList.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function TaskList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError, showInfo } = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [newTask, setNewTask] = useState({
    name: '',
    description: '',
    importance: 3,
    dueDate: '',
    estimatedMinutes: ''
  });

  useEffect(() => {
    if (user) {
      fetchTasks();
    } else {
      navigate('/login');
    }
  }, [user, navigate]);

  const fetchTasks = async (refreshFromEmail = false) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/tasks${refreshFromEmail ? '?refresh=true' : ''}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setTasks(response.data.tasks || []);
        setStats(response.data.stats || {});
        setError(null);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      const errorMessage = error.response?.data?.message || 'Could not make task list.';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    
    if (!newTask.name.trim()) {
      setError('Task name is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/tasks`,
        {
          name: newTask.name,
          description: newTask.description,
          importance: parseInt(newTask.importance),
          dueDate: newTask.dueDate || null,
          estimatedMinutes: newTask.estimatedMinutes ? parseInt(newTask.estimatedMinutes) : null
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setTasks([response.data.task, ...tasks]);
        setNewTask({ name: '', description: '', importance: 3, dueDate: '', estimatedMinutes: '' });
        setShowAddTask(false);
        setError(null);
        showSuccess('Task created successfully!');
        // Refresh stats
        fetchTasks();
      }
    } catch (error) {
      console.error('Error creating task:', error);
      const errorMessage = error.response?.data?.message || 'Could not save task.';
      setError(errorMessage);
      showError(errorMessage);
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
        setTasks(tasks.filter(task => task.id !== taskId));
        // Update stats
        if (stats) {
          setStats({
            ...stats,
            completedTasks: (stats.completedTasks || 0) + 1,
            totalTasks: Math.max(0, (stats.totalTasks || 0) - 1)
          });
        }
        // Show completion message
        showSuccess('Task completed!');
        navigate('/task-complete', { 
          state: { 
            taskName: response.data.task.name,
            completedCount: response.data.completedTasksCount 
          } 
        });
      }
    } catch (error) {
      console.error('Error completing task:', error);
      const errorMessage = error.response?.data?.message || 'Could not complete task.';
      setError(errorMessage);
      showError(errorMessage);
    }
  };

  const handleDeleteTask = async (taskId) => {
    setDeleteConfirm(taskId);
  };

  const confirmDelete = async () => {
    const taskId = deleteConfirm;
    setDeleteConfirm(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(
        `${API_URL}/api/tasks/${taskId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setTasks(tasks.filter(task => task.id !== taskId));
        showSuccess('Task deleted successfully');
        fetchTasks(); // Refresh stats
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      const errorMessage = error.response?.data?.message || 'Could not delete task.';
      setError(errorMessage);
      showError(errorMessage);
    }
  };

  const handleEditTask = (task) => {
    setEditingTask({
      id: task.id,
      name: task.name,
      description: task.description || '',
      importance: task.importance,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '',
      estimatedMinutes: task.estimatedMinutes || ''
    });
    setShowAddTask(false);
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    
    if (!editingTask.name.trim()) {
      showError('Task name is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_URL}/api/tasks/${editingTask.id}`,
        {
          name: editingTask.name,
          description: editingTask.description,
          importance: parseInt(editingTask.importance),
          dueDate: editingTask.dueDate || null,
          estimatedMinutes: editingTask.estimatedMinutes ? parseInt(editingTask.estimatedMinutes) : null
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setTasks(tasks.map(task => 
          task.id === editingTask.id ? response.data.task : task
        ));
        setEditingTask(null);
        showSuccess('Task updated successfully!');
        fetchTasks(); // Refresh stats
      }
    } catch (error) {
      console.error('Error updating task:', error);
      const errorMessage = error.response?.data?.message || 'Could not update task.';
      showError(errorMessage);
    }
  };

  const getImportanceColor = (importance) => {
    if (importance >= 5) return '#ef4444'; // Red
    if (importance >= 4) return '#f59e0b'; // Orange
    if (importance >= 3) return '#3b82f6'; // Blue
    return '#6b7280'; // Gray
  };

  const getImportanceLabel = (importance) => {
    if (importance >= 5) return 'Critical';
    if (importance >= 4) return 'High';
    if (importance >= 3) return 'Medium';
    return 'Low';
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    // Sort by importance (highest first), then by due date (soonest first)
    if (b.importance !== a.importance) {
      return b.importance - a.importance;
    }
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate) - new Date(b.dueDate);
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <div className="task-list-container">
      <header className="task-list-header">
        <div className="header-left">
          <button onClick={() => navigate('/dashboard')} className="back-button">
            ← Back to Dashboard
          </button>
          <h1>My Tasks</h1>
        </div>
        <div className="header-actions">
          <button 
            onClick={() => fetchTasks(true)} 
            className="refresh-button"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh from Email'}
          </button>
          <button 
            onClick={() => setShowAddTask(!showAddTask)} 
            className="add-task-button"
          >
            {showAddTask ? 'Cancel' : '+ Add Task'}
          </button>
        </div>
      </header>

      <main className="task-list-content">
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {/* Add Task Form */}
        {showAddTask && !editingTask && (
          <div className="add-task-form-card">
            <h2>Add New Task</h2>
            <form onSubmit={handleAddTask}>
              <div className="form-group">
                <label htmlFor="task-name">Task Name *</label>
                <input
                  id="task-name"
                  type="text"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  placeholder="Enter task name"
                  required
                  maxLength={500}
                />
              </div>

              <div className="form-group">
                <label htmlFor="task-description">Description</label>
                <textarea
                  id="task-description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Optional description"
                  rows={3}
                  maxLength={2000}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="task-importance">Importance</label>
                  <select
                    id="task-importance"
                    value={newTask.importance}
                    onChange={(e) => setNewTask({ ...newTask, importance: e.target.value })}
                  >
                    <option value="1">1 - Low</option>
                    <option value="2">2 - Low-Medium</option>
                    <option value="3">3 - Medium</option>
                    <option value="4">4 - High</option>
                    <option value="5">5 - Critical</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="task-due-date">Due Date</label>
                  <input
                    id="task-due-date"
                    type="datetime-local"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="task-estimated">Estimated Time (minutes)</label>
                  <input
                    id="task-estimated"
                    type="number"
                    min="1"
                    value={newTask.estimatedMinutes}
                    onChange={(e) => setNewTask({ ...newTask, estimatedMinutes: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="submit-button">Create Task</button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddTask(false);
                    setNewTask({ name: '', description: '', importance: 3, dueDate: '', estimatedMinutes: '' });
                  }}
                  className="cancel-button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit Task Form */}
        {editingTask && (
          <div className="add-task-form-card edit-task-form">
            <h2>Edit Task</h2>
            <form onSubmit={handleUpdateTask}>
              <div className="form-group">
                <label htmlFor="edit-task-name">Task Name *</label>
                <input
                  id="edit-task-name"
                  type="text"
                  value={editingTask.name}
                  onChange={(e) => setEditingTask({ ...editingTask, name: e.target.value })}
                  placeholder="Enter task name"
                  required
                  maxLength={500}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-task-description">Description</label>
                <textarea
                  id="edit-task-description"
                  value={editingTask.description}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  placeholder="Optional description"
                  rows={3}
                  maxLength={2000}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-task-importance">Importance</label>
                  <select
                    id="edit-task-importance"
                    value={editingTask.importance}
                    onChange={(e) => setEditingTask({ ...editingTask, importance: e.target.value })}
                  >
                    <option value="1">1 - Low</option>
                    <option value="2">2 - Low-Medium</option>
                    <option value="3">3 - Medium</option>
                    <option value="4">4 - High</option>
                    <option value="5">5 - Critical</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="edit-task-due-date">Due Date</label>
                  <input
                    id="edit-task-due-date"
                    type="datetime-local"
                    value={editingTask.dueDate}
                    onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-task-estimated">Estimated Time (minutes)</label>
                  <input
                    id="edit-task-estimated"
                    type="number"
                    min="1"
                    value={editingTask.estimatedMinutes}
                    onChange={(e) => setEditingTask({ ...editingTask, estimatedMinutes: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="submit-button">Update Task</button>
                <button 
                  type="button" 
                  onClick={() => setEditingTask(null)}
                  className="cancel-button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stats Bar */}
        {stats && (
          <div className="stats-bar">
            <div className="stat-item">
              <span className="stat-label">Total Tasks:</span>
              <span className="stat-value">{stats.totalTasks || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Completed:</span>
              <span className="stat-value">{stats.completedTasks || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Overdue:</span>
              <span className="stat-value overdue">{stats.overdueTasks || 0}</span>
            </div>
          </div>
        )}

        {/* Task List */}
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading tasks...</p>
            <SkeletonLoader count={3} />
          </div>
        )}

        {!loading && sortedTasks.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h2 className="empty-state-title">No tasks yet</h2>
            <p className="empty-state-message">
              {stats?.totalTasks === 0 
                ? "Get started by adding your first task or refreshing from your emails to find tasks automatically!"
                : "All your tasks are completed! Great job! 🎉"}
            </p>
            <div className="empty-state-actions">
              <button onClick={() => setShowAddTask(true)} className="add-first-task-button">
                + Add Your First Task
              </button>
              {stats?.totalTasks === 0 && (
                <button 
                  onClick={() => fetchTasks(true)} 
                  className="refresh-empty-button"
                >
                  Refresh from Email
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && sortedTasks.length > 0 && (
          <div className="tasks-list">
            {sortedTasks.map((task) => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.done;
              
              return (
                <div 
                  key={task.id} 
                  className={`task-card ${isOverdue ? 'overdue' : ''}`}
                  style={{ borderLeftColor: getImportanceColor(task.importance) }}
                >
                  <div className="task-card-header">
                    <div className="task-name-section">
                      <h3 className="task-name">{task.name}</h3>
                      {task.source === 'email' && (
                        <span className="task-source-badge email">From Email</span>
                      )}
                      {task.source === 'manual' && (
                        <span className="task-source-badge manual">Custom</span>
                      )}
                    </div>
                    <div className="task-importance-badge" style={{ 
                      backgroundColor: getImportanceColor(task.importance),
                      color: 'white'
                    }}>
                      {task.importance} - {getImportanceLabel(task.importance)}
                    </div>
                  </div>

                  {task.description && (
                    <p className="task-description">{task.description}</p>
                  )}

                  <div className="task-card-footer">
                    <div className="task-meta">
                      {task.dueDate && (
                        <span className={`task-due-date ${isOverdue ? 'overdue' : ''}`}>
                          📅 Due: {new Date(task.dueDate).toLocaleDateString()} {new Date(task.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {task.estimatedMinutes && (
                        <span className="task-time">
                          ⏱️ {task.estimatedMinutes} min
                        </span>
                      )}
                      {task.sourceData?.emailSubject && (
                        <span className="task-email-source">
                          📧 {task.sourceData.emailSubject}
                        </span>
                      )}
                    </div>
                    <div className="task-actions">
                      <button
                        onClick={() => handleCompleteTask(task.id)}
                        className="complete-button"
                        title="Mark as complete"
                      >
                        ✓ Complete
                      </button>
                      <button
                        onClick={() => handleEditTask(task)}
                        className="edit-button"
                        title="Edit task"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="delete-button"
                        title="Delete task"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!deleteConfirm}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

export default TaskList;

