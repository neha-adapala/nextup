import './SkeletonLoader.css';

function SkeletonLoader({ count = 3, className = '' }) {
  return (
    <div className={`skeleton-container ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-item">
          <div className="skeleton-line skeleton-title"></div>
          <div className="skeleton-line skeleton-text"></div>
          <div className="skeleton-line skeleton-text short"></div>
        </div>
      ))}
    </div>
  );
}

export default SkeletonLoader;

