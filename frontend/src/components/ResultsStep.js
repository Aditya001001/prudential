import React, { useState } from 'react';
import { Download, CheckCircle, XCircle, Package, Eye } from 'lucide-react';
import ImagePreviewModal from './ImagePreviewModal';
import './ResultsStep.css';

const API_URL = 'http://localhost:5000/api';

function ResultsStep({ processResults, onPrevious }) {
  const [previewModal, setPreviewModal] = useState(null);

  if (!processResults) {
    return (
      <div className="results-step">
        <h2>No Results Yet</h2>
        <p>Please complete the processing step first.</p>
        <button className="prev-btn" onClick={onPrevious}>
          ← Go Back
        </button>
      </div>
    );
  }

  const handleDownloadAll = () => {
    window.open(`${API_URL}/download-all`, '_blank');
  };

  const handleDownloadSingle = (filename) => {
    window.open(`${API_URL}/download/${filename}`, '_blank');
  };

  const openPreview = (filename, agentName, tier) => {
    setPreviewModal({
      url: `${API_URL}/preview/${filename}`,
      name: agentName,
      tier: tier,
      filename: filename
    });
  };

  return (
    <div className="results-step">
      <h2><Download size={28} /> Processing Complete!</h2>
      <p className="step-description">Your certificates are ready to download</p>

      <div className="summary-cards">
        <div className="summary-card success">
          <CheckCircle size={40} />
          <div className="card-content">
            <div className="card-number">{processResults.processed}</div>
            <div className="card-label">Successful</div>
          </div>
        </div>

        {processResults.errors && processResults.errors.length > 0 && (
          <div className="summary-card error">
            <XCircle size={40} />
            <div className="card-content">
              <div className="card-number">{processResults.errors.length}</div>
              <div className="card-label">Failed</div>
            </div>
          </div>
        )}
      </div>

      <div className="download-section">
        <button className="download-all-btn" onClick={handleDownloadAll}>
          <Package size={20} />
          Download All as ZIP
        </button>
      </div>

      <div className="results-list">
        <h3>Generated Certificates</h3>
        <div className="results-grid">
          {processResults.results.map((result, idx) => (
            <div key={idx} className="result-item">
              {/* Certificate Preview Thumbnail */}
              <div className="result-preview">
                <img
                  src={`${API_URL}/preview/${result.output_file}`}
                  alt={result.agent_name}
                  className="result-thumbnail"
                  onClick={() => openPreview(result.output_file, result.agent_name, result.tier)}
                />
                <button
                  className="preview-overlay-btn"
                  onClick={() => openPreview(result.output_file, result.agent_name, result.tier)}
                >
                  <Eye size={20} />
                  <span>View Full Size</span>
                </button>
              </div>

              <div className="result-info">
                <div className="result-name">{result.agent_name}</div>
                <div className="result-details">
                  {result.tier} • {result.client_code}
                  {result.badges.length > 0 && (
                    <span className="badges-indicator">
                      {' '}• Badges: {result.badges.join(', ')}
                    </span>
                  )}
                </div>
              </div>
              <button
                className="download-single-btn"
                onClick={() => handleDownloadSingle(result.output_file)}
              >
                <Download size={16} />
                Download
              </button>
            </div>
          ))}
        </div>
      </div>

      {processResults.errors && processResults.errors.length > 0 && (
        <div className="errors-section">
          <h3>Errors</h3>
          <div className="errors-list">
            {processResults.errors.map((error, idx) => (
              <div key={idx} className="error-item">
                <XCircle size={16} />
                <span>{error.agent}: {error.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="navigation-buttons">
        <button className="prev-btn" onClick={onPrevious}>
          ← Start New Batch
        </button>
      </div>

      {/* Image Preview Modal */}
      {previewModal && (
        <ImagePreviewModal
          image={previewModal}
          onClose={() => setPreviewModal(null)}
          onDownload={() => handleDownloadSingle(previewModal.filename)}
        />
      )}
    </div>
  );
}

export default ResultsStep;
