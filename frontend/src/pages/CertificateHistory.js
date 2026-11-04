import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios, { API_URL, logout, errorMessage } from '../api';
import { Eye, Download, Trash2, AlertCircle, Search, Calendar, User, Home, Users, Image as ImageIcon, History } from 'lucide-react';
import ImagePreviewModal from '../components/ImagePreviewModal';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import './CertificateHistory.css';


function CertificateHistory() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const filteredCertificates = certificates;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previewModal, setPreviewModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Search and filter states
  const [searchKeyword, setSearchKeyword] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchCertificates = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/certificates/history`, {
        signal, params: { page, per_page: 25, search: searchKeyword, from: fromDate, to: toDate }
      });
      setCertificates(response.data.certificates);
      setTotal(response.data.total);
      if (page > 1 && response.data.certificates.length === 0) setPage(page - 1);
    } catch (error) {
      if (error.code !== 'ERR_CANCELED') setError(errorMessage(error));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, searchKeyword, fromDate, toDate]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => fetchCertificates(controller.signal), 250);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [fetchCertificates]);

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
        await fetchCertificates();
        setConfirmDelete(null);
      }
    } catch (error) {
      setError(errorMessage(error));
      setConfirmDelete(null);
    }
  };

  const handleLogout = async () => {
    try { await logout(); }
    catch (error) { setError(errorMessage(error)); return; }
    navigate('/admin/login');
  };

  return (
    <div className="new-admin-container">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="sidebar-logo">
          <img src={`${process.env.PUBLIC_URL}/PRU_logo_white_RGB_v1%201.png`} alt="保誠" />
        </div>
        
        <nav className="sidebar-nav">
          <button className="nav-item" onClick={() => navigate('/')}>
            <User size={20} />
            使用者入口
          </button>
          <button className="nav-item" onClick={() => navigate('/admin')}>
            <Home size={20} />
            管理員控制台
          </button>
          <button className="nav-item active">
            <Users size={20} />
            海報紀錄
          </button>
          <button className="nav-item" onClick={() => navigate('/master-data-history')}>
            <History size={20} />
            主資料上傳紀錄
          </button>
        </nav>

        <button className="logout-button" onClick={handleLogout}>
          <AlertCircle size={18} />
          登出
        </button>
      </div>

      {/* Main Content */}
      <div className="admin-main">
          {error && <div className="request-error" role="alert">{error}</div>}
        {/* Header */}
        <div className="admin-header-bar">
          <div>
            <h1 className="page-title">海報紀錄</h1>
            <p className="page-subtitle">查看及管理所有已產生的海報</p>
          </div>
        </div>

        {/* Search Section */}
        <div className="search-card">
          <div className="search-controls">
            <div className="search-input-wrapper">
              <Search size={18} />
              <input
                type="text"
                placeholder="輸入搜尋關鍵字"
                className="search-input"
                value={searchKeyword}
                onChange={(e) => { setPage(1); setSearchKeyword(e.target.value); }}
              />
            </div>

            <div className="date-input-wrapper">
              <label>開始日期</label>
              <div className="input-with-icon">
                <Calendar size={16} />
                <input
                  type="date"
                  lang="zh-Hant-HK"
                  aria-label="開始日期"
                  className="date-input"
                  value={fromDate}
                  onChange={(e) => { setPage(1); setFromDate(e.target.value); }}
                />
              </div>
            </div>

            <div className="date-input-wrapper">
              <label>結束日期</label>
              <div className="input-with-icon">
                <Calendar size={16} />
                <input
                  type="date"
                  lang="zh-Hant-HK"
                  aria-label="結束日期"
                  className="date-input"
                  value={toDate}
                  onChange={(e) => { setPage(1); setToDate(e.target.value); }}
                />
              </div>
            </div>

            <button className="btn-search" onClick={() => fetchCertificates()}>
              搜尋
            </button>
          </div>
        </div>

        <Pagination page={page} total={total} onChange={setPage} loading={loading} />
        {/* Certificates Table */}
        <div className="content-section">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>正在載入海報紀錄…</p>
            </div>
          ) : filteredCertificates.length === 0 ? (
            <div className="empty-state">
              <AlertCircle size={64} />
              <h2>找不到海報紀錄</h2>
              <p>{searchKeyword || fromDate || toDate ? "請嘗試調整搜尋條件" : "已產生的海報將顯示於此"}</p>
            </div>
          ) : (
            <div className="certificates-table-container">
              <table className="certificates-table">
                <thead>
                  <tr>
                    <th>客戶編號</th>
                    <th>代理人姓名</th>
                    <th>級別</th>
                    <th>成就</th>
                    <th>產生日期</th>
                    <th>操作</th>
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
                          {cert.life_member && <span className="achievement-badge">終身會員</span>}
                          {cert.honor_roll && <span className="achievement-badge">榮譽榜</span>}
                          {cert.quarter_century && <span className="achievement-badge">四分之一世紀會員</span>}
                          {!cert.life_member && !cert.honor_roll && !cert.quarter_century && (
                            <span className="text-muted">無</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="cert-date">
                          {new Date(cert.generated_at).toLocaleDateString("zh-HK", {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                          <div className="cert-time">
                            {new Date(cert.generated_at).toLocaleTimeString("zh-HK", {
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
                            title="查看海報"
                          >
                            <Eye size={20} />
                          </button>
                          {cert.has_original_photo && (
                            <button
                              className="btn-icon btn-icon-photo"
                              onClick={() => viewOriginalPhoto(cert.original_photo_filename)}
                              title="查看原始照片"
                            >
                              <ImageIcon size={20} />
                            </button>
                          )}
                          <a
                            href={`${API_URL}/user/download/${cert.filename}`}
                            download={cert.filename}
                            className="btn-icon btn-icon-download"
                            title="下載海報"
                          >
                            <Download size={20} />
                          </a>
                          <button
                            className="btn-icon btn-icon-delete"
                            onClick={() => handleDeleteClick(cert.id, cert.agent_name)}
                            title="刪除海報"
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
        title="刪除海報"
        message={`確定要刪除「${confirmDelete?.name || "此代理人"}」的海報嗎？此操作無法復原。`}
      />
    </div>
  );
}

export default CertificateHistory;
