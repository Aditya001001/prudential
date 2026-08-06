import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import UserPortal from './pages/UserPortal';
import AdminLogin from './pages/AdminLogin';
import { Award, Shield, History, X, Eye, Download, AlertCircle, Trash2 } from 'lucide-react';
import axios from 'axios';
import ImagePreviewModal from './components/ImagePreviewModal';
import './App.css';

const API_URL = 'http://localhost:5000/api';

// Protected Route Component
function ProtectedRoute({ children }) {
  const isAuthenticated = localStorage.getItem('adminAuth') === 'true';
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('adminAuth') === 'true'
  );

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    localStorage.removeItem('adminUsername');
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <div className="app">
        <NavigationWithHistory isAuthenticated={isAuthenticated} onLogout={handleLogout} />
        <Routes>
          <Route path="/" element={<UserPortal />} />
          <Route path="/login" element={<AdminLogin onLogin={handleLogin} />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

function NavigationWithHistory({ isAuthenticated, onLogout }) {
  const [showHistory, setShowHistory] = useState(false);
  const [certificateHistory, setCertificateHistory] = useState([]);
  const [previewModal, setPreviewModal] = useState(null);

  const fetchCertificateHistory = async () => {
    console.log('Fetching certificate history...');
    try {
      const response = await axios.get(`${API_URL}/certificates/history`);
      console.log('Certificate history response:', response.data);
      if (response.data.success) {
        setCertificateHistory(response.data.certificates);
        setShowHistory(true);
      }
    } catch (error) {
      console.error('Failed to fetch certificate history:', error);
      alert('Failed to load certificate history. Please check if the backend is running.');
    }
  };

  const viewCertificate = (filename) => {
    setPreviewModal({
      url: `${API_URL}/certificates/${filename}`,
      name: filename
    });
  };

  const deleteCertificate = async (certId, filename) => {
    if (!window.confirm(`Are you sure you want to delete certificate "${filename}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const response = await axios.delete(`${API_URL}/certificates/${certId}`);
      if (response.data.success) {
        // Refresh the certificate list
        const updatedCerts = certificateHistory.filter(cert => cert.id !== certId);
        setCertificateHistory(updatedCerts);
        alert('Certificate deleted successfully!');
      }
    } catch (error) {
      console.error('Failed to delete certificate:', error);
      alert('Failed to delete certificate. Please try again.');
    }
  };

  return (
    <>
      <Navigation
        onHistoryClick={fetchCertificateHistory}
        isAuthenticated={isAuthenticated}
        onLogout={onLogout}
      />

      {/* Certificate History Modal */}
      {showHistory && (
        <div className="history-modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="history-header">
              <h2><History size={24} /> Certificate History</h2>
              <button className="close-btn" onClick={() => setShowHistory(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="history-content">
              {certificateHistory.length === 0 ? (
                <div className="no-history">
                  <AlertCircle size={48} />
                  <p>No certificates generated yet</p>
                </div>
              ) : (
                <div className="history-grid">
                  {certificateHistory.map((cert) => (
                    <div key={cert.id} className="history-card">
                      <div className="history-info">
                        <h3>{cert.agent_name}</h3>
                        <p className="client-code">Client Code: {cert.client_code}</p>
                        <p className="tier-badge">{cert.mdrt_tier}</p>
                        {(cert.life_member || cert.honor_roll || cert.quarter_century) && (
                          <div className="badges-list">
                            {cert.life_member && <span className="badge">LM</span>}
                            {cert.honor_roll && <span className="badge">HR</span>}
                            {cert.quarter_century && <span className="badge">QC</span>}
                          </div>
                        )}
                        <p className="generated-date">
                          Generated: {new Date(cert.generated_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="history-actions">
                        <button
                          className="btn-view"
                          onClick={() => viewCertificate(cert.filename)}
                        >
                          <Eye size={16} />
                          View
                        </button>
                        <a
                          href={`${API_URL}/certificates/${cert.filename}`}
                          download={cert.filename}
                          className="btn-download"
                        >
                          <Download size={16} />
                          Download
                        </a>
                        <button
                          className="btn-delete"
                          onClick={() => deleteCertificate(cert.id, cert.filename)}
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {previewModal && (
        <ImagePreviewModal
          image={previewModal}
          onClose={() => setPreviewModal(null)}
        />
      )}
    </>
  );
}

function Navigation({ onHistoryClick, isAuthenticated, onLogout }) {
  const location = useLocation();
  const isUserPortal = location.pathname === '/';
  const isAdmin = location.pathname === '/admin';
  const isLogin = location.pathname === '/login';

  // Hide navigation on login page
  if (isLogin) {
    return null;
  }

  return (
    <nav className="nav-bar">
      <Link to="/" className={`nav-link ${isUserPortal ? 'active' : ''}`}>
        <Award size={20} />
        <span>User Portal</span>
      </Link>

      {/* Only show admin links if authenticated */}
      {isAuthenticated && (
        <>
          <Link to="/admin" className={`nav-link ${isAdmin ? 'active' : ''}`}>
            <Shield size={20} />
            <span>Admin Dashboard</span>
          </Link>
          <button className="nav-link nav-button" onClick={onHistoryClick}>
            <History size={20} />
            <span>Certificate History</span>
          </button>
          <button className="nav-link nav-button logout-btn" onClick={onLogout}>
            <X size={20} />
            <span>Logout</span>
          </button>
        </>
      )}

      {/* Show login button if not authenticated */}
      {!isAuthenticated && (
        <Link to="/login" className="nav-link">
          <Shield size={20} />
          <span>Admin Login</span>
        </Link>
      )}
    </nav>
  );
}

export default App;
