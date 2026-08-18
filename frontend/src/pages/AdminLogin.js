import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import './AdminLogin.css';

function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simple authentication (you can replace with backend API call)
    // For now, using hardcoded credentials
    if (username === 'admin' && password === 'admin123') {
      // Store auth token in localStorage
      localStorage.setItem('adminAuth', 'true');
      localStorage.setItem('adminUsername', username);

      // Call parent onLogin callback
      onLogin();

      // Redirect to admin dashboard
      navigate('/admin');
    } else {
      setError('Invalid username or password');
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <img
            src="/prudential/PRU_logo_black.png"
            alt="Prudential Logo"
            className="admin-login-logo"
          />
          <h1 className="admin-login-title">Admin Access</h1>
          <p className="admin-login-subtitle">MDRT Certificate Generator</p>
        </div>

        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-form-group">
            <label className="admin-form-label">
              <User size={18} />
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="admin-form-input"
              required
              autoFocus
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">
              <Lock size={18} />
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="admin-form-input"
              required
            />
          </div>

          <button
            type="submit"
            className="admin-login-button"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          {error && (
            <div className="admin-login-error">
              {error}
            </div>
          )}
        </form>

        <div className="admin-login-footer">
          <p className="admin-login-footer-title">Default Credentials</p>
          <div className="admin-login-credentials">
            <span className="admin-credential-item">Username: admin</span>
            <span className="admin-credential-divider">|</span>
            <span className="admin-credential-item">Password: admin123</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
