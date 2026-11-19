import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // Retain technical detail in the browser console without exposing it in
    // the user-facing Chinese interface.
    console.error('Application rendering failed', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="portal-wrapper" role="alert">
          <section className="step-card system-error">
            <h2>頁面需要重新載入</h2>
            <p>海報處理會繼續在伺服器上進行，不會遺失。</p>
            <button type="button" onClick={() => window.location.reload()}>重新載入</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>
);
