import './ProductivityAlert.css';

function ProductivityAlert({ isOpen, breakDurationMinutes, tasks, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="productivity-alert-overlay" onClick={onClose}>
      <div className="productivity-alert-container" onClick={(e) => e.stopPropagation()}>
        <div className="productivity-alert-header">
          <h3 className="productivity-alert-title">Productivity Period Started</h3>
        </div>
        <div className="productivity-alert-body">
          <p className="productivity-alert-message">
            You now have a {breakDurationMinutes} minute break.
          </p>
          {tasks && tasks.length > 0 && (
            <div className="productivity-alert-tasks">
              {tasks.map((task, index) => (
                <div key={task.id || index} className="productivity-alert-task-item">
                  <span className="task-number">Task {index + 1} to complete:</span>
                  <span className="task-name" style={{color: '#1a1a1a'}}>{task.name || task.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="productivity-alert-footer">
          <button
            className="productivity-alert-button"
            onClick={onClose}
          >
            GOT IT
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductivityAlert;

