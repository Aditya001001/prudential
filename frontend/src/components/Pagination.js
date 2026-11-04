import React from 'react';

export default function Pagination({ page, total, size = 25, onChange, loading }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <nav aria-label="紀錄分頁" className="pagination-controls">
      <button disabled={loading || page <= 1} onClick={() => onChange(page - 1)}>上一頁</button>
      <span>第 {page} 頁，共 {pages} 頁 · {total} 筆紀錄</span>
      <button disabled={loading || page >= pages} onClick={() => onChange(page + 1)}>下一頁</button>
    </nav>
  );
}
