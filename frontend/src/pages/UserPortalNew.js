import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Camera, Check, Download, Eye, RefreshCw, History, SwitchCamera } from 'lucide-react';
import Loader from '../components/Loader';
import './UserPortalNew.css';

const API_URL = '/prudential-api';

function UserPortalNew() {
  const navigate = useNavigate();
  const [systemReady, setSystemReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [clientCode, setClientCode] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [step, setStep] = useState(1); // 1: Enter ID, 2: Upload Photo, 3: Preview, 4: Result
  const [showCamera, setShowCamera] = useState(false);
  const [facingMode, setFacingMode] = useState('user'); // 'user' for front, 'environment' for back
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const [photoResolution, setPhotoResolution] = useState(null);
  const [resolutionWarning, setResolutionWarning] = useState(null);

  // Real-time validation states
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const validationTimeoutRef = React.useRef(null);

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

  // Real-time client code validation
  const validateClientCode = async (code) => {
    if (!code || code.trim().length === 0) {
      setValidationResult(null);
      return;
    }

    setValidating(true);
    try {
      const response = await axios.get(`${API_URL}/validate-client-code/${encodeURIComponent(code.trim())}`);
      setValidationResult(response.data);
    } catch (error) {
      console.error('Validation error:', error);
      setValidationResult({
        success: false,
        exists: false,
        message: 'Error validating client code'
      });
    } finally {
      setValidating(false);
    }
  };

  // Handle client code input change with debounced validation
  const handleClientCodeChange = (e) => {
    const value = e.target.value;
    setClientCode(value);
    setError(null);

    // Clear previous timeout
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    // Debounce validation (wait 500ms after user stops typing)
    validationTimeoutRef.current = setTimeout(() => {
      validateClientCode(value);
    }, 500);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const width = img.width;
          const height = img.height;
          const megapixels = (width * height) / 1_000_000;

          setPhotoResolution({ width, height, megapixels });

          // Check resolution quality
          const MIN_WIDTH = 1000;
          const MIN_HEIGHT = 1500;
          const IDEAL_WIDTH = 1200;
          const IDEAL_HEIGHT = 1800;

          if (width < MIN_WIDTH || height < MIN_HEIGHT) {
            setResolutionWarning({
              level: 'error',
              message: `⚠️ Low Resolution: ${width}×${height} (${megapixels.toFixed(2)} MP). For best quality, upload at least ${MIN_WIDTH}×${MIN_HEIGHT} pixels (1.5 MP). Photo may appear pixelated.`
            });
          } else if (width < IDEAL_WIDTH || height < IDEAL_HEIGHT) {
            setResolutionWarning({
              level: 'warning',
              message: `ℹ️ Good Resolution: ${width}×${height} (${megapixels.toFixed(2)} MP). For optimal quality, upload ${IDEAL_WIDTH}×${IDEAL_HEIGHT} pixels or higher.`
            });
          } else {
            setResolutionWarning({
              level: 'success',
              message: `✅ Excellent Resolution: ${width}×${height} (${megapixels.toFixed(2)} MP). Photo will look great!`
            });
          }
        };
        img.src = reader.result;
        setPreviewImage(reader.result);
        setStep(3); // Move to preview step
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async (mode = facingMode) => {
    setError(null);

    try {
      console.log('Requesting camera access with facing mode:', mode);

      // Stop existing stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      console.log('Camera stream obtained:', stream);
      streamRef.current = stream;

      // Show camera view first
      setShowCamera(true);

      // Wait a bit for React to render the video element
      setTimeout(() => {
        if (videoRef.current) {
          console.log('Setting video source...');
          videoRef.current.srcObject = stream;

          // Wait for video metadata to load and then play
          videoRef.current.onloadedmetadata = () => {
            console.log('Video metadata loaded, starting playback...');
            videoRef.current.play()
              .then(() => {
                console.log('Video playing successfully!');
              })
              .catch(err => {
                console.error('Error playing video:', err);
              });
          };
        } else {
          console.error('Video ref is null');
        }
      }, 100);

    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Failed to access camera. Please check your permissions and ensure you are using HTTPS.');
      setShowCamera(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Set canvas size to video size
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // For front camera: flip the canvas to un-mirror the mirrored preview
      // For back camera: draw as-is
      if (facingMode === 'user') {
        // Flip horizontally to correct the mirrored preview
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
      }

      // Draw the video frame
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Reset transform
      context.setTransform(1, 0, 0, 1, 0, 0);

      canvas.toBlob((blob) => {
        const file = new File([blob], 'captured-photo.jpg', { type: 'image/jpeg' });
        setSelectedFile(file);
        setPreviewImage(canvas.toDataURL());
        stopCamera();
        setStep(3);
      }, 'image/jpeg');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const flipCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    await startCamera(newMode);
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
          certificateFile: response.data.certificate_file,
          timestamp: Date.now() // Add timestamp to bust cache
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

  const handleNewCertificate = () => {
    setResult(null);
    setError(null);
    setClientCode('');
    setSelectedFile(null);
    setPreviewImage(null);
    setValidationResult(null);
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
      <div className="portal-wrapper">
        <div className="step-card">
          <div className="system-error">
            <h2>System Not Ready</h2>
            <p>The certificate generator is not available at the moment.</p>
            <p className="error-hint">Please contact the administrator.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-wrapper">
      {uploading && <Loader message="Generating your certificate" estimatedTime={15} />}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Step 1: Enter Client Code */}
      {step === 1 && (
        <div className="step-card">
          <div className="card-header">
            <img src="/prudential/PRU_logo_black.png" alt="Prudential" className="logo" />
          </div>

          <h1 className="card-title">Prudential Certificate Generator</h1>

          <div className="steps-indicator">
            <div className="step-item active">
              <div className="step-number">1</div>
              <div className="step-label">Enter Your Client Code</div>
            </div>
            <div className="step-item">
              <div className="step-number">2</div>
              <div className="step-label">Provide Your Photo</div>
            </div>
            <div className="step-item">
              <div className="step-number">3</div>
              <div className="step-label">Verify Photo</div>
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">Enter Your Client Code</label>
            <p className="form-hint">Please enter your unique client identification code</p>

            <input
              type="text"
              className={`input-field ${validationResult ? (validationResult.exists ? 'valid' : 'invalid') : ''}`}
              placeholder="Enter client code (e.g., 12345678)"
              value={clientCode}
              onChange={handleClientCodeChange}
              maxLength={20}
            />

            {validating && <p className="validation-text">Validating...</p>}
            {validationResult && !validating && (
              <p className={`validation-text ${validationResult.exists ? 'success' : 'error'}`}>
                {validationResult.message}
              </p>
            )}
          </div>

          <button
            className="btn-primary"
            onClick={() => {
              if (validationResult?.exists) {
                setStep(2);
              }
            }}
            disabled={!validationResult?.exists}
          >
            Next: Upload your Photo →
          </button>

        </div>
      )}

      {/* Step 2: Upload/Capture Photo */}
      {step === 2 && (
        <div className="step-card">
          <div className="card-header">
            <img src="/prudential/PRU_logo_black.png" alt="Prudential" className="logo" />
          </div>

          <h1 className="card-title">Prudential Certificate Generator</h1>

          <div className="steps-indicator">
            <div className="step-item completed">
              <div className="step-number"><Check size={16} /></div>
              <div className="step-label">Enter Your Client Code</div>
            </div>
            <div className="step-item active">
              <div className="step-number">2</div>
              <div className="step-label">Provide Your Photo</div>
            </div>
            <div className="step-item">
              <div className="step-number">3</div>
              <div className="step-label">Verify Photo</div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-header-row">
              <label className="form-label">Provide Your Photo</label>
              <p className="form-hint">Client code: <span className="client-code-highlight">{clientCode}</span></p>
            </div>

            {!showCamera && (
              <div className="upload-options">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  id="file-upload"
                  style={{ display: 'none' }}
                />

                <div className="upload-box" onClick={startCamera}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span className="upload-text">Capture with Camera</span>
                </div>

                <div className="divider">OR</div>

                <label htmlFor="file-upload" className="upload-box">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                  <span className="upload-text">Upload from Device</span>
                </label>
              </div>
            )}
          </div>

          <div className="button-group">
            <button className="btn-secondary" onClick={handleBack}>Back</button>
            <button className="btn-primary" disabled>Next →</button>
          </div>
        </div>
      )}

      {/* Step 3: Verify Photo */}
      {step === 3 && (
        <div className="step-card">
          <div className="card-header">
            <img src="/prudential/PRU_logo_black.png" alt="Prudential" className="logo" />
          </div>

          <h1 className="card-title">Prudential Certificate Generator</h1>

          <div className="steps-indicator">
            <div className="step-item completed">
              <div className="step-number"><Check size={16} /></div>
              <div className="step-label">Enter Your Client Code</div>
            </div>
            <div className="step-item completed">
              <div className="step-number"><Check size={16} /></div>
              <div className="step-label">Provide Your Photo</div>
            </div>
            <div className="step-item active">
              <div className="step-number">3</div>
              <div className="step-label">Verify Photo</div>
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">Verify Photo</label>
            <p className="form-hint">Client code: <span className="client-code-highlight">{clientCode}</span></p>

            {resolutionWarning && (
              <div className={`resolution-warning ${resolutionWarning.level}`}>
                {resolutionWarning.message}
              </div>
            )}

            <div className="photo-preview">
              <img src={previewImage} alt="Your photo" />
            </div>
          </div>

          <div className="button-group">
            <button className="btn-secondary" onClick={handleBack}>Back</button>
            <button
              className="btn-primary"
              onClick={handleFileUpload}
              disabled={uploading}
            >
              {uploading ? 'Generating...' : 'Next →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Certificate Generated */}
      {step === 4 && result && (
        <div className="step-card result-card">
          <div className="card-header">
            <img src="/prudential/PRU_logo_black.png" alt="Prudential" className="logo" />
          </div>

          <h2 className="success-title">
            <div className="success-icon">
              <Check size={16} color="#10b981" />
            </div>
            Certificate Generated
          </h2>

          <div className="certificate-preview" onClick={() => window.open(`${API_URL}/user/preview/${result.certificateFile}?t=${result.timestamp}`, '_blank')} title="Click to view full size">
            <img
              src={`${API_URL}/user/preview/${result.certificateFile}?t=${result.timestamp}`}
              alt="Certificate"
              className="cert-image"
            />
            <div className="preview-hint">
              <Eye size={16} />
              <span>Click to view full size</span>
            </div>
          </div>

          <div className="result-actions">
            <button className="btn-action btn-download" onClick={handleDownload}>
              <Download size={18} />
              Download
            </button>
            <button className="btn-action btn-view" onClick={() => window.open(`${API_URL}/user/preview/${result.certificateFile}?t=${result.timestamp}`, '_blank')}>
              <Eye size={18} />
              View Full Size
            </button>
            <button className="btn-action btn-new" onClick={handleNewCertificate}>
              <RefreshCw size={18} />
              Generate Another
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Camera Modal */}
      {showCamera && (
        <div className="camera-modal-overlay">
          <div className="camera-modal">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`camera-modal-video ${facingMode === 'user' ? 'mirrored' : ''}`}
            />
            <div className="camera-modal-controls">
              <button className="camera-modal-btn cancel" onClick={stopCamera}>
                Cancel
              </button>
              <button className="camera-modal-btn flip" onClick={flipCamera} title="Flip Camera">
                <SwitchCamera size={24} />
              </button>
              <button className="camera-modal-btn capture" onClick={capturePhoto}>
                <div className="capture-ring">
                  <div className="capture-inner"></div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserPortalNew;
