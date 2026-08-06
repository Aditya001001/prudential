import React from 'react';
import { X, Download } from 'lucide-react';
import './ImagePreviewModal.css';

function ImagePreviewModal({ image, onClose, onDownload }) {
  if (!image) return null;

  const handleBackdropClick = (e) => {
    if (e.target.className === 'modal-backdrop') {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>{image.name || 'Image Preview'}</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="modal-body">
          <img 
            src={image.url} 
            alt={image.name || 'Preview'} 
            className="modal-image"
          />
        </div>

        <div className="modal-footer">
          <div className="image-info">
            {image.size && <span className="info-text">Size: {image.size}</span>}
            {image.tier && <span className="tier-badge">{image.tier}</span>}
          </div>
          {onDownload && (
            <button className="download-btn" onClick={onDownload}>
              <Download size={18} />
              Download
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImagePreviewModal;
