import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios, { API_URL, logout, errorMessage } from '../api';
import { Download, Trash2, FileText } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import AdminNavigation from '../components/AdminNavigation';
import './CertificateHistory.css';


function MasterDataHistory() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [csvHistory, setCsvHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchCsvHistory = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/admin/csv-history`, { signal, params: { page, per_page: 25 } });
      setCsvHistory(response.data.history);
      setTotal(response.data.total);
      if (page > 1 && response.data.history.length === 0) setPage(page - 1);
    } catch (error) {
      if (error.code !== 'ERR_CANCELED') setError(errorMessage(error));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCsvHistory(controller.signal);
    return () => controller.abort();
  }, [fetchCsvHistory]);

  const downloadCsv = (historyId) => {
    window.open(`${API_URL}/admin/csv-history/${historyId}/download`, '_blank');
  };

  const handleDeleteClick = (historyId, filename) => {
    setConfirmDelete({ id: historyId, name: filename });
  };

  const confirmDeleteCsv = async () => {
    if (!confirmDelete) return;

    try {
      const response = await axios.delete(`${API_URL}/admin/csv-history/${confirmDelete.id}`);
      if (response.data.success) {
        await fetchCsvHistory();
      }
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setConfirmDelete(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleLogout = async () => {
    try { await logout(); }
    catch (error) { setError(errorMessage(error)); return; }
    navigate('/admin/login');
  };

  return (
    <div className="new-admin-container">
      <AdminNavigation onLogout={handleLogout} />

      {/* Main Content */}
      <div className="admin-main">
          {error && <div className="request-error" role="alert">{error}</div>}
        <div className="admin-header-bar">
          <div>
            <h1 className="page-title">主資料上傳紀錄</h1>
            <p className="page-subtitle">查看及下載所有已上傳的主資料 CSV 或 Excel 檔案</p>
          </div>
        </div>

        <Pagination page={page} total={total} onChange={setPage} loading={loading} />
        <div className="content-section">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>正在載入上傳紀錄…</p>
            </div>
          ) : csvHistory.length === 0 ? (
            <div className="empty-state">
              <FileText size={64} />
              <h2>找不到上傳紀錄</h2>
              <p>已上傳的主資料 CSV 或 Excel 檔案將顯示於此</p>
            </div>
          ) : (
            <div className="certificates-table-container">
              <table className="certificates-table" aria-label="主資料上傳紀錄">
                <thead>
                  <tr>
                    <th>檔案名稱</th>
                    <th>代理人總數</th>
                    <th>新增／更新</th>
                    <th>檔案大小</th>
                    <th>上傳日期</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {csvHistory.map((item) => (
                    <tr key={item.id}>
                      <td data-label="檔案名稱">
                        <strong>{item.original_filename}</strong>
                      </td>
                      <td data-label="代理人總數">{item.total_agents}</td>
                      <td data-label="新增／更新">
                        新增 {item.imported_count} 筆／更新 {item.updated_count} 筆
                      </td>
                      <td data-label="檔案大小">{formatFileSize(item.file_size)}</td>
                      <td data-label="上傳日期">
                        <div className="cert-date">
                          {new Date(item.uploaded_at).toLocaleDateString("zh-HK", {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                          <div className="cert-time">
                            {new Date(item.uploaded_at).toLocaleTimeString("zh-HK", {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </td>
                      <td data-label="操作">
                        <div className="cert-actions">
                          <button
                            className="btn-icon btn-icon-download"
                            onClick={() => downloadCsv(item.id)}
                            title="下載 CSV 檔案"
                            aria-label="下載 CSV 檔案"
                          >
                            <Download size={20} />
                          </button>
                          <button
                            className="btn-icon btn-icon-delete"
                            onClick={() => handleDeleteClick(item.id, item.original_filename)}
                            title="刪除紀錄"
                            aria-label="刪除紀錄"
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

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteCsv}
        title="刪除上傳紀錄"
        message={`確定要從紀錄中刪除「${confirmDelete?.name || "此檔案"}」嗎？此操作無法復原。`}
      />
    </div>
  );
}

export default MasterDataHistory;
