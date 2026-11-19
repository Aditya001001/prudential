import React, { useState, useEffect } from 'react';
import './Loader.css';

const Loader = ({ job, message, estimatedTime }) => {
  const [elapsed, setElapsed] = useState(0);
  const [dots, setDots] = useState('');

  useEffect(() => {
    // Timer for elapsed seconds
    const timer = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    // Animated dots
    const dotsTimer = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => {
      clearInterval(timer);
      clearInterval(dotsTimer);
    };
  }, []);

  const queued = job?.status === 'queued';
  const estimate = Math.max(1, job?.estimated_wait_seconds || estimatedTime || 15);
  const queuePosition = job?.queue_position || 1;
  // Do not pretend a waiting job is rendering.  Once a worker starts it, the
  // normal elapsed rendering indicator resumes.
  const progress = queued ? 8 : Math.min((elapsed / estimate) * 100, 95);
  const title = message || (queued ? '海報已排入處理隊列' : '正在製作海報');
  const subtitle = queued
    ? (queuePosition > 1 ? `目前前方有 ${queuePosition - 1} 個海報正在等候處理` : '即將開始處理您的海報')
    : '正在移除背景並製作您的 MDRT 海報，請稍候';

  return (
    <div className="loader-overlay">
      <div className="loader-container">
        <div className="loader-header">
          <img src={`${process.env.PUBLIC_URL}/PRU_logo_black.png`} alt="保誠" className="loader-logo" />
        </div>

        <div className="loader-content">
          <div className="spinner-container">
            <div className="spinner-outer"></div>
          </div>

          <h3 className="loader-title">{title}{dots}</h3>
          
          <div className="loader-stats">
            <div className="stat-item">
              <span className="stat-label">{queued ? '隊列位置' : '已用時間'}</span>
              <span className="stat-value">{queued ? `第 ${queuePosition} 位` : `${elapsed} 秒`}</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-label">預計時間</span>
              <span className="stat-value">約 {estimate} 秒</span>
            </div>
          </div>

          <div className="progress-bar-container">
            <div className="progress-bar">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <span className="progress-percentage">{Math.round(progress)}%</span>
          </div>

          <p className="loader-subtitle">
            {subtitle}
          </p>

          <div className="loader-steps">
            <div className={`step-dot ${!queued && elapsed >= 1 ? 'active' : ''}`}></div>
            <div className={`step-dot ${!queued && elapsed >= 5 ? 'active' : ''}`}></div>
            <div className={`step-dot ${!queued && elapsed >= 10 ? 'active' : ''}`}></div>
            <div className={`step-dot ${!queued && elapsed >= 15 ? 'active' : ''}`}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Loader;
