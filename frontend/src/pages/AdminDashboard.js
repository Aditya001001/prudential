import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, XCircle, Image as ImageIcon, FileText, AlertCircle, Eye, Shield, Trash2, AlertTriangle } from 'lucide-react';
import ImagePreviewModal from '../components/ImagePreviewModal';
import './AdminDashboard.css';

const API_URL = 'https://prudential-certificate.onrender.com/api';

function AdminDashboard() {
  const [assetStatus, setAssetStatus] = useState(null);
  const [uploading, setUploading] = useState({});
  const [errors, setErrors] = useState({});
  const [successMessages, setSuccessMessages] = useState({});
  const [previewModal, setPreviewModal] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);


  useEffect(() => {
    fetchAssetStatus();
  }, []);

  const fetchAssetStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/status`);
      setAssetStatus(response.data);
      if (response.data.csv_info) {
        setCsvPreview(response.data.csv_info);
      }
    } catch (error) {
      console.error('Failed to fetch asset status:', error);
    }
  };

  const handleUploadBackgrounds = async (files) => {
    setUploading(prev => ({ ...prev, backgrounds: true }));
    setErrors(prev => ({ ...prev, backgrounds: null }));
    setSuccessMessages(prev => ({ ...prev, backgrounds: null }));

    const formData = new FormData();
    if (files.mdrt) formData.append('MDRT', files.mdrt);
    if (files.cot) formData.append('COT', files.cot);
    if (files.tot) formData.append('TOT', files.tot);

    try {
      const response = await axios.post(`${API_URL}/admin/upload-backgrounds`, formData);
      if (response.data.success) {
        setSuccessMessages(prev => ({ ...prev, backgrounds: 'Backgrounds uploaded successfully!' }));
        fetchAssetStatus();
      }
    } catch (error) {
      setErrors(prev => ({ ...prev, backgrounds: error.response?.data?.error || 'Upload failed' }));
    } finally {
      setUploading(prev => ({ ...prev, backgrounds: false }));
    }
  };

  const handleUploadBadges = async (files) => {
    setUploading(prev => ({ ...prev, badges: true }));
    setErrors(prev => ({ ...prev, badges: null }));
    setSuccessMessages(prev => ({ ...prev, badges: null }));

    const formData = new FormData();
    if (files.lm) formData.append('LM', files.lm);
    if (files.hr) formData.append('HR', files.hr);
    if (files.qc) formData.append('QC', files.qc);

    try {
      const response = await axios.post(`${API_URL}/admin/upload-badges`, formData);
      if (response.data.success) {
        setSuccessMessages(prev => ({ ...prev, badges: 'Badges uploaded successfully!' }));
        fetchAssetStatus();
      }
    } catch (error) {
      setErrors(prev => ({ ...prev, badges: error.response?.data?.error || 'Upload failed' }));
    } finally {
      setUploading(prev => ({ ...prev, badges: false }));
    }
  };

  const handleUploadCSV = async (file) => {
    setUploading(prev => ({ ...prev, csv: true }));
    setErrors(prev => ({ ...prev, csv: null }));
    setSuccessMessages(prev => ({ ...prev, csv: null }));

    const formData = new FormData();
    formData.append('csv', file);

    try {
      const response = await axios.post(`${API_URL}/admin/upload-csv`, formData);
      if (response.data.success) {
        setSuccessMessages(prev => ({ ...prev, csv: `CSV uploaded! ${response.data.total_agents} agents loaded.` }));
        setCsvPreview({
          total_agents: response.data.total_agents,
          preview: response.data.preview,
          filename: response.data.filename
        });
        fetchAssetStatus();
      }
    } catch (error) {
      setErrors(prev => ({ ...prev, csv: error.response?.data?.error || 'Upload failed' }));
    } finally {
      setUploading(prev => ({ ...prev, csv: false }));
    }
  };

  const handleDeleteCSV = async () => {
    if (!window.confirm('Delete the CSV file and all agent data?\n\nThis will remove all agents from the database. Generated certificates will be preserved.')) {
      return;
    }

    try {
      const response = await axios.delete(`${API_URL}/admin/delete-csv`);
      if (response.data.success) {
        setSuccessMessages(prev => ({ ...prev, csv: 'CSV file deleted successfully!' }));
        setCsvPreview(null);
        fetchAssetStatus();
      }
    } catch (error) {
      setErrors(prev => ({ ...prev, csv: error.response?.data?.error || 'Delete failed' }));
    }
  };

  const openPreview = (assetType, filename, label) => {
    setPreviewModal({
      url: `${API_URL}/admin/preview-asset/${assetType}/${filename}`,
      name: label
    });
  };

  const handleResetDatabase = async () => {
    setResetting(true);
    setErrors(prev => ({ ...prev, reset: null }));
    setSuccessMessages(prev => ({ ...prev, reset: null }));

    try {
      const response = await axios.post(`${API_URL}/admin/reset-database`);
      if (response.data.success) {
        setSuccessMessages(prev => ({ ...prev, reset: 'Admin assets reset successfully!' }));
        setCsvPreview(null);
        fetchAssetStatus();
        setShowResetConfirm(false);

        setTimeout(() => {
          setSuccessMessages(prev => ({ ...prev, reset: null }));
        }, 5000);
      }
    } catch (error) {
      setErrors(prev => ({ ...prev, reset: error.response?.data?.error || 'Reset failed' }));
    } finally {
      setResetting(false);
    }
  };



  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div className="header-content">
          <Shield size={40} className="header-icon" />
          <div>
            <h1>Admin Dashboard</h1>
            <p>Manage Master Assets for MDRT Certificate Generator</p>
          </div>
        </div>
      </div>

      <div className="admin-content">
        <div className="status-overview">
          <h2><AlertCircle size={24} /> System Status</h2>
          {assetStatus && (
            <div className="status-grid">
              <StatusCard 
                title="Backgrounds" 
                items={assetStatus.backgrounds}
                icon={<ImageIcon size={20} />}
              />
              <StatusCard 
                title="Badges" 
                items={assetStatus.badges}
                icon={<ImageIcon size={20} />}
              />
              <StatusCard 
                title="Master CSV" 
                items={{ 'Data File': assetStatus.csv }}
                icon={<FileText size={20} />}
                extra={assetStatus.csv_info ? `${assetStatus.csv_info.total_agents} agents` : null}
              />
            </div>
          )}
        </div>

        {/* Master CSV Data Section - Right below System Status */}
        <CSVUploader
          onUpload={handleUploadCSV}
          onDelete={handleDeleteCSV}
          uploading={uploading.csv}
          error={errors.csv}
          success={successMessages.csv}
          csvPreview={csvPreview}
          hasCSV={assetStatus?.csv}
        />

        <BackgroundsUploader
          onUpload={handleUploadBackgrounds}
          uploading={uploading.backgrounds}
          error={errors.backgrounds}
          success={successMessages.backgrounds}
          status={assetStatus?.backgrounds}
          onPreview={openPreview}
        />

        <BadgesUploader
          onUpload={handleUploadBadges}
          uploading={uploading.badges}
          error={errors.badges}
          success={successMessages.badges}
          status={assetStatus?.badges}
          onPreview={openPreview}
        />

        {/* Reset Database Section */}
        <div className="reset-section">
          <div className="reset-header">
            <Trash2 size={24} />
            <h2>Reset Database</h2>
          </div>
          <p className="section-desc">Clear all admin assets and agent data. Generated certificates will be preserved for viewing in Certificate History.</p>

          <button
            className="btn-danger"
            onClick={() => setShowResetConfirm(true)}
            disabled={resetting}
          >
            <Trash2 size={18} />
            {resetting ? 'Resetting...' : 'Reset Database'}
          </button>

          {successMessages.reset && (
            <div className="success-msg"><CheckCircle size={16} /> {successMessages.reset}</div>
          )}
          {errors.reset && (
            <div className="error-msg"><XCircle size={16} /> {errors.reset}</div>
          )}
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <AlertTriangle size={32} className="warning-icon" />
              <h2>Confirm Database Reset</h2>
            </div>
            <div className="modal-body">
              <p>This will permanently delete:</p>
              <ul>
                <li>All {assetStatus?.agent_count || 0} agents from the database</li>
                <li>All tier backgrounds (MDRT, COT, TOT)</li>
                <li>All achievement badges (LM, HR, QC)</li>
                <li>Master CSV data file</li>
              </ul>
              <p className="warning-text">
                <strong>Generated certificates will be preserved</strong> for viewing in Certificate History.
              </p>
              <p>Are you sure you want to continue?</p>
            </div>
            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={handleResetDatabase}
                disabled={resetting}
              >
                {resetting ? 'Resetting...' : 'Yes, Reset Everything'}
              </button>
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
    </div>
  );
}

// Helper Components
function StatusCard({ title, items, icon, extra }) {
  if (!items) {
    return (
      <div className="status-card incomplete">
        <div className="status-card-header">
          {icon}
          <h3>{title}</h3>
        </div>
        <div className="status-items">
          <div className="status-item">
            <XCircle size={16} className="icon-error" />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  const allComplete = Object.values(items).every(v => v === true);

  return (
    <div className={`status-card ${allComplete ? 'complete' : 'incomplete'}`}>
      <div className="status-card-header">
        {icon}
        <h3>{title}</h3>
      </div>
      <div className="status-items">
        {Object.entries(items).map(([key, value]) => (
          <div key={key} className="status-item">
            {value ? <CheckCircle size={16} className="icon-success" /> : <XCircle size={16} className="icon-error" />}
            <span>{key}</span>
          </div>
        ))}
      </div>
      {extra && <div className="status-extra">{extra}</div>}
    </div>
  );
}

function BackgroundsUploader({ onUpload, uploading, error, success, status, onPreview }) {
  const [files, setFiles] = useState({ mdrt: null, cot: null, tot: null });

  const handleUpload = () => {
    onUpload(files);
  };

  return (
    <div className="uploader-section">
      <h2><ImageIcon size={24} /> Tier Backgrounds</h2>
      <p className="section-desc">Upload background images for each MDRT tier</p>

      <div className="backgrounds-grid">
        {[
          { key: 'mdrt', label: 'MDRT', color: 'blue' },
          { key: 'cot', label: 'COT', color: 'red' },
          { key: 'tot', label: 'TOT', color: 'gold' }
        ].map(tier => (
          <div key={tier.key} className="upload-box">
            <label className="upload-label">{tier.label} Background</label>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => setFiles({ ...files, [tier.key]: e.target.files[0] })}
              className="file-input"
            />
            {files[tier.key] && <span className="file-name">✓ {files[tier.key].name}</span>}

            {status?.[tier.label.toUpperCase()] && (
              <div className="preview-container">
                <img
                  src={`http://localhost:5000/api/admin/preview-asset/background/${tier.label.toUpperCase()}.png`}
                  alt={`${tier.label} preview`}
                  className="mini-preview"
                />
                <button
                  className="preview-btn-small"
                  onClick={() => onPreview('background', `${tier.label.toUpperCase()}.png`, `${tier.label} Background`)}
                >
                  <Eye size={14} /> Preview
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <button className="upload-btn" onClick={handleUpload} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload Backgrounds'}
      </button>

      {success && <div className="success-msg"><CheckCircle size={16} /> {success}</div>}
      {error && <div className="error-msg"><XCircle size={16} /> {error}</div>}
    </div>
  );
}

function BadgesUploader({ onUpload, uploading, error, success, status, onPreview }) {
  const [files, setFiles] = useState({ lm: null, hr: null, qc: null });

  const handleUpload = () => {
    onUpload(files);
  };

  return (
    <div className="uploader-section">
      <h2><ImageIcon size={24} /> Achievement Badges</h2>
      <p className="section-desc">Upload badge images for achievements</p>

      <div className="backgrounds-grid">
        {[
          { key: 'lm', label: 'LM', fullName: 'Life Member' },
          { key: 'hr', label: 'HR', fullName: 'Honor Roll' },
          { key: 'qc', label: 'QC', fullName: 'Quarter Century' }
        ].map(badge => (
          <div key={badge.key} className="upload-box">
            <label className="upload-label">{badge.fullName}</label>
            <input
              type="file"
              accept="image/png"
              onChange={(e) => setFiles({ ...files, [badge.key]: e.target.files[0] })}
              className="file-input"
            />
            {files[badge.key] && <span className="file-name">✓ {files[badge.key].name}</span>}

            {status?.[badge.label] && (
              <div className="preview-container">
                <img
                  src={`http://localhost:5000/api/admin/preview-asset/badge/${badge.label}.png`}
                  alt={`${badge.fullName} preview`}
                  className="mini-preview"
                />
                <button
                  className="preview-btn-small"
                  onClick={() => onPreview('badge', `${badge.label}.png`, badge.fullName)}
                >
                  <Eye size={14} /> Preview
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <button className="upload-btn" onClick={handleUpload} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload Badges'}
      </button>

      {success && <div className="success-msg"><CheckCircle size={16} /> {success}</div>}
      {error && <div className="error-msg"><XCircle size={16} /> {error}</div>}
    </div>
  );
}

function CSVUploader({ onUpload, onDelete, uploading, error, success, csvPreview, hasCSV }) {
  const [file, setFile] = useState(null);

  const handleUpload = () => {
    if (file) {
      onUpload(file);
      setFile(null); // Clear file input after upload
    }
  };

  return (
    <div className="uploader-section csv-section">
      <h2><FileText size={24} /> Master CSV Data</h2>
      <p className="section-desc">Upload the master CSV file with all agent information</p>

      {/* Show current CSV file if exists */}
      {hasCSV && csvPreview && (
        <div className="current-csv-info">
          <div className="csv-file-card">
            <FileText size={24} className="csv-file-icon" />
            <div className="csv-file-details">
              <span className="csv-filename">{csvPreview.filename || 'data.csv'}</span>
              <span className="csv-agent-count">{csvPreview.total_agents} agents loaded</span>
            </div>
            <button
              className="btn-delete-csv"
              onClick={onDelete}
              title="Delete CSV file"
            >
              <Trash2 size={18} />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Upload new CSV */}
      <div className="csv-upload-area">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files[0])}
          className="file-input"
        />
        {file && <span className="file-name">✓ {file.name}</span>}
      </div>

      <button className="upload-btn" onClick={handleUpload} disabled={uploading || !file}>
        {uploading ? 'Uploading...' : hasCSV ? 'Replace CSV' : 'Upload CSV'}
      </button>

      {success && <div className="success-msg"><CheckCircle size={16} /> {success}</div>}
      {error && <div className="error-msg"><XCircle size={16} /> {error}</div>}

      {csvPreview && (
        <div className="csv-preview">
          <h3>Sample Data Preview</h3>
          <div className="csv-table">
            {csvPreview.preview && csvPreview.preview.slice(0, 5).map((row, idx) => (
              <div key={idx} className="csv-row">
                <strong>{row['Client Cd']}</strong>: {row['Agent Name']} - {row['MDRT Title']}
              </div>
            ))}
            {csvPreview.total_agents > 5 && (
              <div className="csv-row more-info">
                ... and {csvPreview.total_agents - 5} more agents
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
