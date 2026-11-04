import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios, { API_URL, logout, errorMessage } from '../api';
import { Upload, Eye, LogOut, User as UserIcon, History } from 'lucide-react';
import './AdminDashboard.css';


function AdminDashboard() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [assetStatus, setAssetStatus] = useState(null);
  const [uploading, setUploading] = useState({});
  const [previewImage, setPreviewImage] = useState(null);
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
      setError(errorMessage(error));
    }
  };

  const handleLogout = async () => {
    try { await logout(); }
    catch (error) { setError(errorMessage(error)); return; }
    navigate('/admin/login');
  };

  const handleBackgroundUpload = async (tier, file) => {
    const formData = new FormData();
    formData.append(tier, file);

    setError(null);
    setUploading(prev => ({ ...prev, [tier]: true }));
    try {
      await axios.post(`${API_URL}/admin/upload-backgrounds`, formData);
      setImageTimestamp(Date.now()); // Force image refresh only after upload
      await fetchAssetStatus();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setUploading(prev => ({ ...prev, [tier]: false }));
    }
  };

  const handleBadgeUpload = async (badgeType, file) => {
    const formData = new FormData();
    formData.append(badgeType, file);

    setError(null);
    setUploading(prev => ({ ...prev, [badgeType]: true }));
    try {
      await axios.post(`${API_URL}/admin/upload-badges`, formData);
      setImageTimestamp(Date.now()); // Force image refresh only after upload
      await fetchAssetStatus();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setUploading(prev => ({ ...prev, [badgeType]: false }));
    }
  };

  const handleNametagUpload = async (tier, file) => {
    const formData = new FormData();
    formData.append(tier, file);

    setError(null);
    setUploading(prev => ({ ...prev, [tier + '_nametag']: true }));
    try {
      await axios.post(`${API_URL}/admin/upload-nametags`, formData);
      setImageTimestamp(Date.now()); // Force image refresh only after upload
      await fetchAssetStatus();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setUploading(prev => ({ ...prev, [tier + '_nametag']: false }));
    }
  };

  const handleLayerUpload = async (tier, file) => {
    const formData = new FormData();
    formData.append(tier, file);

    setError(null);
    setUploading(prev => ({ ...prev, [tier + '_layer']: true }));
    try {
      await axios.post(`${API_URL}/admin/upload-layers`, formData);
      setImageTimestamp(Date.now()); // Force image refresh only after upload
      await fetchAssetStatus();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setUploading(prev => ({ ...prev, [tier + '_layer']: false }));
    }
  };

  const handleCSVUpload = async (file) => {
    const formData = new FormData();
    formData.append('csv', file);

    setError(null);
    setUploading(prev => ({ ...prev, csv: true }));
    try {
      await axios.post(`${API_URL}/admin/upload-csv`, formData);
      fetchAssetStatus();
      // CSV uploaded successfully
    } catch (error) {
      setError(errorMessage(error));
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
      setError(errorMessage(error));
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
    const buttonText = isUploading ? "正在上傳…" : (currentFile ? "更換檔案" : "上傳檔案");

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
              disabled={isUploading}
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
            <div className="mini-preview" onClick={handlePreviewClick} title="點擊查看原圖">
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
          <img src={`${process.env.PUBLIC_URL}/PRU_logo_white_RGB_v1%201.png`} alt="保誠" />
        </div>
        
        <nav className="sidebar-nav">
          <a href="/prudential/" className="nav-item">
            <UserIcon size={20} />
            <span>使用者入口</span>
          </a>
          <a href="/prudential/admin" className="nav-item active">
            <Upload size={20} />
            <span>管理員控制台</span>
          </a>
          <a href="/prudential/history" className="nav-item">
            <History size={20} />
            <span>海報紀錄</span>
          </a>
          <a href="/prudential/master-data-history" className="nav-item">
            <History size={20} />
            <span>主資料上傳紀錄</span>
          </a>
        </nav>

        <button className="logout-button" onClick={handleLogout}>
          <LogOut size={18} />
          <span>登出</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="admin-main">
          {error && <div className="request-error" role="alert">{error}</div>}
        <div className="admin-header-bar">
          <div>
            <h1 className="page-title">管理員控制台</h1>
            <p className="page-subtitle">管理 MDRT 海報產生器的主要素材</p>
          </div>
        </div>

        <div className="admin-content-area">
          {/* Status Overview Cards */}
          <div className="status-cards">
            <div className="status-card">
              <div className="status-card-icon backgrounds-icon">
                <Upload size={20} />
              </div>
              <div className="status-card-content">
                <h3>背景圖片</h3>
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
                <h3>徽章</h3>
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
                <h3>名牌</h3>
                <div className="status-items">
                  {assetStatus?.nametags?.MDRT && <span className="status-check">✓MDRT</span>}
                  {assetStatus?.nametags?.COT && <span className="status-check">✓COT</span>}
                  {assetStatus?.nametags?.TOT && <span className="status-check">✓TOT</span>}
                </div>
              </div>
            </div>

            <div className="status-card">
              <div className="status-card-icon backgrounds-icon">
                <Upload size={20} />
              </div>
              <div className="status-card-content">
                <h3>圖層</h3>
                <div className="status-items">
                  {assetStatus?.layers?.MDRT && <span className="status-check">✓MDRT</span>}
                  {assetStatus?.layers?.COT && <span className="status-check">✓COT</span>}
                  {assetStatus?.layers?.TOT && <span className="status-check">✓TOT</span>}
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
                <h3>主資料 CSV 檔案</h3>
                <div className="status-items">
                  {assetStatus?.csv && <span className="status-check">✓資料檔案</span>}
                  {assetStatus?.csv_info && (
                    <span className="agent-count">{assetStatus.csv_info.total_agents} 位代理人</span>
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
                主資料 CSV 數據
              </h2>
            </div>
            <p className="section-desc">上傳 CSV 或 Excel 檔案，以新增或更新代理人資料。未列於上傳檔案的代理人資料將維持不變。</p>

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
                    <div className="csv-agent-count">{assetStatus.csv_info.total_agents} 位代理人已載入</div>
                  </div>
                  <button className="btn-delete-csv" onClick={handleDeleteCSV}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                    刪除
                  </button>
                </div>

                {assetStatus.csv_info.preview && assetStatus.csv_info.preview.length > 0 && (
                  <div className="csv-data-preview">
                    <h4>範例資料預覽</h4>
                    <div className="preview-list">
                      {assetStatus.csv_info.preview.slice(0, 6).map((agent, idx) => (
                        <div key={idx} className="preview-item">
                          <span className="preview-code">
                            {agent['Client Cd'] || agent.client_code || "不適用"}
                          </span>
                          <span className="preview-name">
                            {agent['Agent Name'] || agent.agent_name || "不詳"} - {agent['MDRT Title'] || agent.mdrt_tier || "不適用"}
                          </span>
                        </div>
                      ))}
                      {assetStatus.csv_info.total_agents > 6 && (
                        <div className="preview-more">
                          另有 {assetStatus.csv_info.total_agents - 6} 位代理人
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
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    // If no CSV exists yet, upload automatically (first time)
                    // Otherwise, store file and show "Merge Master Data" button
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
                {uploading.csv ? "正在上傳…" : "選擇檔案"}
              </label>
              <span className="file-input-text">
                {uploading.csv
                  ? "正在上傳…"
                  : selectedCSVFile
                    ? selectedCSVFile.name
                    : (assetStatus && assetStatus.csv ? "選擇新的 CSV 或 Excel 檔案" : "選擇要上傳的 CSV 或 Excel 檔案")}
              </span>
            </div>

            {/* Show Merge Master Data button only when CSV exists and new file is selected */}
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
                {uploading.csv ? "正在上傳…" : "合併主資料"}
              </button>
            )}
          </div>

          {/* Tier Backgrounds Section */}
          <div className="content-section">
            <div className="section-header">
              <h2 className="section-title">
                <Upload size={20} className="section-icon" />
                級別背景圖片
              </h2>
              <button className="btn-upload-all">上傳背景圖片</button>
            </div>
            <p className="section-desc">上傳各 MDRT 級別的背景圖片</p>

            <div className="upload-grid">
              <FileUploadBox
                title="MDRT 背景圖片"
                currentFile={assetStatus?.backgrounds?.MDRT}
                onUpload={(file) => handleBackgroundUpload('MDRT', file)}
                isUploading={uploading.MDRT}
                assetType="background"
                filename="MDRT.png"
              />
              <FileUploadBox
                title="COT 背景圖片"
                currentFile={assetStatus?.backgrounds?.COT}
                onUpload={(file) => handleBackgroundUpload('COT', file)}
                isUploading={uploading.COT}
                assetType="background"
                filename="COT.png"
              />
              <FileUploadBox
                title="TOT 背景圖片"
                currentFile={assetStatus?.backgrounds?.TOT}
                onUpload={(file) => handleBackgroundUpload('TOT', file)}
                isUploading={uploading.TOT}
                assetType="background"
                filename="TOT.png"
              />
            </div>
          </div>

          {/* Tier Layers Section */}
          <div className="content-section">
            <div className="section-header">
              <h2 className="section-title">
                <Upload size={20} className="section-icon" />
                級別圖層
              </h2>
              <button className="btn-upload-all">上傳圖層</button>
            </div>
            <p className="section-desc">上傳各 MDRT 級別的疊加圖層圖片（顯示於代理人照片之上、名牌之下）</p>

            <div className="upload-grid">
              <FileUploadBox
                title="MDRT 圖層"
                currentFile={assetStatus?.layers?.MDRT}
                onUpload={(file) => handleLayerUpload('MDRT', file)}
                isUploading={uploading.MDRT_layer}
                assetType="layer"
                filename="MDRT.png"
              />
              <FileUploadBox
                title="COT 圖層"
                currentFile={assetStatus?.layers?.COT}
                onUpload={(file) => handleLayerUpload('COT', file)}
                isUploading={uploading.COT_layer}
                assetType="layer"
                filename="COT.png"
              />
              <FileUploadBox
                title="TOT 圖層"
                currentFile={assetStatus?.layers?.TOT}
                onUpload={(file) => handleLayerUpload('TOT', file)}
                isUploading={uploading.TOT_layer}
                assetType="layer"
                filename="TOT.png"
              />
            </div>
          </div>

          {/* Achievement Badges Section */}
          <div className="content-section">
            <div className="section-header">
              <h2 className="section-title">
                <Upload size={20} className="section-icon" />
                成就徽章
              </h2>
              <button className="btn-upload-all">上傳徽章</button>
            </div>
            <p className="section-desc">上傳成就徽章圖片</p>

            <div className="upload-grid">
              <FileUploadBox
                title="終身會員"
                currentFile={assetStatus?.badges?.LM}
                onUpload={(file) => handleBadgeUpload('LM', file)}
                isUploading={uploading.LM}
                assetType="badge"
                filename="LM.png"
              />
              <FileUploadBox
                title="榮譽榜"
                currentFile={assetStatus?.badges?.HR}
                onUpload={(file) => handleBadgeUpload('HR', file)}
                isUploading={uploading.HR}
                assetType="badge"
                filename="HR.png"
              />
              <FileUploadBox
                title="四分之一世紀會員"
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
                名牌橫幅
              </h2>
              <button className="btn-upload-all">上傳名牌</button>
            </div>
            <p className="section-desc">上傳各 MDRT 級別的名牌橫幅圖片</p>

            <div className="upload-grid">
              <FileUploadBox
                title="MDRT 名牌"
                currentFile={assetStatus?.nametags?.MDRT}
                onUpload={(file) => handleNametagUpload('MDRT', file)}
                isUploading={uploading.MDRT_nametag}
                assetType="nametag"
                filename="MDRT.png"
              />
              <FileUploadBox
                title="COT 名牌"
                currentFile={assetStatus?.nametags?.COT}
                onUpload={(file) => handleNametagUpload('COT', file)}
                isUploading={uploading.COT_nametag}
                assetType="nametag"
                filename="COT.png"
              />
              <FileUploadBox
                title="TOT 名牌"
                currentFile={assetStatus?.nametags?.TOT}
                onUpload={(file) => handleNametagUpload('TOT', file)}
                isUploading={uploading.TOT_nametag}
                assetType="nametag"
                filename="TOT.png"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="modal-content preview-modal" onClick={e => e.stopPropagation()}>
            <div className="preview-header">
              <h3>{previewImage.title}</h3>
              <button className="modal-close" aria-label="關閉圖片預覽" onClick={() => setPreviewImage(null)}>×</button>
            </div>
            <div className="preview-body">
              <img src={previewImage.url} alt={previewImage.title} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default AdminDashboard;
