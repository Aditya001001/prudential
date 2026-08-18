import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Eye, Download, Trash2, AlertCircle, Search, Calendar, Bell, User, Home, Users } from 'lucide-react';
import ImagePreviewModal from '../components/ImagePreviewModal';
import './CertificateHistory.css';

const API_URL = '/prudential-api';

function CertificateHistory() {
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState([]);
  const [filteredCertificates, setFilteredCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewModal, setPreviewModal] = useState(null);

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

    // Filter by keyword (name or client code)
    if (searchKeyword) {
      filtered = filtered.filter(cert =>
        cert.agent_name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        cert.client_code.toLowerCase().includes(searchKeyword.toLowerCase())
      );
    }

    // Filter by date range
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

  const handleSearch = () => {
    filterCertificates();
  };

  const handleReset = () => {
    setSearchKeyword('');
    setFromDate('');
    setToDate('');
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

  const deleteCertificate = async (certId, filename) => {
    try {
      const response = await axios.delete(`${API_URL}/certificates/${certId}`);
      if (response.data.success) {
        setCertificates(certificates.filter(cert => cert.id !== certId));
      }
    } catch (error) {
      console.error('Failed to delete certificate:', error);
    }
  };

  return (
    <div className="history-page">
      <div className="history-container">
        {/* Header */}
        <div className="history-page-header">
          <button className="back-button" onClick={() => navigate('/admin')}>
            <ArrowLeft size={20} />
            Back to Admin
          </button>
          <div className="header-content">
            <img src="/prudential/PRU_logo_black.png" alt="Prudential" className="history-logo" />
            <h1 className="history-title">Certificate History</h1>
            <p className="history-subtitle">View and manage all generated certificates</p>
          </div>
        </div>

        {/* Content */}
        <div className="history-content-wrapper">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading certificates...</p>
            </div>
          ) : certificates.length === 0 ? (
            <div className="empty-state">
              <AlertCircle size={64} />
              <h2>No Certificates Yet</h2>
              <p>Generated certificates will appear here</p>
              <button className="btn-primary" onClick={() => navigate('/admin')}>
                Back to Admin Dashboard
              </button>
            </div>
          ) : (
            <div className="certificates-table-container">
              <table className="certificates-table">
                <thead>
                  <tr>
                    <th>Client Code</th>
                    <th>Agent Name</th>
                    <th>Tier</th>
                    <th>Achievements</th>
                    <th>Generated Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((cert) => (
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
                            onClick={() => deleteCertificate(cert.id, cert.filename)}
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
    </div>
  );
}

export default CertificateHistory;
