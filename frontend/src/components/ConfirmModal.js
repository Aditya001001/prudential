import React, { useId } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import './ConfirmModal.css';
import useDialog from './useDialog';

function ConfirmModal({ isOpen, onClose, onConfirm, title, message }) {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useDialog(onClose, isOpen, '.btn-cancel');
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target.className === 'confirm-modal-backdrop') {
      onClose();
    }
  };

  return (
    <div className="confirm-modal-backdrop" onClick={handleBackdropClick}>
      <div className="confirm-modal-content" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} tabIndex={-1}>
        <button className="confirm-close-btn" aria-label="關閉確認視窗" onClick={onClose}>
          <X size={20} />
        </button>
        
        <div className="confirm-icon">
          <AlertTriangle size={48} />
        </div>
        
        <h3 id={titleId} className="confirm-title">{title || "確認操作"}</h3>
        <p id={messageId} className="confirm-message">{message || "確定要繼續嗎？"}</p>
        
        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onClose}>
            取消
          </button>
          <button className="btn-confirm" onClick={onConfirm}>
            刪除
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
