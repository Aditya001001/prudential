import React, { useEffect, useRef, useState, useId } from 'react';
import api, { API_URL, errorMessage } from '../api';
import { DEFAULT_PLACEMENT, constrainPlacement, pinchPlacement, portraitRectangle } from './portraitPlacement';
import './PortraitEditor.css';

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("無法載入肖像照圖層，請重試。"));
    image.src = `${API_URL}${url}`;
  });
}

export default function PortraitEditor({ certificateId, onClose, onSaved }) {
  const [editor, setEditor] = useState(null);
  const [images, setImages] = useState(null);
  const [placement, setPlacement] = useState(DEFAULT_PLACEMENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [fineOpen, setFineOpen] = useState(() => !window.matchMedia?.('(max-width: 640px), (max-width: 1000px) and (max-height: 520px)')?.matches);
  const canvasRef = useRef(null);
  const previewRef = useRef(null);
  const dialogRef = useRef(null);
  const placementRef = useRef(DEFAULT_PLACEMENT);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const drawRef = useRef(null);
  const titleId = useId();
  const helpId = useId();

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    pointersRef.current.clear();
    gestureRef.current = null;
    setLoading(true);
    setError(null);
    setEditor(null);
    setImages(null);
    api.get(`${API_URL}/user/certificates/${certificateId}/editor`, { signal: controller.signal })
      .then(async ({ data }) => {
        const [background, portrait, foreground] = await Promise.all(
          ['background', 'portrait', 'foreground'].map(name => loadImage(data.layers[name]))
        );
        if (active) {
          placementRef.current = data.transform;
          setEditor(data);
          setPlacement(data.transform);
          setImages({ background, portrait, foreground });
        }
      }).catch(error => {
        if (active && error.code !== 'ERR_CANCELED') setError(errorMessage(error, '無法載入肖像照圖層，請重試。'));
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [certificateId, attempt]);

  useEffect(() => {
    const focused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = previousOverflow; focused?.focus({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    if (loading || !editor || !images || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const background = document.createElement('canvas');
    const foreground = document.createElement('canvas');
    let frame = null;
    const paint = () => {
      frame = null;
      const factorX = canvas.width/editor.width;
      const factorY = canvas.height/editor.height;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(background, 0, 0);
      const rect = portraitRectangle(editor, placementRef.current);
      context.drawImage(images.portrait, rect.x*factorX, rect.y*factorY, rect.width*factorX, rect.height*factorY);
      context.drawImage(foreground, 0, 0);
    };
    const schedule = () => { if (frame === null) frame = window.requestAnimationFrame(paint); };
    const resize = () => {
      const container = previewRef.current;
      const style = window.getComputedStyle(container);
      const availableWidth = Math.max(1, (container.clientWidth || 450) - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0));
      const availableHeight = Math.max(1, (container.clientHeight || 600) - parseFloat(style.paddingTop || 0) - parseFloat(style.paddingBottom || 0));
      const displayWidth = Math.min(availableWidth, availableHeight*editor.width/editor.height);
      const displayHeight = displayWidth*editor.height/editor.width;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      const width = Math.min(900, Math.max(180, Math.round(displayWidth*Math.min(window.devicePixelRatio || 1, 2))));
      const height = Math.round(width*editor.height/editor.width);
      if (canvas.width !== width || canvas.height !== height || background.width !== width || background.height !== height) {
        canvas.width = background.width = foreground.width = width;
        canvas.height = background.height = foreground.height = height;
        background.getContext('2d').drawImage(images.background, 0, 0, width, height);
        foreground.getContext('2d').drawImage(images.foreground, 0, 0, width, height);
      }
      schedule();
    };
    drawRef.current = schedule;
    const observer = window.ResizeObserver ? new window.ResizeObserver(resize) : null;
    observer?.observe(previewRef.current);
    window.addEventListener('resize', resize);
    resize();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      if (frame !== null) window.cancelAnimationFrame(frame);
      drawRef.current = null;
    };
  }, [editor, images, loading]);

  useEffect(() => {
    placementRef.current = placement;
    drawRef.current?.();
  }, [placement]);

  const updatePlacement = change => {
    if (saving || !editor) return;
    const next = constrainPlacement(editor, { ...placementRef.current, ...change });
    placementRef.current = next;
    setPlacement(next);
    drawRef.current?.();
  };

  const nudge = (x, y) => updatePlacement({
    offset_x: placementRef.current.offset_x + x/(editor?.width || 1),
    offset_y: placementRef.current.offset_y + y/(editor?.height || 1)
  });

  const beginGesture = element => {
    const points = [...pointersRef.current.values()];
    gestureRef.current = points.length ? {
      placement: { ...placementRef.current }, points: points.map(point => ({ ...point })),
      bounds: element.getBoundingClientRect()
    } : null;
  };

  const startDrag = event => {
    if (saving || !editor || (event.pointerType === 'mouse' && event.button !== 0) || pointersRef.current.size >= 2) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    beginGesture(event.currentTarget);
  };

  const moveDrag = event => {
    if (saving || !pointersRef.current.has(event.pointerId) || !gestureRef.current) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = gestureRef.current;
    const points = [...pointersRef.current.values()];
    if (points.length === 2 && gesture.points.length === 2) {
      updatePlacement(pinchPlacement(editor, gesture.placement, gesture.points, points, gesture.bounds));
    } else if (points.length === 1) {
      updatePlacement({
        offset_x: gesture.placement.offset_x + (points[0].x - gesture.points[0].x)/gesture.bounds.width,
        offset_y: gesture.placement.offset_y + (points[0].y - gesture.points[0].y)/gesture.bounds.height
      });
    }
  };

  const endDrag = event => {
    if (!pointersRef.current.delete(event.pointerId)) return;
    beginGesture(event.currentTarget);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleCanvasKey = event => {
    const distance = event.shiftKey ? 40 : 10;
    const direction = { ArrowLeft: [-distance, 0], ArrowRight: [distance, 0], ArrowUp: [0, -distance], ArrowDown: [0, distance] }[event.key];
    if (direction) { event.preventDefault(); nudge(...direction); }
  };

  const handleDialogKey = event => {
    if (event.key === 'Escape') { event.stopPropagation(); if (!saving) onClose(); }
    if (event.key !== 'Tab') return;
    const elements = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), canvas[tabindex="0"], summary')]
      .filter(element => !element.closest('details:not([open])') || element.tagName === 'SUMMARY');
    if (!elements.length) { event.preventDefault(); return; }
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
      event.preventDefault(); first.focus();
    }
  };

  const save = async () => {
    if (!editor || saving) return;
    pointersRef.current.clear();
    gestureRef.current = null;
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post(`${API_URL}/user/certificates/${certificateId}/adjust`, {
        transform: placementRef.current, revision: editor.revision
      });
      onSaved(data);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const changed = editor && Object.keys(DEFAULT_PLACEMENT).some(key => Math.abs(placement[key] - editor.transform[key]) > .000001);

  return (
    <div className="portrait-editor-backdrop">
      <div className="portrait-editor-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={handleDialogKey}>
        <header className="portrait-editor-heading">
          <div><h2 id={titleId}>調整肖像照</h2><p id={helpId}>拖曳以移動照片；雙指縮放或使用尺寸滑桿調整大小。</p></div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="關閉肖像照編輯器">×</button>
        </header>
        <div className="portrait-editor-body">
          {error && <div className="request-error" role="alert">{error} <button type="button" disabled={saving} onClick={() => setAttempt(value => value + 1)}>重新載入編輯器</button></div>}
          {loading && <p className="portrait-editor-loading" role="status">正在載入肖像照編輯器…</p>}
          {!loading && editor && images && (
            <div className="portrait-editor-layout">
              <div className="portrait-editor-preview" ref={previewRef}>
                <canvas ref={canvasRef} tabIndex={saving ? -1 : 0} role="img" aria-label="海報預覽。拖曳以移動、雙指縮放以調整大小，或使用方向鍵微調。" aria-describedby={helpId}
                  onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} onKeyDown={handleCanvasKey} />
              </div>
              <div className="portrait-editor-controls">
                <label htmlFor={`${titleId}-size`}>肖像照大小 <output>{Math.round(placement.scale * 100)}%</output></label>
                <div className="portrait-editor-zoom">
                  <button type="button" aria-label="縮小肖像照" disabled={saving || placement.scale <= .25} onClick={() => updatePlacement({ scale: placementRef.current.scale - .05 })}>−</button>
                  <input id={`${titleId}-size`} aria-label="肖像照大小" aria-valuetext={`${Math.round(placement.scale * 100)}%`} type="range" min="25" max="250" step="1" value={Math.round(placement.scale * 100)} disabled={saving}
                    onChange={event => updatePlacement({ scale: Number(event.target.value)/100 })} />
                  <button type="button" aria-label="放大肖像照" disabled={saving || placement.scale >= 2.5} onClick={() => updatePlacement({ scale: placementRef.current.scale + .05 })}>+</button>
                </div>
                <details className="portrait-editor-fine" open={fineOpen} onToggle={event => setFineOpen(event.currentTarget.open)}>
                  <summary>微調位置</summary>
                  <div className="portrait-editor-fine-controls">
                    <label htmlFor={`${titleId}-horizontal`}>水平位置</label>
                    <input id={`${titleId}-horizontal`} aria-label="水平位置" type="range" min="-100" max="100" step="0.5" value={placement.offset_x * 100} disabled={saving}
                      onChange={event => updatePlacement({ offset_x: Number(event.target.value)/100 })} />
                    <label htmlFor={`${titleId}-vertical`}>垂直位置</label>
                    <input id={`${titleId}-vertical`} aria-label="垂直位置" type="range" min="-100" max="100" step="0.5" value={placement.offset_y * 100} disabled={saving}
                      onChange={event => updatePlacement({ offset_y: Number(event.target.value)/100 })} />
                    <div className="portrait-editor-nudge" aria-label="微調肖像照位置">
                      <button type="button" disabled={saving} onClick={() => nudge(0,-20)} aria-label="向上移動肖像照">↑</button>
                      <button type="button" disabled={saving} onClick={() => nudge(-20,0)} aria-label="向左移動肖像照">←</button>
                      <button type="button" disabled={saving} onClick={() => nudge(20,0)} aria-label="向右移動肖像照">→</button>
                      <button type="button" disabled={saving} onClick={() => nudge(0,20)} aria-label="向下移動肖像照">↓</button>
                    </div>
                  </div>
                </details>
                <button type="button" className="portrait-editor-reset" disabled={saving} onClick={() => updatePlacement(DEFAULT_PLACEMENT)}>重設位置</button>
                <p className="portrait-editor-note">姓名、徽章及設計元素的位置保持不變。</p>
              </div>
            </div>
          )}
        </div>
        <footer className="portrait-editor-footer">
          {saving && <p role="status">正在儲存原尺寸海報…</p>}
          <div className="portrait-editor-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>取消</button>
            <button type="button" className="btn-primary" onClick={save} disabled={saving || loading || !images || !changed}>{saving ? "正在儲存…" : "儲存變更"}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
