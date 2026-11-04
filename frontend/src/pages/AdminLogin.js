import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import './AdminLogin.css';
import api, { API_URL, errorMessage } from '../api';

function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post(`${API_URL}/auth/login`, { username, password });
      navigate('/admin');
    } catch (error) {
      setError(errorMessage(error, "無法登入，請重試。"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <img
            src={`${process.env.PUBLIC_URL}/PRU_logo_black.png`}
            alt="保誠標誌"
            className="admin-login-logo"
          />
          <h1 className="admin-login-title">管理員登入</h1>
          <p className="admin-login-subtitle">MDRT 海報產生器</p>
        </div>

        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-form-group">
            <label className="admin-form-label">
              <User size={18} />
              使用者名稱
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="請輸入使用者名稱"
              className="admin-form-input"
              autoComplete="username"
              required
              autoFocus
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">
              <Lock size={18} />
              密碼
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="請輸入密碼"
              className="admin-form-input"
              required
            />
          </div>

          <button
            type="submit"
            className="admin-login-button"
            disabled={loading}
          >
            {loading ? "正在登入…" : "登入"}
          </button>

          {error && (
            <div className="admin-login-error">
              {error}
            </div>
          )}
        </form>


      </div>
    </div>
  );
}

export default AdminLogin;
