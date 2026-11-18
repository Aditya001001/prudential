import React, { useState, useEffect } from 'react';
import axios, { API_URL, errorMessage } from '../api';
import { Check, Download, Eye, LogOut, Pencil, RefreshCw, SlidersHorizontal, SwitchCamera } from 'lucide-react';
import Loader from '../components/Loader';
import PortraitEditor from '../components/PortraitEditor';
import PosterPreview from '../components/PosterPreview';
import useDialog from '../components/useDialog';
import './UserPortalNew.css';


function UserPortalNew() {
  const [systemReady, setSystemReady] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [editingPortrait, setEditingPortrait] = useState(false);
  const [posterReady, setPosterReady] = useState(false);
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
  const fileInputRef = React.useRef(null);
  const pendingPhotoRef = React.useRef(null);
  const photoRequestRef = React.useRef(0);
  const cameraRequestRef = React.useRef(0);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [resolutionWarning, setResolutionWarning] = useState(null);

  // Real-time validation states
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const validationTimeoutRef = React.useRef(null);
  const validationRequestRef = React.useRef(null);
  const currentCodeRef = React.useRef('');

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
      validationRequestRef.current = new AbortController();
      const response = await axios.get(`${API_URL}/validate-client-code/${encodeURIComponent(code.trim())}`, { signal: validationRequestRef.current.signal });
      if (currentCodeRef.current === code) setValidationResult({
        ...response.data,
        message: response.data.exists ? '已找到理財顧問編號。' : `找不到理財顧問編號「${code.trim()}」，請檢查後重試。`
      });
    } catch (error) {
      if (error.code === 'ERR_CANCELED' || currentCodeRef.current !== code) return;
      setValidationResult({
        success: false,
        exists: false,
        message: "驗證理財顧問編號時發生錯誤。"
      });
    } finally {
      if (currentCodeRef.current === code) setValidating(false);
    }
  };

  // Handle client code input change with debounced validation
  const handleClientCodeChange = (e) => {
    const value = e.target.value;
    currentCodeRef.current = value;
    validationRequestRef.current?.abort();
    setValidationResult(null);
    setValidating(Boolean(value.trim()));
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

  const discardPendingPhoto = () => {
    photoRequestRef.current += 1;
    const pending = pendingPhotoRef.current;
    if (pending) {
      pending.image.onload = null;
      pending.image.onerror = null;
      URL.revokeObjectURL(pending.url);
      pending.image.src = '';
      pendingPhotoRef.current = null;
    }
  };

  // Reuse the file itself for previews, avoiding large duplicate base64 strings on phones.
  useEffect(() => () => {
    if (previewImage) URL.revokeObjectURL(previewImage);
  }, [previewImage]);

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // Allow the same file to be selected again after a decode error.
    event.target.value = '';
    discardPendingPhoto();
    setReadingPhoto(false);
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 50 * 1024 * 1024) {
      setError('請選擇小於 50 MB 的 PNG 或 JPEG 圖片。');
      return;
    }
    setError(null);
    setResolutionWarning(null);
    setReadingPhoto(true);
    const request = photoRequestRef.current;
    let url;
    try {
      url = URL.createObjectURL(file);
      const image = new Image();
      image.decoding = 'async';
      pendingPhotoRef.current = { image, url };
      image.onload = () => {
        if (request !== photoRequestRef.current) return;
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        if (!width || !height) { image.onerror(); return; }
        pendingPhotoRef.current = null;
        setReadingPhoto(false);
        setSelectedFile(file);
        setPreviewImage(url);
        const megapixels = (width * height) / 1_000_000;
        const MIN_WIDTH = 1000;
        const MIN_HEIGHT = 1500;
        const IDEAL_WIDTH = 1200;
        const IDEAL_HEIGHT = 1800;
        if (width < MIN_WIDTH || height < MIN_HEIGHT) {
          setResolutionWarning({
            level: 'error',
            message: `解像度偏低：${width} × ${height} 像素（${megapixels.toFixed(2)} 百萬像素）。為獲得最佳效果，請上傳至少 ${MIN_WIDTH} × ${MIN_HEIGHT} 像素（150 萬像素）的照片；否則照片可能顯得模糊。`
          });
        } else if (width < IDEAL_WIDTH || height < IDEAL_HEIGHT) {
          setResolutionWarning({
            level: 'warning',
            message: `解像度良好：${width} × ${height} 像素（${megapixels.toFixed(2)} 百萬像素）。為獲得更佳效果，建議上傳 ${IDEAL_WIDTH} × ${IDEAL_HEIGHT} 像素或以上的照片。`
          });
        } else {
          setResolutionWarning({
            level: 'success',
            message: `解像度極佳：${width} × ${height} 像素（${megapixels.toFixed(2)} 百萬像素）。照片適合用於製作海報。`
          });
        }
        setStep(3);
      };
      image.onerror = () => {
        if (request !== photoRequestRef.current) return;
        pendingPhotoRef.current = null;
        URL.revokeObjectURL(url);
        setReadingPhoto(false);
        setSelectedFile(null);
        setError('無法讀取此圖片，請選擇 PNG 或 JPEG 圖片。');
      };
      image.src = url;
    } catch {
      if (url) URL.revokeObjectURL(url);
      pendingPhotoRef.current = null;
      setReadingPhoto(false);
      setError('無法讀取此檔案，請重試。');
    }
  };

  const releaseCamera = () => {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (canvasRef.current) { canvasRef.current.width = 0; canvasRef.current.height = 0; }
  };

  const stopCamera = () => {
    releaseCamera();
    setCameraStream(null);
    setCameraReady(false);
    setCapturingPhoto(false);
    setCameraError(null);
    setShowCamera(false);
  };

  const startCamera = async (mode = facingMode) => {
    releaseCamera();
    const request = cameraRequestRef.current;
    setCameraStream(null);
    setCameraReady(false);
    setCapturingPhoto(false);
    setCameraError(null);
    setError(null);
    setShowCamera(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      // A permission prompt or camera switch may finish after cancellation or unmount.
      if (request !== cameraRequestRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      setFacingMode(mode);
      setCameraStream(stream);
    } catch {
      if (request !== cameraRequestRef.current) return;
      setShowCamera(false);
      setError('無法開啟相機，請確認已授予相機權限，並使用安全連線。');
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!showCamera || !cameraStream || !video) return;
    let active = true;
    video.srcObject = cameraStream;
    const playing = video.play();
    playing?.catch(() => {
      if (active) {
        setCameraReady(false);
        setCameraError('相機畫面無法播放，請關閉後重試。');
      }
    });
    return () => { active = false; if (video.srcObject === cameraStream) video.srcObject = null; };
  }, [showCamera, cameraStream]);

  const handleCameraReady = () => {
    const video = videoRef.current;
    setCameraReady(Boolean(video && video.readyState >= 2 && video.videoWidth && video.videoHeight));
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!cameraReady || capturingPhoto || !video?.videoWidth || !video.videoHeight || !canvas) return;
    const request = cameraRequestRef.current;
    setCapturingPhoto(true);
    setCameraError(null);
    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      if (facingMode === 'user') {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      context.setTransform(1, 0, 0, 1, 0, 0);
      canvas.toBlob(blob => {
        if (request !== cameraRequestRef.current) return;
        canvas.width = 0;
        canvas.height = 0;
        if (!blob) {
          setCapturingPhoto(false);
          setCameraError('未能拍攝照片，請重試。');
          return;
        }
        try {
          const file = new File([blob], 'captured-photo.jpg', { type: 'image/jpeg' });
          const preview = URL.createObjectURL(file);
          setSelectedFile(file);
          setResolutionWarning(null);
          setPreviewImage(preview);
          stopCamera();
          setStep(3);
        } catch {
          setCapturingPhoto(false);
          setCameraError('未能拍攝照片，請重試。');
        }
      }, 'image/jpeg', .92);
    } catch {
      setCapturingPhoto(false);
      setCameraError('未能拍攝照片，請重試。');
    }
  };

  const flipCamera = () => startCamera(facingMode === 'user' ? 'environment' : 'user');
  const cameraDialogRef = useDialog(stopCamera, showCamera);

  const handleBack = () => {
    discardPendingPhoto();
    setReadingPhoto(false);
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
      setError("系統尚未準備就緒，請聯絡管理員。");
      return;
    }

    if (!clientCode.trim()) {
      setError("請輸入閣下理財顧問編號。");
      return;
    }

    if (!selectedFile) {
      setError("請選擇要上傳的照片。");
      return;
    }

    setPosterReady(false);
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
          certificateId: response.data.certificate?.id,
          editable: response.data.certificate?.editable,
          timestamp: Date.now() // Add timestamp to bust cache
        });
        setSelectedFile(null);
        setPreviewImage(null);
        setStep(4); // Release the original preview once the generated poster is available.
      }
    } catch (error) {
      setError(errorMessage(error, "無法產生海報，請重試。"));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = () => {
    if (posterReady && result?.certificateFile) {
      window.open(`${API_URL}/user/download/${result.certificateFile}`, '_blank');
    }
  };

  const handleNewCertificate = () => {
    discardPendingPhoto();
    setReadingPhoto(false);
    setEditingPortrait(false);
    setPosterReady(false);
    setResult(null);
    setError(null);
    currentCodeRef.current = '';
    validationRequestRef.current?.abort();
    clearTimeout(validationTimeoutRef.current);
    setClientCode('');
    setSelectedFile(null);
    setPreviewImage(null);
    setValidationResult(null);
    setStep(1);
  };

  // Cleanup camera on unmount
  React.useEffect(() => {
    return () => {
      releaseCamera();
      discardPendingPhoto();
      clearTimeout(validationTimeoutRef.current);
      validationRequestRef.current?.abort();
    };
  }, []);

  if (systemReady === null) return <div className="portal-wrapper" role="status">正在檢查系統狀態…</div>;

  if (!systemReady) {
    return (
      <div className="portal-wrapper">
      {error && <div className="request-error" role="alert">{error}</div>}
        <div className="step-card">
          <div className="system-error">
            <h2>系統尚未準備就緒</h2>
            <p>海報產生器暫時無法使用。</p>
            <p className="error-hint">請聯絡管理員。</p>
            <button onClick={() => { setSystemReady(null); checkSystemStatus(); }}>重試</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-wrapper">
      {error && <div className="request-error" role="alert">{error}</div>}
      {uploading && <Loader message="正在產生海報" estimatedTime={15} />}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Step 1: Enter Client Code */}
      {step === 1 && (
        <div className="step-card">
          <div className="card-header">
            <img src={`${process.env.PUBLIC_URL}/PRU_logo_black.png`} alt="保誠" className="logo" />
          </div>

          <h1 className="card-title">MDRT 海報生成平台</h1>

          <div className="steps-indicator">
            <div className="step-item active">
              <div className="step-number">1</div>
              <div className="step-label">輸入理財顧問編號</div>
            </div>
            <div className="step-item">
              <div className="step-number">2</div>
              <div className="step-label">提供照片</div>
            </div>
            <div className="step-item">
              <div className="step-number">3</div>
              <div className="step-label">確認照片</div>
            </div>
          </div>

          <div className="form-section">
            <label className="form-label" htmlFor="client-code">輸入閣下理財顧問編號</label>

            <input
              type="text"
              id="client-code"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              className={`input-field ${validationResult ? (validationResult.exists ? 'valid' : 'invalid') : ''}`}
              placeholder="例如：12345678"
              value={clientCode}
              onChange={handleClientCodeChange}
              maxLength={20}
            />

            {validating && <p className="validation-text">正在驗證…</p>}
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
            下一步：上傳照片 →
          </button>

        </div>
      )}

      {/* Step 2: Upload/Capture Photo */}
      {step === 2 && (
        <div className="step-card">
          <div className="card-header">
            <img src={`${process.env.PUBLIC_URL}/PRU_logo_black.png`} alt="保誠" className="logo" />
          </div>

          <h1 className="card-title">MDRT 海報生成平台</h1>

          <div className="steps-indicator">
            <div className="step-item completed">
              <div className="step-number"><Check size={16} /></div>
              <div className="step-label">輸入理財顧問編號</div>
            </div>
            <div className="step-item active">
              <div className="step-number">2</div>
              <div className="step-label">提供照片</div>
            </div>
            <div className="step-item">
              <div className="step-number">3</div>
              <div className="step-label">確認照片</div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-header-row">
              <label className="form-label">提供照片</label>
              <p className="form-hint">理財顧問編號： <span className="client-code-highlight">{clientCode}</span></p>
            </div>

            <div className="upload-options">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg"
                  onChange={handleFileSelect}
                  id="file-upload"
                  aria-describedby="photo-upload-guidance photo-upload-requirements"
                  style={{ display: 'none' }}
                />

                <button type="button" className="upload-box" disabled={readingPhoto} onClick={() => startCamera()}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span className="upload-text">使用相機拍照</span>
                </button>

                <div className="divider">或</div>

                <div className="device-upload">
                  <button type="button" className="upload-box" disabled={readingPhoto} aria-describedby="photo-upload-guidance photo-upload-requirements" onClick={() => fileInputRef.current?.click()}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                    <span className="upload-text">從裝置上傳</span>
                  </button>
                  <div className="photo-upload-help">
                    <p id="photo-upload-guidance">請上載清晰半身職業照，面部清楚可見。</p>
                    <ul id="photo-upload-requirements">
                      <li><strong>檔案格式：</strong> JPG／JPEG 或 PNG</li>
                      <li><strong>檔案大小：</strong> 少於 50 MB</li>
                      <li><strong>最低建議解像度：</strong> 1,000 × 1,500 像素</li>
                      <li><strong>最高解像度：</strong> 2,500 萬像素</li>
                    </ul>
                  </div>
                </div>
                {readingPhoto && <p className="photo-read-status" role="status">正在讀取照片…</p>}
            </div>
          </div>

          <div className="button-group">
            <button className="btn-secondary" onClick={handleBack}>返回</button>
            <button className="btn-primary" disabled>下一步 →</button>
          </div>
        </div>
      )}

      {/* Step 3: Verify Photo */}
      {step === 3 && (
        <div className="step-card">
          <div className="card-header">
            <img src={`${process.env.PUBLIC_URL}/PRU_logo_black.png`} alt="保誠" className="logo" />
          </div>

          <h1 className="card-title">MDRT 海報生成平台</h1>

          <div className="steps-indicator">
            <div className="step-item completed">
              <div className="step-number"><Check size={16} /></div>
              <div className="step-label">輸入理財顧問編號</div>
            </div>
            <div className="step-item completed">
              <div className="step-number"><Check size={16} /></div>
              <div className="step-label">提供照片</div>
            </div>
            <div className="step-item active">
              <div className="step-number">3</div>
              <div className="step-label">確認照片</div>
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">確認照片</label>
            <p className="form-hint">理財顧問編號： <span className="client-code-highlight">{clientCode}</span></p>

            {resolutionWarning && (
              <div className={`resolution-warning ${resolutionWarning.level}`}>
                {resolutionWarning.message}
              </div>
            )}

            <div className="photo-preview">
              <img src={previewImage} alt="您的肖像照" />
            </div>
          </div>

          <div className="button-group">
            <button className="btn-secondary" onClick={handleBack}>返回</button>
            <button
              className="btn-primary"
              onClick={handleFileUpload}
              disabled={uploading}
            >
              {uploading ? "正在產生…" : "下一步 →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Certificate Generated */}
      {step === 4 && result && (
        <div className="step-card result-card">
          <div className="card-header">
            <img src={`${process.env.PUBLIC_URL}/PRU_logo_black.png`} alt="保誠" className="logo" />
          </div>

          <h2 className="success-title">
            <div className="success-icon">
              <Check size={16} color="#10b981" />
            </div>
            海報已產生
          </h2>

          <PosterPreview key={result.certificateFile}
            src={`${API_URL}/user/preview/${result.certificateFile}?t=${result.timestamp}`}
            updated={Boolean(result.edited)} onReady={setPosterReady}
            onView={() => window.open(`${API_URL}/user/preview/${result.certificateFile}?t=${result.timestamp}`, '_blank')} />

          <div className="result-actions">
            {result.certificateId && result.editable && (
              <button className="btn-action btn-adjust-portrait" title="調整肖像照" onClick={() => setEditingPortrait(true)}>
                <SlidersHorizontal className="result-desktop" size={16} aria-hidden="true" />
                <Pencil className="result-mobile" size={22} aria-hidden="true" />
                <span className="result-desktop">調整肖像照</span>
                <span className="result-mobile">編輯</span>
              </button>
            )}
            <button className="btn-action btn-download" title="下載海報" onClick={handleDownload} disabled={!posterReady}>
              <Download size={16} aria-hidden="true" />
              <span className="result-desktop">下載</span>
              <span className="result-mobile">儲存</span>
            </button>
            <button className="btn-action btn-view" title="查看原圖" disabled={!posterReady} onClick={() => window.open(`${API_URL}/user/preview/${result.certificateFile}?t=${result.timestamp}`, '_blank')}>
              <Eye size={16} aria-hidden="true" />
              <span className="result-desktop">查看原圖</span>
              <span className="result-mobile">查看</span>
            </button>
            <button className="btn-action btn-new" title="返回首頁" onClick={handleNewCertificate}>
              <RefreshCw className="result-desktop" size={16} aria-hidden="true" />
              <LogOut className="result-mobile" size={22} aria-hidden="true" />
              <span className="result-desktop">再產生一張</span>
              <span className="result-mobile">離開</span>
            </button>
          </div>
        </div>
      )}

      {editingPortrait && result?.certificateId && (
        <PortraitEditor certificateId={result.certificateId} onClose={() => setEditingPortrait(false)} onSaved={data => {
          setPosterReady(false);
          setResult(current => ({ ...current, certificateFile: data.certificate_file, timestamp: Date.now(), edited: true }));
          setEditingPortrait(false);
        }} />
      )}

      {/* Fullscreen Camera Modal */}
      {showCamera && (
        <div className="camera-modal-overlay">
          <div className="camera-modal" ref={cameraDialogRef} role="dialog" aria-modal="true" aria-label="使用相機拍照" tabIndex={-1}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={handleCameraReady}
              onLoadedData={handleCameraReady}
              onCanPlay={handleCameraReady}
              className={`camera-modal-video ${facingMode === 'user' ? 'mirrored' : ''}`}
            />
            {cameraError
              ? <p className="camera-modal-status" role="alert">{cameraError}</p>
              : !cameraReady && <p className="camera-modal-status" role="status">正在開啟相機…</p>}
            <div className="camera-modal-controls">
              <button className="camera-modal-btn cancel" onClick={stopCamera}>
                取消
              </button>
              <button className="camera-modal-btn flip" onClick={flipCamera} disabled={!cameraReady || capturingPhoto} title="切換相機" aria-label="切換相機">
                <SwitchCamera size={24} />
              </button>
              <button className="camera-modal-btn capture" aria-label="拍照" disabled={!cameraReady || capturingPhoto} onClick={capturePhoto}>
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
