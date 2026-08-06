import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, CheckCircle, XCircle, AlertCircle, Download, User, Award, Eye, Camera, X } from 'lucide-react';
import ImagePreviewModal from '../components/ImagePreviewModal';
import './UserPortal.css';

const API_URL = 'http://localhost:5000/api';

function UserPortal() {
  const [systemReady, setSystemReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [previewModal, setPreviewModal] = useState(null);
  const [clientCode, setClientCode] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [step, setStep] = useState(1); // 1: Enter ID, 2: Upload/Capture, 3: Preview, 4: Result
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);

  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/user/check-system`);
      setSystemReady(response.data.ready);
    } catch (error) {
      console.error('Failed to check system status:', error);
      setSystemReady(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setError(null);

      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
        setStep(3); // Move to preview step
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 1280, height: 720 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Unable to access camera. Please check permissions.');
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (canvas && video) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      canvas.toBlob((blob) => {
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setSelectedFile(file);
        setPreviewImage(canvas.toDataURL('image/jpeg'));
        stopCamera();
        setStep(3); // Move to preview step
      }, 'image/jpeg', 0.95);
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!clientCode.trim()) {
        setError('Please enter your Client Code');
        return;
      }
      setError(null);
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step === 3) {
      setSelectedFile(null);
      setPreviewImage(null);
      setStep(2);
    } else if (step === 2) {
      setStep(1);
    }
  };

  const handleFileUpload = async () => {
    if (!systemReady) {
      setError('System is not ready. Please contact the administrator.');
      return;
    }

    if (!clientCode.trim()) {
      setError('Please enter your Client Code');
      return;
    }

    if (!selectedFile) {
      setError('Please select a photo to upload');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('client_code', clientCode.trim());
    formData.append('photo', selectedFile);

    try {
      const response = await axios.post(`${API_URL}/user/upload-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setResult({
          agentInfo: response.data.agent_info,
          certificateFile: response.data.certificate_file
        });
        setStep(4); // Move to result step
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to generate certificate. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = () => {
    if (result?.certificateFile) {
      window.open(`${API_URL}/user/download/${result.certificateFile}`, '_blank');
    }
  };

  const openPreview = () => {
    if (result?.certificateFile) {
      setPreviewModal({
        url: `${API_URL}/user/preview/${result.certificateFile}`,
        name: result.agentInfo.name,
        tier: result.agentInfo.tier,
        filename: result.certificateFile
      });
    }
  };

  const handleNewCertificate = () => {
    setResult(null);
    setError(null);
    setClientCode('');
    setSelectedFile(null);
    setPreviewImage(null);
    setStep(1);
  };

  // Cleanup camera on unmount
  React.useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  if (!systemReady) {
    return (
      <div className="user-portal">
        <div className="system-not-ready">
          <AlertCircle size={64} className="warning-icon" />
          <h1>System Not Ready</h1>
          <p>The certificate generator is not available at the moment.</p>
          <p className="small-text">Please contact the administrator to set up the master assets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-portal">
      <div className="user-header">
        <Award size={48} className="header-icon" />
        <div>
          <h1>MDRT Certificate Generator</h1>
          <p>Follow the simple steps to generate your personalized certificate</p>
        </div>
      </div>

      {/* Step Indicator */}
      {step !== 4 && (
        <div className="step-indicator">
          <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">Enter ID</div>
          </div>
          <div className="step-line"></div>
          <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">Capture Photo</div>
          </div>
          <div className="step-line"></div>
          <div className={`step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">Verify & Generate</div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="step-section">
          <div className="step-card">
            <h2><User size={32} /> Step 1: Enter Your Client Code</h2>
            <p className="step-desc">Please enter your unique client identification code</p>

            <div className="input-group">
              <input
                type="text"
                placeholder="Enter Client Code (e.g., 00020880)"
                value={clientCode}
                onChange={(e) => setClientCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleNextStep()}
                className="client-code-input-large"
                autoFocus
              />
            </div>

            {error && (
              <div className="error-banner">
                <XCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            <button
              className="next-btn"
              onClick={handleNextStep}
              disabled={!clientCode.trim()}
            >
              Next: Upload Photo →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="step-section">
          <div className="step-card">
            <h2><Upload size={32} /> Step 2: Provide Your Photo</h2>
            <p className="step-desc">Client Code: <strong>{clientCode}</strong></p>

            {!showCamera ? (
              <>
                <div className="upload-options">
                  <button className="option-btn camera-btn" onClick={startCamera}>
                    <Camera size={48} />
                    <span>Capture with Camera</span>
                  </button>

                  <div className="divider-text">OR</div>

                  <label className="option-btn upload-btn-styled">
                    <Upload size={48} />
                    <span>Upload from Files</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                <button className="back-btn-text" onClick={handleBack}>
                  ← Back to Client Code
                </button>
              </>
            ) : (
              <div className="camera-section">
                <video ref={videoRef} autoPlay playsInline className="camera-feed"></video>
                <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

                <div className="camera-controls">
                  <button className="capture-btn" onClick={capturePhoto}>
                    <Camera size={24} />
                    Capture Photo
                  </button>
                  <button className="cancel-btn" onClick={stopCamera}>
                    <X size={24} />
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="step-section">
          <div className="step-card preview-card">
            <h2><CheckCircle size={32} /> Step 3: Verify Your Photo</h2>
            <p className="step-desc">Client Code: <strong>{clientCode}</strong></p>

            <div className="preview-container">
              <div className="preview-image-wrapper">
                <img src={previewImage} alt="Preview" className="preview-image" />
              </div>
            </div>

            {error && (
              <div className="error-banner">
                <XCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            <div className="preview-actions">
              <button className="back-btn" onClick={handleBack} disabled={uploading}>
                ← Back
              </button>
              <button
                className="generate-btn"
                onClick={handleFileUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <div className="spinner-small"></div>
                    Generating...
                  </>
                ) : (
                  'Generate Certificate →'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 4 && result && (
        <ResultView
          agentInfo={result.agentInfo}
          certificateFile={result.certificateFile}
          onDownload={handleDownload}
          onPreview={openPreview}
          onNewCertificate={handleNewCertificate}
        />
      )}

      {previewModal && (
        <ImagePreviewModal
          image={previewModal}
          onClose={() => setPreviewModal(null)}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}

function ResultView({ agentInfo, certificateFile, onDownload, onPreview, onNewCertificate }) {
  return (
    <div className="result-section">
      <div className="success-header">
        <CheckCircle size={64} className="success-icon" />
        <h2>Certificate Generated!</h2>
      </div>

      <div className="result-container">
        {/* Left side - Certificate Preview */}
        <div className="certificate-preview-panel">
          <h3>Your Certificate</h3>
          <div className="preview-image-container">
            <img
              src={`${API_URL}/user/preview/${certificateFile}`}
              alt="Generated Certificate"
              className="certificate-preview-image"
              onClick={onPreview}
              title="Click to view full size"
            />
          </div>
          <p className="preview-hint">Click image to view full size</p>
        </div>

        {/* Right side - Actions Only */}
        <div className="info-actions-panel">
          <div className="action-buttons">
            <button className="btn-primary" onClick={onPreview}>
              <Eye size={20} />
              View Full Size
            </button>
            <button className="btn-success" onClick={onDownload}>
              <Download size={20} />
              Download Certificate
            </button>
            <button className="btn-secondary" onClick={onNewCertificate}>
              <Upload size={20} />
              Generate Another
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserPortal;
