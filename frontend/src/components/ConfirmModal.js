import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import './ConfirmModal.css';

function ConfirmModal({ isOpen, onClose, onConfirm, title, message }) {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target.className === 'confirm-modal-backdrop') {
      onClose();
    }
  };

  return (
    <div className="confirm-modal-backdrop" onClick={handleBackdropClick}>
      <div className="confirm-modal-content">
        <button className="confirm-close-btn" onClick={onClose}>
          <X size={20} />
        </button>
        
        <div className="confirm-icon">
          <AlertTriangle size={48} />
        </div>
        
        <h3 className="confirm-title">{title || 'Confirm Action'}</h3>
        <p className="confirm-message">{message || 'Are you sure you want to proceed?'}</p>
        
        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-confirm" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
