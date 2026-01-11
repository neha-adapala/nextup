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

  return (
    <div className="callback-container">
      <div className="callback-content">
        <div className="callback-spinner"></div>
        <p>Completing sign in...</p>
      </div>
    </div>
  );
}

export default AuthCallback;

