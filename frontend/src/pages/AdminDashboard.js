import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Upload, Eye, LogOut, Bell, User as UserIcon, History } from 'lucide-react';
import './AdminDashboard.css';

const API_URL = '/prudential-api';

function AdminDashboard() {
  const navigate = useNavigate();
  const [assetStatus, setAssetStatus] = useState(null);
  const [uploading, setUploading] = useState({});
  const [previewImage, setPreviewImage] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [selectedCSVFile, setSelectedCSVFile] = useState(null);
  const [imageTimestamp, setImageTimestamp] = useState(Date.now());

  useEffect(() => {
    fetchAssetStatus();
  }, []);

  const fetchAssetStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/status`);
      setAssetStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch asset status:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    localStorage.removeItem('adminUsername');
    navigate('/admin/login');
  };

  const handleBackgroundUpload = async (tier, file) => {
    const formData = new FormData();
    formData.append(tier, file);

    setUploading(prev => ({ ...prev, [tier]: true }));
    try {
      await axios.post(`${API_URL}/admin/upload-backgrounds`, formData);
      setImageTimestamp(Date.now()); // Force image refresh only after upload
      await fetchAssetStatus();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(prev => ({ ...prev, [tier]: false }));
    }
  };

  const handleBadgeUpload = async (badgeType, file) => {
    const formData = new FormData();
    formData.append(badgeType, file);

    setUploading(prev => ({ ...prev, [badgeType]: true }));
    try {
      await axios.post(`${API_URL}/admin/upload-badges`, formData);
      setImageTimestamp(Date.now()); // Force image refresh only after upload
      await fetchAssetStatus();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(prev => ({ ...prev, [badgeType]: false }));
    }
  };

  const handleNametagUpload = async (tier, file) => {
    const formData = new FormData();
    formData.append(tier, file);

    setUploading(prev => ({ ...prev, [tier + '_nametag']: true }));
    try {
      await axios.post(`${API_URL}/admin/upload-nametags`, formData);
      setImageTimestamp(Date.now()); // Force image refresh only after upload
      await fetchAssetStatus();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(prev => ({ ...prev, [tier + '_nametag']: false }));
    }
  };

  const handleCSVUpload = async (file) => {
    const formData = new FormData();
    formData.append('csv', file);

    setUploading(prev => ({ ...prev, csv: true }));
    try {
      const response = await axios.post(`${API_URL}/admin/upload-csv`, formData);
      fetchAssetStatus();
      // CSV uploaded successfully
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(prev => ({ ...prev, csv: false }));
    }
  };

  const handleDeleteCSV = async () => {
    try {
      await axios.delete(`${API_URL}/admin/delete-csv`);
      fetchAssetStatus();
      // CSV deleted successfully
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleResetDatabase = async () => {
    try {
      await axios.post(`${API_URL}/admin/reset-database`);
      setImageTimestamp(Date.now()); // Force image refresh after reset
      await fetchAssetStatus();
      setShowResetConfirm(false);
      // Database reset successfully
    } catch (error) {
      console.error('Reset failed:', error);
    }
  };

  const FileUploadBox = ({ title, currentFile, onUpload, isUploading, assetType, filename }) => {
    const handleFileSelect = (e) => {
      const file = e.target.files[0];
      if (file) {
        onUpload(file);
      }
    };

    const previewUrl = currentFile ? `${API_URL}/admin/preview-asset/${assetType}/${filename}?t=${imageTimestamp}` : null;
    const buttonText = isUploading ? 'Uploading...' : (currentFile ? 'Change File' : 'Upload File');

    const handlePreviewClick = () => {
      if (previewUrl) {
        setPreviewImage({ url: previewUrl, title });
      }
    };

    return (
      <div className={`upload-box-new ${currentFile ? 'has-file' : ''}`}>
        <h3 className="upload-box-title-new">{title}</h3>
        <div className="upload-box-content">
          <div className="upload-area-new">
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleFileSelect}
              id={`upload-${assetType}-${filename}`}
              style={{ display: 'none' }}
            />
            <label htmlFor={`upload-${assetType}-${filename}`} className="upload-label-new">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
              <span>{buttonText}</span>
            </label>
          </div>
          {previewUrl && (
            <div className="mini-preview" onClick={handlePreviewClick} title="Click to view full size">
              <img src={previewUrl} alt={title} />
              <div className="preview-overlay">
                <Eye size={20} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="new-admin-container">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="sidebar-logo">
          <img src="/prudential/PRU_logo_white_RGB_v1%201.png" alt="Prudential" />
        </div>
        
        <nav className="sidebar-nav">
          <a href="/prudential/" className="nav-item">
            <UserIcon size={20} />
            <span>User Portal</span>
          </a>
          <a href="/prudential/admin" className="nav-item active">
            <Upload size={20} />
            <span>Admin Dashboard</span>
          </a>
          <a href="/prudential/history" className="nav-item">
            <History size={20} />
            <span>Certificate History</span>
          </a>
        </nav>

        <button className="logout-button" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="admin-main">
        <div className="admin-header-bar">
          <div>
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="page-subtitle">Manage Master Assets For MDRT Certificate Generator</p>
          </div>
          <button className="notification-btn">
            <Bell size={20} />
          </button>
        </div>

        <div className="admin-content-area">
          {/* Status Overview Cards */}
          <div className="status-cards">
            <div className="status-card">
              <div className="status-card-icon backgrounds-icon">
                <Upload size={20} />
              </div>
              <div className="status-card-content">
                <h3>Backgrounds</h3>
                <div className="status-items">
                  {assetStatus?.backgrounds?.COT && <span className="status-check">✓COT</span>}
                  {assetStatus?.backgrounds?.MDRT && <span className="status-check">✓MDRT</span>}
                  {assetStatus?.backgrounds?.TOT && <span className="status-check">✓TOT</span>}
                </div>
              </div>
            </div>

            <div className="status-card">
              <div className="status-card-icon badges-icon">
                <Upload size={20} />
              </div>
              <div className="status-card-content">
                <h3>Badges</h3>
                <div className="status-items">
                  {assetStatus?.badges?.HR && <span className="status-check">✓HR</span>}
                  {assetStatus?.badges?.LM && <span className="status-check">✓LM</span>}
                  {assetStatus?.badges?.QC && <span className="status-check">✓QC</span>}
                </div>
              </div>
            </div>

            <div className="status-card">
              <div className="status-card-icon backgrounds-icon">
                <Upload size={20} />
              </div>
              <div className="status-card-content">
                <h3>Name Tags</h3>
                <div className="status-items">
                  {assetStatus?.nametags?.MDRT && <span className="status-check">✓MDRT</span>}
                  {assetStatus?.nametags?.COT && <span className="status-check">✓COT</span>}
                  {assetStatus?.nametags?.TOT && <span className="status-check">✓TOT</span>}
                </div>
              </div>
            </div>

            <div className="status-card">
              <div className="status-card-icon csv-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                </svg>
              </div>
              <div className="status-card-content">
                <h3>Master CSV</h3>
                <div className="status-items">
                  {assetStatus?.csv && <span className="status-check">✓Data File</span>}
                  {assetStatus?.csv_info && (
                    <span className="agent-count">{assetStatus.csv_info.total_agents} Agents</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Master CSV Data Section */}
          <div className="content-section csv-section">
            <div className="section-header">
              <h2 className="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="section-icon">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                </svg>
                Master CSV Data
              </h2>
            </div>
            <p className="section-desc">Upload the master CSV file with all agent information</p>

            {assetStatus?.csv_info && (
              <div className="csv-preview-box">
                <div className="csv-file-info">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                  </svg>
                  <div>
                    <div className="csv-filename">
                      {assetStatus.csv_info.filename || 'data.csv'}
                    </div>
                    <div className="csv-agent-count">{assetStatus.csv_info.total_agents} agents loaded</div>
                  </div>
                  <button className="btn-delete-csv" onClick={handleDeleteCSV}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                    Delete
                  </button>
                </div>

                {assetStatus.csv_info.preview && assetStatus.csv_info.preview.length > 0 && (
                  <div className="csv-data-preview">
                    <h4>Sample Data Preview</h4>
                    <div className="preview-list">
                      {assetStatus.csv_info.preview.slice(0, 6).map((agent, idx) => (
                        <div key={idx} className="preview-item">
                          <span className="preview-code">
                            {agent['Client Cd'] || agent.client_code || 'N/A'}
                          </span>
                          <span className="preview-name">
                            {agent['Agent Name'] || agent.agent_name || 'Unknown'} - {agent['MDRT Title'] || agent.mdrt_tier || 'N/A'}
                          </span>
                        </div>
                      ))}
                      {assetStatus.csv_info.total_agents > 6 && (
                        <div className="preview-more">
                          And {assetStatus.csv_info.total_agents - 6} more agents
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="csv-upload-area">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    // If no CSV exists yet, upload automatically (first time)
                    // Otherwise, store file and show "Replace CSV" button
                    if (!assetStatus || !assetStatus.csv) {
                      handleCSVUpload(file);
                      e.target.value = ''; // Reset input
                    } else {
                      setSelectedCSVFile(file);
                    }
                  }
                }}
                id="csv-upload"
                style={{ display: 'none' }}
              />
              <label htmlFor="csv-upload" className="file-input-label">
                {uploading.csv ? 'Uploading...' : 'Choose File'}
              </label>
              <span className="file-input-text">
                {uploading.csv
                  ? 'Uploading CSV...'
                  : selectedCSVFile
                    ? selectedCSVFile.name
                    : (assetStatus && assetStatus.csv ? 'Select new CSV file' : 'Select a CSV file to upload')}
              </span>
            </div>

            {/* Show Replace CSV button only when CSV exists and new file is selected */}
            {assetStatus && assetStatus.csv && selectedCSVFile && (
              <button
                className="btn-upload-csv"
                onClick={() => {
                  handleCSVUpload(selectedCSVFile);
                  setSelectedCSVFile(null);
                  document.getElementById('csv-upload').value = '';
                }}
                disabled={uploading.csv}
              >
                {uploading.csv ? 'Uploading...' : 'Replace CSV'}
              </button>
            )}
          </div>

          {/* Tier Backgrounds Section */}
          <div className="content-section">
            <div className="section-header">
              <h2 className="section-title">
                <Upload size={20} className="section-icon" />
                Tier Backgrounds
              </h2>
              <button className="btn-upload-all">Upload Backgrounds</button>
            </div>
            <p className="section-desc">Upload background images for each MDRT tier</p>

            <div className="upload-grid">
              <FileUploadBox
                title="MDRT Background"
                currentFile={assetStatus?.backgrounds?.MDRT}
                onUpload={(file) => handleBackgroundUpload('MDRT', file)}
                isUploading={uploading.MDRT}
                assetType="background"
                filename="MDRT.png"
              />
              <FileUploadBox
                title="COT Background"
                currentFile={assetStatus?.backgrounds?.COT}
                onUpload={(file) => handleBackgroundUpload('COT', file)}
                isUploading={uploading.COT}
                assetType="background"
                filename="COT.png"
              />
              <FileUploadBox
                title="TOT Background"
                currentFile={assetStatus?.backgrounds?.TOT}
                onUpload={(file) => handleBackgroundUpload('TOT', file)}
                isUploading={uploading.TOT}
                assetType="background"
                filename="TOT.png"
              />
            </div>
          </div>

          {/* Achievement Badges Section */}
          <div className="content-section">
            <div className="section-header">
              <h2 className="section-title">
                <Upload size={20} className="section-icon" />
                Achievement Badges
              </h2>
              <button className="btn-upload-all">Upload Badges</button>
            </div>
            <p className="section-desc">Upload badge images for achievements</p>

            <div className="upload-grid">
              <FileUploadBox
                title="Life Member"
                currentFile={assetStatus?.badges?.LM}
                onUpload={(file) => handleBadgeUpload('LM', file)}
                isUploading={uploading.LM}
                assetType="badge"
                filename="LM.png"
              />
              <FileUploadBox
                title="Honor Roll"
                currentFile={assetStatus?.badges?.HR}
                onUpload={(file) => handleBadgeUpload('HR', file)}
                isUploading={uploading.HR}
                assetType="badge"
                filename="HR.png"
              />
              <FileUploadBox
                title="Quarter Century"
                currentFile={assetStatus?.badges?.QC}
                onUpload={(file) => handleBadgeUpload('QC', file)}
                isUploading={uploading.QC}
                assetType="badge"
                filename="QC.png"
              />
            </div>
          </div>

          {/* Name Tag Banners Section */}
          <div className="content-section">
            <div className="section-header">
              <h2 className="section-title">
                <Upload size={20} className="section-icon" />
                Name Tag Banners
              </h2>
              <button className="btn-upload-all">Upload Name Tags</button>
            </div>
            <p className="section-desc">Upload name tag banner images for each MDRT tier</p>

            <div className="upload-grid">
              <FileUploadBox
                title="MDRT Name Tag"
                currentFile={assetStatus?.nametags?.MDRT}
                onUpload={(file) => handleNametagUpload('MDRT', file)}
                isUploading={uploading.MDRT_nametag}
                assetType="nametag"
                filename="MDRT.png"
              />
              <FileUploadBox
                title="COT Name Tag"
                currentFile={assetStatus?.nametags?.COT}
                onUpload={(file) => handleNametagUpload('COT', file)}
                isUploading={uploading.COT_nametag}
                assetType="nametag"
                filename="COT.png"
              />
              <FileUploadBox
                title="TOT Name Tag"
                currentFile={assetStatus?.nametags?.TOT}
                onUpload={(file) => handleNametagUpload('TOT', file)}
                isUploading={uploading.TOT_nametag}
                assetType="nametag"
                filename="TOT.png"
              />
            </div>
          </div>

          {/* Reset Database Section */}
          <div className="content-section">
            <div className="section-header">
              <h2 className="section-title reset-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Reset Database
              </h2>
            </div>
            <p className="section-desc">Clear all admin assets and agent data. Generated certificates will be preserved for viewing in Certificate History</p>

            <button
              className="btn-reset"
              onClick={() => setShowResetConfirm(true)}
            >
              Reset Database
            </button>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="modal-content preview-modal" onClick={e => e.stopPropagation()}>
            <div className="preview-header">
              <h3>{previewImage.title}</h3>
              <button className="modal-close" onClick={() => setPreviewImage(null)}>×</button>
            </div>
            <div className="preview-body">
              <img src={previewImage.url} alt={previewImage.title} />
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>Confirm Reset</h3>
            <p>Are you sure you want to reset the database? This will clear all admin assets and agent data.</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button className="btn-confirm-reset" onClick={handleResetDatabase}>Reset Database</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
