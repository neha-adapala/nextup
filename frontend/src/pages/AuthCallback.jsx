import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './AuthCallback.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const variant = searchParams.get('variant') === 'current' ? 'current' : 'next';

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      navigate('/login?error=login_failed');
      return;
    }

    if (token) {
      // Verify token with backend and get user info
      axios.get(`${API_URL}/api/auth/verify`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      .then((response) => {
        if (response.data.valid) {
          login(token, response.data.user);
          navigate('/dashboard');
        } else {
          navigate('/login?error=login_failed');
        }
      })
      .catch((error) => {
        console.error('Token verification error:', error);
        navigate('/login?error=login_failed');
      });
    } else {
      navigate('/login?error=login_failed');
    }
  }, [searchParams, navigate, login]);

  const now = new Date();
  const dateText = now
    .toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    .toUpperCase();
  const timeText = now
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .toUpperCase();

  return (
    <div className={`callback-container callback-${variant}`}>
      <div className="callback-shell">
        <header className="callback-hero" aria-live="polite">
          <h1 className="callback-hero-title">
            {variant === 'current'
              ? 'YOUR CURRENT PRODUCTIVITY PERIOD ENDS IN:'
              : 'YOUR NEXT PRODUCTIVITY PERIOD IS AT:'}
          </h1>

          <div className="callback-hero-value" aria-label="Sign in in progress">
            {variant === 'current' ? (
              <div className="callback-countdown">1:50:50</div>
            ) : (
              <>
                <div className="callback-date">{dateText}</div>
                <div className="callback-time">{timeText}</div>
              </>
            )}
          </div>

          <div className="callback-spinner" aria-hidden="true" />
          <p className="callback-status">Completing sign in…</p>
        </header>

        <section className="callback-section" aria-label="Tasks preview">
          <h2 className="callback-section-title">
            {variant === 'current' ? 'CURRENT TASKS' : 'UPCOMING TASKS'}
          </h2>

          <div className="callback-task-list">
            {[0, 1, 2].map((idx) => (
              <div className="callback-task-card" key={idx}>
                <div className="callback-task-top">
                  <div className="callback-pill" aria-label="Estimated time">
                    <span className="callback-pill-icon" aria-hidden="true">
                      🕒
                    </span>
                    <span className="callback-pill-text">15 min</span>
                  </div>
                  <div className="callback-due">DUE 1/1/25</div>
                </div>

                <div className="callback-task-title">Task main descriptor</div>
                <div className="callback-task-subtitle">Lorem ipsum description stuff</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default AuthCallback;

