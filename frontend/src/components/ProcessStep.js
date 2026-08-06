import React, { useState } from 'react';
import axios from 'axios';
import { Zap, Loader } from 'lucide-react';
import './ProcessStep.css';

const API_URL = 'http://localhost:5000/api';

function ProcessStep({ setProcessResults, onNext, onPrevious }) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [status, setStatus] = useState('');

  const startProcessing = async () => {
    setProcessing(true);
    setStatus('Starting certificate generation...');

    try {
      const response = await axios.post(`${API_URL}/process`);
      
      if (response.data.success) {
        setProcessResults(response.data);
        setStatus(`Successfully processed ${response.data.processed} certificates!`);
        setTimeout(() => onNext(), 2000);
      }
    } catch (error) {
      setStatus(`Error: ${error.response?.data?.error || 'Processing failed'}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="process-step">
      <h2><Zap size={28} /> Process Certificates</h2>
      <p className="step-description">Generate all certificates with AI background removal</p>

      <div className="process-container">
        {!processing && !status && (
          <div className="ready-state">
            <Zap size={80} className="ready-icon" />
            <h3>Ready to Process</h3>
            <p>All files uploaded and configured. Click below to start batch processing.</p>
            <button className="start-btn" onClick={startProcessing}>
              🚀 Start Processing
            </button>
          </div>
        )}

        {processing && (
          <div className="processing-state">
            <Loader size={80} className="spinner" />
            <h3>Processing Certificates...</h3>
            <p className="status-text">{status}</p>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '50%' }} />
            </div>
            <p className="progress-text">Please wait, this may take a few minutes...</p>
          </div>
        )}

        {!processing && status && (
          <div className="complete-state">
            <div className="success-icon">✓</div>
            <h3>{status}</h3>
            <p>Redirecting to results...</p>
          </div>
        )}
      </div>

      <div className="navigation-buttons">
        <button className="prev-btn" onClick={onPrevious} disabled={processing}>
          ← Previous
        </button>
      </div>
    </div>
  );
}

export default ProcessStep;
