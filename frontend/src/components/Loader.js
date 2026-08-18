import React, { useState, useEffect } from 'react';
import './Loader.css';

const Loader = ({ message = "Generating your certificate...", estimatedTime = 15 }) => {
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

  const progress = Math.min((elapsed / estimatedTime) * 100, 95);

  return (
    <div className="loader-overlay">
      <div className="loader-container">
        <div className="loader-header">
          <img src="/prudential/PRU_logo_black.png" alt="Prudential" className="loader-logo" />
        </div>

        <div className="loader-content">
          <div className="spinner-container">
            <div className="spinner-outer"></div>
          </div>

          <h3 className="loader-title">{message}{dots}</h3>
          
          <div className="loader-stats">
            <div className="stat-item">
              <span className="stat-label">Elapsed</span>
              <span className="stat-value">{elapsed}s</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-label">Estimated</span>
              <span className="stat-value">~{estimatedTime}s</span>
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
            Please wait while we create your MDRT certificate
          </p>

          <div className="loader-steps">
            <div className={`step-dot ${elapsed >= 1 ? 'active' : ''}`}></div>
            <div className={`step-dot ${elapsed >= 5 ? 'active' : ''}`}></div>
            <div className={`step-dot ${elapsed >= 10 ? 'active' : ''}`}></div>
            <div className={`step-dot ${elapsed >= 15 ? 'active' : ''}`}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Loader;
