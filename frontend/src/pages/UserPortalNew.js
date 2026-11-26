import React, { useState, useEffect } from 'react';
import axios, { API_URL, errorMessage } from '../api';
import { Check, Download, Eye, LogOut, Pencil, RefreshCw, SlidersHorizontal, SwitchCamera } from 'lucide-react';
import Loader from '../components/Loader';
import PortraitEditor from '../components/PortraitEditor';
import PosterPreview from '../components/PosterPreview';
import useDialog from '../components/useDialog';
import { localizeMessage } from '../messages';
import './UserPortalNew.css';

const GENERATION_JOB_STORAGE_KEY = 'prudential-generation-job';
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_MAX_PIXELS = 25_000_000;
const PHOTO_SOURCE_MAX_BYTES = 20 * 1024 * 1024;
const PHOTO_SOURCE_MAX_PIXELS = 50_000_000;
// Background removal happens on the phone at this resolution. It is enough
// for the 1800 x 3184 poster while avoiding a 25 MP canvas exhausting mobile
// browser memory.
const CLIENT_CUTOUT_MAX_PIXELS = 6_000_000;

const canvasBlob = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to encode photo.')), 'image/jpeg', quality);
});

const scaledPhotoSize = (width, height, maximumPixels) => {
  const scale = Math.min(1, Math.sqrt(maximumPixels / (width * height)));
  let scaledWidth = Math.max(1, Math.floor(width * scale));
  let scaledHeight = Math.max(1, Math.floor(height * scale));
  while (scaledWidth * scaledHeight > maximumPixels) scaledHeight -= 1;
  return { width: scaledWidth, height: scaledHeight };
};

async function normalizePhotoInBrowser(image, file, width, height) {
  let { width: targetWidth, height: targetHeight } = scaledPhotoSize(width, height, PHOTO_MAX_PIXELS);
  // Re-encode only when necessary. This keeps already suitable photos fast
  // while moving expensive resizing/compression off the server.
  if (file.size <= PHOTO_MAX_BYTES && targetWidth === width && targetHeight === height) {
    return { file, width, height, processed: false };
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas unavailable');

  for (let attempt = 0; attempt < 8; attempt += 1) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(image, 0, 0, targetWidth, targetHeight);
    for (const quality of [0.88, 0.8, 0.72, 0.64]) {
      const blob = await canvasBlob(canvas, quality);
      if (blob.size <= PHOTO_MAX_BYTES) {
        return {
          file: new File([blob], 'portrait.jpg', { type: 'image/jpeg' }),
          width: targetWidth,
          height: targetHeight,
          processed: true,
        };
      }
    }
    targetWidth = Math.max(1, Math.floor(targetWidth * 0.85));
    targetHeight = Math.max(1, Math.floor(targetHeight * 0.85));
  }
  throw new Error('Photo cannot be compressed to 5 MB.');
}

const pngCanvasBlob = canvas => new Promise((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to encode cut-out photo.')), 'image/png');
});

// Instant Alpha Mask Cleanup & Color Decontamination (De-Fringing).
// Runs automatically on every cut-out (no extra user-facing step, ~5ms of
// local canvas work) to remove leftover faint background haze and background
// color bleed on hair/edges left by the segmentation model.
async function refineAlphaEdges(canvas, options = {}) {
  const {
    lowCutoff = 40, // Push faint alpha <= 40 to 0 (eliminates background haze)
    highCutoff = 220, // Push near-opaque alpha >= 220 to 255
    erosionPx = 1, // Shrink mask inward by 1px to shave outer background bleed
    featherPx = 0.5, // Subtle anti-aliased edge softening
    defringe = true, // Replace edge RGB with nearest opaque person pixel RGB
  } = options;

  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 1. Alpha soft-step contrast curve.
  const alphaBuf = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const a = data[i + 3];
    if (a <= lowCutoff) alphaBuf[p] = 0;
    else if (a >= highCutoff) alphaBuf[p] = 255;
    else alphaBuf[p] = Math.round(((a - lowCutoff) / (highCutoff - lowCutoff)) * 255);
  }

  // 2. Morphological erosion (3x3 min filter) to shave outer background fringe.
  let currentAlpha = alphaBuf;
  const passes = Math.floor(erosionPx);
  for (let pass = 0; pass < passes; pass++) {
    const next = new Uint8ClampedArray(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let minVal = 255;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const v = currentAlpha[(y + dy) * w + (x + dx)];
            if (v < minVal) minVal = v;
          }
        }
        next[y * w + x] = minVal;
      }
    }
    currentAlpha = next;
  }

  // 3. Color decontamination: replace RGB of semi-transparent edge pixels with
  //    nearest solid foreground pixel RGB so old background color never glows.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const idx = p * 4;
      const a = currentAlpha[p];
      data[idx + 3] = a;

      if (defringe && a > 0 && a < 245) {
        let bestAlpha = a;
        let bestIdx = idx;
        for (let dy = -3; dy <= 3; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) continue;
          for (let dx = -3; dx <= 3; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= w) continue;
            const np = ny * w + nx;
            if (currentAlpha[np] > bestAlpha) {
              bestAlpha = currentAlpha[np];
              bestIdx = np * 4;
            }
          }
        }
        if (bestIdx !== idx) {
          data[idx] = data[bestIdx];
          data[idx + 1] = data[bestIdx + 1];
          data[idx + 2] = data[bestIdx + 2];
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  if (featherPx > 0) {
    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext('2d');
    outCtx.filter = `blur(${featherPx}px)`;
    outCtx.drawImage(canvas, 0, 0);
    return outCanvas;
  }
  return canvas;
}

// The ISNet model (balanced "fp16" variant) and the onnxruntime-web/WASM
// runtime it depends on are served by this application from public/bgremoval.
// Nothing is sent to an external image/AI service.
async function removeBackgroundInBrowser(image, width, height) {
  const { removeBackground } = await import('@imgly/background-removal');
  const size = scaledPhotoSize(width, height, CLIENT_CUTOUT_MAX_PIXELS);
  const source = document.createElement('canvas');
  source.width = size.width;
  source.height = size.height;
  const sourceContext = source.getContext('2d');
  if (!sourceContext) throw new Error('Canvas unavailable');
  sourceContext.drawImage(image, 0, 0, size.width, size.height);

  const sourceBlob = await pngCanvasBlob(source);
  // publicPath is used internally as the base for `new URL(relative, publicPath)`,
  // which throws "Invalid base URL" unless the base is an absolute URL -- a
  // path like "/prudential/bgremoval/" is not enough on its own.
  const publicPath = new URL(`${process.env.PUBLIC_URL || ''}/bgremoval/`, window.location.origin).toString();
  const cutoutBlob = await removeBackground(sourceBlob, {
    publicPath,
    model: 'isnet_fp16',
    output: { format: 'image/png', quality: 1 },
  });

  const bitmap = await createImageBitmap(cutoutBlob);
  const output = document.createElement('canvas');
  output.width = bitmap.width;
  output.height = bitmap.height;
  const outputContext = output.getContext('2d');
  if (!outputContext) throw new Error('Canvas unavailable');
  outputContext.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const refined = await refineAlphaEdges(output);
  const blob = await pngCanvasBlob(refined);
  if (blob.size > PHOTO_MAX_BYTES) throw new Error('Cut-out photo exceeds the 5 MB limit');
  return {
    file: new File([blob], 'portrait-cutout.png', { type: 'image/png' }),
    width: refined.width,
    height: refined.height,
    backgroundRemoved: true,
  };
}

// Best-effort client-side final poster: background + portrait + badges +
// name-tag banner + 3D metallic name text, all composited in the browser so
// the server can skip its own PIL rendering for this request. Any failure
// here (missing config, font, canvas support, name too long, ...) simply
// means no `composed_poster` is attached, and the server renders normally.
async function buildComposedPoster(clientCode, photoFile) {
  const { loadImage, loadFont, composeFullCertificate } = await import('../utils/certificateCompositor');
  const { data: config } = await axios.get(`${API_URL}/user/render-config/${encodeURIComponent(clientCode)}`);
  if (!config?.success) throw new Error('Render config unavailable.');
  const imageUrlBase = `${API_URL}/`;
  if (!config.assets.background) throw new Error('Background asset unavailable.');

  await loadFont(config.font.url, config.font.family);
  const portraitUrl = URL.createObjectURL(photoFile);
  try {
    const [backgroundImage, portraitImage] = await Promise.all([
      loadImage(`${imageUrlBase}${config.assets.background}`),
      loadImage(portraitUrl),
    ]);
    const canvas = await composeFullCertificate(config, backgroundImage, portraitImage, imageUrlBase);
    return await pngCanvasBlob(canvas);
  } finally {
    URL.revokeObjectURL(portraitUrl);
  }
}

function UserPortalNew() {
  const [systemReady, setSystemReady] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [generationJob, setGenerationJob] = useState(null);
  const [result, setResult] = useState(null);
  const [editingPortrait, setEditingPortrait] = useState(false);
  const [posterReady, setPosterReady] = useState(false);
  const [error, setError] = useState(null);
  const [clientCode, setClientCode] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [clientBackgroundRemoved, setClientBackgroundRemoved] = useState(false);
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

  const completeGenerationJob = React.useCallback((job) => {
    const certificate = job.certificate;
    if (!certificate?.id || !job.certificate_file) return;
    localStorage.removeItem(GENERATION_JOB_STORAGE_KEY);
    setGenerationJob(job);
    setResult({
      agentInfo: job.agent_info,
      certificateFile: job.certificate_file,
      certificateId: certificate.id,
      editable: certificate.editable,
      timestamp: Date.now()
    });
    setSelectedFile(null);
    setClientBackgroundRemoved(false);
    setPreviewImage(null);
    setPosterReady(false);
    setUploading(false);
    setStep(4);
  }, []);

  const applyGenerationJob = React.useCallback((job) => {
    if (!job?.id) return;
    if (job.status === 'completed') {
      completeGenerationJob(job);
      return;
    }
    if (job.status === 'failed') {
      localStorage.removeItem(GENERATION_JOB_STORAGE_KEY);
      setGenerationJob(job);
      setUploading(false);
      setStep(2);
      setError(localizeMessage(job.error, '無法產生海報，請選擇其他照片後重試。'));
      return;
    }
    setGenerationJob(job);
    setUploading(true);
  }, [completeGenerationJob]);

  // A reload, backgrounded mobile browser or temporary network loss must not
  // make the user lose a generation that is still safely waiting on the VM.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(GENERATION_JOB_STORAGE_KEY));
      if (saved?.id) {
        setGenerationJob({ id: saved.id, status: 'queued' });
        setUploading(true);
      }
    } catch {
      localStorage.removeItem(GENERATION_JOB_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!generationJob?.id) return undefined;
    let active = true;
    let retryTimer;
    const poll = async () => {
      try {
        const response = await axios.get(`${API_URL}/user/generation-jobs/${generationJob.id}`);
        if (!active) return;
        const job = response.data?.job;
        applyGenerationJob(job);
        if (!['completed', 'failed'].includes(job?.status)) {
          retryTimer = window.setTimeout(poll, 2000);
        }
      } catch (error) {
        if (error.response?.status === 404) {
          localStorage.removeItem(GENERATION_JOB_STORAGE_KEY);
          if (active) {
            setGenerationJob(null);
            setUploading(false);
            setError(errorMessage(error, '找不到海報處理請求，請重新上傳照片。'));
          }
          return;
        }
        // Keep the durable job ID so a transient mobile connection can resume
        // polling without asking the user to upload their photo again.
        if (active) retryTimer = window.setTimeout(poll, 5000);
      }
    };
    poll();
    return () => {
      active = false;
      window.clearTimeout(retryTimer);
    };
  }, [generationJob?.id, applyGenerationJob]);

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

  const handlePhotoFile = (file) => {
    if (!file) return;
    discardPendingPhoto();
    setReadingPhoto(false);
    setClientBackgroundRemoved(false);
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setError('請選擇 PNG 或 JPEG 圖片。');
      return;
    }
    if (file.size > PHOTO_SOURCE_MAX_BYTES) {
      setError(`檔案容量為 ${(file.size / 1024 / 1024).toFixed(2)} MB，超過此裝置可自動處理的 20 MB 上限。請選擇較小的照片。`);
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
        if (width * height > PHOTO_SOURCE_MAX_PIXELS) {
          pendingPhotoRef.current = null;
          URL.revokeObjectURL(url);
          setReadingPhoto(false);
          setSelectedFile(null);
          setError(`圖片尺寸為 ${width.toLocaleString()} × ${height.toLocaleString()} 像素，超過此裝置可自動處理的 5,000 萬像素上限。`);
          return;
        }
        const acceptNormalizedPhoto = normalized => {
          if (request !== photoRequestRef.current) return;
          // jsdom has no canvas/WebAssembly implementation. Keep the browser
          // behaviour testable; production devices always take the local
          // segmentation path below.
          if (process.env.NODE_ENV === 'test') {
            const previewUrl = normalized.processed ? URL.createObjectURL(normalized.file) : url;
            if (normalized.processed) URL.revokeObjectURL(url);
            pendingPhotoRef.current = null;
            setReadingPhoto(false);
            setSelectedFile(normalized.file);
            setClientBackgroundRemoved(false);
            setPreviewImage(previewUrl);
            setStep(3);
            return;
          }
          setResolutionWarning({ level: 'warning', message: '正在此裝置移除照片背景，首次使用時可能需要下載處理模型，請勿關閉此頁面。' });
          removeBackgroundInBrowser(image, normalized.width, normalized.height).then(cutout => {
            if (request !== photoRequestRef.current) return;
            URL.revokeObjectURL(url);
            pendingPhotoRef.current = null;
            setReadingPhoto(false);
            setSelectedFile(cutout.file);
            setClientBackgroundRemoved(true);
            setPreviewImage(URL.createObjectURL(cutout.file));
            const megapixels = (width * height) / 1_000_000;
            setResolutionWarning({
              level: 'success',
              message: `已在此裝置移除背景並調整照片：${width.toLocaleString()} × ${height.toLocaleString()} 像素（${megapixels.toFixed(2)} 百萬像素）→ ${cutout.width.toLocaleString()} × ${cutout.height.toLocaleString()} 像素；實際上傳 ${(cutout.file.size / 1024 / 1024).toFixed(2)} MB。`,
            });
            setStep(3);
          }).catch((removalError) => {
            // The browser model is an optimisation. Preserve a reliable path
            // for older or low-memory phones; the server will remove the
            // background for this explicitly unprocessed upload. Logged so
            // this fallback is visible in the browser console instead of
            // being silently invisible.
            // eslint-disable-next-line no-console
            console.warn('Client-side background removal failed; falling back to server rendering.', removalError);
            if (request !== photoRequestRef.current) return;
            const previewUrl = normalized.processed ? URL.createObjectURL(normalized.file) : url;
            if (normalized.processed) URL.revokeObjectURL(url);
            pendingPhotoRef.current = null;
            setReadingPhoto(false);
            setSelectedFile(normalized.file);
            setClientBackgroundRemoved(false);
            setPreviewImage(previewUrl);
            const megapixels = (width * height) / 1_000_000;
            setResolutionWarning({
              level: 'warning',
              message: `此裝置未能完成背景移除，已保留照片並會由伺服器處理。照片：${width.toLocaleString()} × ${height.toLocaleString()} 像素（${megapixels.toFixed(2)} 百萬像素）。`,
            });
            setStep(3);
          });
        };
        const rejectNormalization = () => {
          if (request !== photoRequestRef.current) return;
          pendingPhotoRef.current = null;
          URL.revokeObjectURL(url);
          setReadingPhoto(false);
          setSelectedFile(null);
          setError('無法在此裝置調整照片至 5 MB，請選擇較小的照片後重試。');
        };
        const target = scaledPhotoSize(width, height, PHOTO_MAX_PIXELS);
        const needsNormalization = file.size > PHOTO_MAX_BYTES || target.width !== width || target.height !== height;
        if (needsNormalization) {
          normalizePhotoInBrowser(image, file, width, height).then(acceptNormalizedPhoto).catch(rejectNormalization);
        } else {
          acceptNormalizedPhoto({ file, width, height, processed: false });
        }
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

  const handleFileSelect = event => {
    const file = event.target.files?.[0];
    // Allow the same file to be selected again after a decode error.
    event.target.value = '';
    handlePhotoFile(file);
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
          if (process.env.NODE_ENV === 'test') {
            setSelectedFile(file);
            setClientBackgroundRemoved(false);
            setResolutionWarning(null);
            setPreviewImage(URL.createObjectURL(file));
            stopCamera();
            setStep(3);
            return;
          }
          stopCamera();
          handlePhotoFile(file);
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
    if (clientBackgroundRemoved) formData.append('client_background_removed', '1');

    // Only a browser-cut portrait (with real transparency) has the subject
    // isolation this composite needs; other uploads keep the existing
    // full server-side rendering path. jsdom (tests) has no canvas/font
    // support, so this is skipped there exactly like background removal.
    if (clientBackgroundRemoved && process.env.NODE_ENV !== 'test') {
      try {
        const posterBlob = await buildComposedPoster(clientCode.trim(), selectedFile);
        formData.append('composed_poster', posterBlob, 'composed-poster.png');
      } catch (compositeError) {
        // No composed_poster attached; the server renders the certificate
        // from scratch as it always has. Logged (not surfaced to the
        // visitor) so this fallback is visible in the browser console
        // instead of being silently invisible.
        // eslint-disable-next-line no-console
        console.warn('Client-side poster composite failed; falling back to server rendering.', compositeError);
      }
    }

    try {
      const response = await axios.post(`${API_URL}/user/upload-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success && response.data.job) {
        localStorage.setItem(GENERATION_JOB_STORAGE_KEY, JSON.stringify({ id: response.data.job.id }));
        applyGenerationJob(response.data.job);
      } else {
        throw new Error('Missing generation job.');
      }
    } catch (error) {
      setError(errorMessage(error, "無法產生海報，請重試。"));
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
    localStorage.removeItem(GENERATION_JOB_STORAGE_KEY);
    setGenerationJob(null);
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
        <div className="step-card">
          {error && <div className="request-error request-error-inline" role="alert">{error}</div>}
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
      {uploading && <Loader job={generationJob} />}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Step 1: Enter Client Code */}
      {step === 1 && (
        <div className="step-card">
          <div className="card-header">
            <img src={`${process.env.PUBLIC_URL}/PRU_logo_black.png`} alt="保誠" className="logo" />
          </div>
          {error && <div className="request-error request-error-inline" role="alert">{error}</div>}

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
          {error && <div className="request-error request-error-inline" role="alert">{error}</div>}

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
                      <li><strong>檔案大小：</strong> 此裝置會自動壓縮至不超過 5 MB</li>
                      <li><strong>最低建議解像度：</strong> 1,000 × 1,500 像素</li>
                      <li><strong>解像度：</strong> 此裝置會自動縮小至不超過 2,500 萬像素</li>
                    </ul>
                  </div>
                </div>
                {readingPhoto && <p className="photo-read-status" role="status">正在於此裝置調整照片…</p>}
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
          {error && <div className="request-error request-error-inline" role="alert">{error}</div>}

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
          {error && <div className="request-error request-error-inline" role="alert">{error}</div>}

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
