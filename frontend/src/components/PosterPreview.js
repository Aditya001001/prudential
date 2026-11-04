import React, { useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';

// Mount a fresh instance for each saved filename so the previous poster cannot
// remain visible while the replacement PNG downloads and decodes.
export default function PosterPreview({ src, updated, onReady, onView }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const imageRef = useRef(null);
  const mounted = useRef(false);
  const imageUrl = `${src}${src.includes('?') ? '&' : '?'}preview_attempt=${attempt}`;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loaded = async event => {
    const image = event.currentTarget;
    try {
      if (image.decode) await image.decode();
      if (!mounted.current || imageRef.current !== image) return;
      setReady(true);
      setFailed(false);
      onReady(true);
    } catch {
      if (mounted.current && imageRef.current === image) failedToLoad();
    }
  };

  const failedToLoad = () => {
    setReady(false);
    setFailed(true);
    onReady(false);
  };

  return (
    <div className="certificate-preview" aria-busy={!ready && !failed}
      role={ready ? 'button' : undefined} tabIndex={ready ? 0 : undefined}
      aria-label={ready ? "查看海報原圖" : undefined}
      onClick={() => { if (ready) onView(); }}
      onKeyDown={event => { if (ready && event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onView(); } }}>
      <img key={imageUrl} ref={imageRef} src={imageUrl} alt="海報" className="cert-image"
        style={{ display: ready ? undefined : 'none' }} onLoad={loaded} onError={failedToLoad} />
      {!ready && <div className="poster-preview-status">
        {failed ? <><p role="alert">{updated ? "變更已儲存，但無法載入更新後的預覽。" : "無法載入海報預覽。"}</p>
          <button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>重新載入預覽</button></>
          : <p role="status">{updated ? "正在載入更新後的海報…" : "正在載入海報預覽…"}</p>}
      </div>}
      {ready && <span className="preview-hint"><Eye size={16} /><span>點擊查看原圖</span></span>}
    </div>
  );
}
