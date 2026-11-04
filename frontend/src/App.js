import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import UserPortalNew from './pages/UserPortalNew';
import AdminLogin from './pages/AdminLogin';
import CertificateHistory from './pages/CertificateHistory';
import MasterDataHistory from './pages/MasterDataHistory';
import './App.css';
import { getSession } from './api';

// 404 Not Found Component
function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
        padding: '48px 40px',
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center'
      }}>
        <img src={`${process.env.PUBLIC_URL}/PRU_logo_black.png`} alt="保誠" style={{ height: '48px', marginBottom: '24px' }} />
        <h1 style={{ fontSize: '72px', color: '#ef4444', marginBottom: '16px', fontWeight: 'bold' }}>404</h1>
        <h2 style={{ fontSize: '24px', color: '#1f2937', marginBottom: '12px' }}>找不到頁面</h2>
        <p style={{ color: '#6b7280', marginBottom: '32px' }}>
          您要瀏覽的頁面不存在。
        </p>
        <Link to="/" style={{
          display: 'inline-block',
          background: '#ef4444',
          color: 'white',
          padding: '14px 32px',
          borderRadius: '12px',
          textDecoration: 'none',
          fontWeight: '600',
          transition: 'all 0.3s'
        }}>
          前往使用者入口
        </Link>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const [state, setState] = useState('loading');
  useEffect(() => {
    let active = true;
    const expire = () => setState('anonymous');
    window.addEventListener('prudential-auth-expired', expire);
    getSession(true).then(data => {
      if (active) setState(data.authenticated ? 'authenticated' : 'anonymous');
    }).catch(() => { if (active) setState('error'); });
    return () => { active = false; window.removeEventListener('prudential-auth-expired', expire); };
  }, []);
  if (state === 'loading') return <p role="status">正在驗證登入狀態…</p>;
  if (state === 'error') return <p role="alert">無法驗證登入狀態。 <button onClick={() => window.location.reload()}>重試</button></p>;
  return state === 'authenticated' ? children : <Navigate to="/admin/login" replace />;
}

function App() {
  return (
    <Router basename={process.env.PUBLIC_URL || '/'}>
      <Routes>
        <Route path="/" element={<UserPortalNew />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <CertificateHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/master-data-history"
          element={
            <ProtectedRoute>
              <MasterDataHistory />
            </ProtectedRoute>
          }
        />
        {/* Catch-all route for 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
