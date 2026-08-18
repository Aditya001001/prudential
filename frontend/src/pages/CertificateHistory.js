import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Eye, Download, Trash2, AlertCircle, Search, Calendar, Bell, User, Home, Users, Image as ImageIcon } from 'lucide-react';
import ImagePreviewModal from '../components/ImagePreviewModal';
import ConfirmModal from '../components/ConfirmModal';
import './CertificateHistory.css';

const API_URL = '/prudential-api';

function CertificateHistory() {
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState([]);
  const [filteredCertificates, setFilteredCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewModal, setPreviewModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Search and filter states
  const [searchKeyword, setSearchKeyword] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    fetchCertificates();
  }, []);

  useEffect(() => {
    filterCertificates();
  }, [searchKeyword, fromDate, toDate, certificates]);

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/certificates/history`);
      if (response.data.success) {
        setCertificates(response.data.certificates);
        setFilteredCertificates(response.data.certificates);
      }
    } catch (error) {
      console.error('Failed to fetch certificates:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterCertificates = () => {
    let filtered = [...certificates];

    if (searchKeyword) {
      filtered = filtered.filter(cert => 
        cert.agent_name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        cert.client_code.toLowerCase().includes(searchKeyword.toLowerCase())
      );
    }

    if (fromDate) {
      filtered = filtered.filter(cert => 
        new Date(cert.generated_at) >= new Date(fromDate)
      );
    }

    if (toDate) {
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(cert => 
        new Date(cert.generated_at) <= endOfDay
      );
    }

    setFilteredCertificates(filtered);
  };

  const viewCertificate = (filename) => {
    setPreviewModal({
      url: `${API_URL}/user/preview/${filename}`,
      name: filename
    });
  };

  const viewOriginalPhoto = (photoFilename) => {
    setPreviewModal({
      url: `${API_URL}/certificates/photo/${photoFilename}`,
      name: photoFilename
    });
  };

  const handleDeleteClick = (certId, certName) => {
    setConfirmDelete({ id: certId, name: certName });
  };

  const confirmDeleteCertificate = async () => {
    if (!confirmDelete) return;

    try {
      const response = await axios.delete(`${API_URL}/certificates/${confirmDelete.id}`);
      if (response.data.success) {
        setCertificates(certificates.filter(cert => cert.id !== confirmDelete.id));
        setConfirmDelete(null);
      }
    } catch (error) {
      console.error('Failed to delete certificate:', error);
      setConfirmDelete(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    navigate('/admin/login');
  };

  return (
    <div className="new-admin-container">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="sidebar-logo">
          <img src="/prudential/PRU_logo_white_RGB_v1%201.png" alt="Prudential" />
        </div>
        
        <nav className="sidebar-nav">
          <button className="nav-item" onClick={() => navigate('/')}>
            <User size={20} />
            User Portal
          </button>
          <button className="nav-item" onClick={() => navigate('/admin')}>
            <Home size={20} />
            Admin Dashboard
          </button>
          <button className="nav-item active">
            <Users size={20} />
            Certificate History
          </button>
        </nav>

        <button className="logout-button" onClick={handleLogout}>
          <AlertCircle size={18} />
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="admin-main">
        {/* Header */}
        <div className="admin-header-bar">
          <div>
            <h1 className="page-title">Certificate History</h1>
            <p className="page-subtitle">View and manage all generated certificates</p>
          </div>
          <button className="notification-btn">
            <Bell size={20} />
          </button>
        </div>

        {/* Search Section */}
        <div className="search-card">
          <div className="search-controls">
            <div className="search-input-wrapper">
              <Search size={18} />
              <input
                type="text"
                placeholder="Type your keyword"
                className="search-input"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
            </div>

            <div className="date-input-wrapper">
              <label>From Date</label>
              <div className="input-with-icon">
                <Calendar size={16} />
                <input
                  type="date"
                  className="date-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
            </div>

            <div className="date-input-wrapper">
              <label>To Date</label>
              <div className="input-with-icon">
                <Calendar size={16} />
                <input
                  type="date"
                  className="date-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            <button className="btn-search" onClick={filterCertificates}>
              Search
            </button>
          </div>
        </div>

        {/* Certificates Table */}
        <div className="content-section">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading certificates...</p>
            </div>
          ) : filteredCertificates.length === 0 ? (
            <div className="empty-state">
              <AlertCircle size={64} />
              <h2>No Certificates Found</h2>
              <p>{searchKeyword || fromDate || toDate ? 'Try adjusting your search criteria' : 'Generated certificates will appear here'}</p>
            </div>
          ) : (
            <div className="certificates-table-container">
              <table className="certificates-table">
                <thead>
                  <tr>
                    <th>CLIENT CODE</th>
                    <th>AGENT NAME</th>
                    <th>TIER</th>
                    <th>ACHIEVEMENTS</th>
                    <th>GENERATED DATE</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCertificates.map((cert) => (
                    <tr key={cert.id}>
                      <td>
                        <span className="code-highlight">{cert.client_code}</span>
                      </td>
                      <td>
                        <strong>{cert.agent_name}</strong>
                      </td>
                      <td>
                        <span className="tier-badge">{cert.mdrt_tier}</span>
                      </td>
                      <td>
                        <div className="cert-badges">
                          {cert.life_member && <span className="achievement-badge">LM</span>}
                          {cert.honor_roll && <span className="achievement-badge">HR</span>}
                          {cert.quarter_century && <span className="achievement-badge">QC</span>}
                          {!cert.life_member && !cert.honor_roll && !cert.quarter_century && (
                            <span className="text-muted">None</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="cert-date">
                          {new Date(cert.generated_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                          <div className="cert-time">
                            {new Date(cert.generated_at).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="cert-actions">
                          <button
                            className="btn-icon btn-icon-view"
                            onClick={() => viewCertificate(cert.filename)}
                            title="View Certificate"
                          >
                            <Eye size={20} />
                          </button>
                          {cert.has_original_photo && (
                            <button
                              className="btn-icon btn-icon-photo"
                              onClick={() => viewOriginalPhoto(cert.original_photo_filename)}
                              title="View Original Photo"
                            >
                              <ImageIcon size={20} />
                            </button>
                          )}
                          <a
                            href={`${API_URL}/user/download/${cert.filename}`}
                            download={cert.filename}
                            className="btn-icon btn-icon-download"
                            title="Download Certificate"
                          >
                            <Download size={20} />
                          </a>
                          <button
                            className="btn-icon btn-icon-delete"
                            onClick={() => handleDeleteClick(cert.id, cert.agent_name)}
                            title="Delete Certificate"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewModal && (
        <ImagePreviewModal
          image={previewModal}
          onClose={() => setPreviewModal(null)}
        />
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteCertificate}
        title="Delete Certificate"
        message={`Are you sure you want to delete the certificate for ${confirmDelete?.name || 'this agent'}? This action cannot be undone.`}
      />
    </div>
  );
}

export default CertificateHistory;
