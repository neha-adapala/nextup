import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function Login() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [availableProviders, setAvailableProviders] = useState({ google: true, microsoft: false });

  useEffect(() => {
    // Check for error in URL params
    const errorParam = searchParams.get('error');
    if (errorParam === 'login_failed') {
      setError('Login failed. Please try again.');
    }

    // Fetch available auth providers
    axios.get(`${API_URL}/api/auth/providers`)
      .then(response => {
        setAvailableProviders(response.data);
      })
      .catch(error => {
        console.error('Failed to fetch providers:', error);
        // Default to Google only if API fails
        setAvailableProviders({ google: true, microsoft: false });
      });
  }, [searchParams]);

  const handleGoogleLogin = () => {
    setIsLoading(true);
    setError(null);
    window.location.href = `${API_URL}/api/auth/google`;
  };

  const handleMicrosoftLogin = () => {
    setIsLoading(true);
    setError(null);
    window.location.href = `${API_URL}/api/auth/microsoft`;
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-image"><img src={'./images/logo.png'}/></div>
          <h1 className="app-title">NextUp</h1>
          <p className="app-subtitle">Make the most of your free time</p>
        </div>

        <div className="login-content">
          <p className="login-description">
            Sign in with your account to access your calendar and emails
          </p>

          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          <div className="login-buttons">
            <button
              className="login-button google-button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="button-loading">Signing in...</span>
              ) : (
                <>
                  <svg className="button-icon" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {availableProviders.microsoft && (
              <button
                className="login-button microsoft-button"
                onClick={handleMicrosoftLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="button-loading">Signing in...</span>
                ) : (
                  <>
                    <svg className="button-icon" viewBox="0 0 24 24">
                      <path fill="#f25022" d="M1 1h10v10H1z" />
                      <path fill="#00a4ef" d="M13 1h10v10H13z" />
                      <path fill="#7fba00" d="M1 13h10v10H1z" />
                      <path fill="#ffb900" d="M13 13h10v10H13z" />
                    </svg>
                    <span>Continue with Microsoft</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="login-footer">
          <p className="footer-text">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;

