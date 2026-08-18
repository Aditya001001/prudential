import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import UserPortalNew from './pages/UserPortalNew';
import AdminLogin from './pages/AdminLogin';
import CertificateHistory from './pages/CertificateHistory';
import './App.css';

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
        <img src="/prudential/PRU_logo_black.png" alt="Prudential" style={{ height: '48px', marginBottom: '24px' }} />
        <h1 style={{ fontSize: '72px', color: '#ef4444', marginBottom: '16px', fontWeight: 'bold' }}>404</h1>
        <h2 style={{ fontSize: '24px', color: '#1f2937', marginBottom: '12px' }}>Page Not Found</h2>
        <p style={{ color: '#6b7280', marginBottom: '32px' }}>
          The page you're looking for doesn't exist.
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
          Go to User Portal
        </Link>
      </div>
    </div>
  );
}

const API_URL = '/prudential-api';

// Protected Route Component
function ProtectedRoute({ children }) {
  const isAuthenticated = localStorage.getItem('adminAuth') === 'true';
  return isAuthenticated ? children : <Navigate to="/admin/login" replace />;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('adminAuth') === 'true'
  );

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  return (
    <Router basename="/prudential">
      <Routes>
        <Route path="/" element={<UserPortalNew />} />
        <Route path="/admin/login" element={<AdminLogin onLogin={handleLogin} />} />
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
        {/* Catch-all route for 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
