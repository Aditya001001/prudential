import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import UserPortal from './pages/UserPortal';
import { Award, Shield } from 'lucide-react';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <Navigation />
        <Routes>
          <Route path="/" element={<UserPortal />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

function Navigation() {
  const location = useLocation();
  const isAdmin = location.pathname === '/admin';

  return (
    <nav className="nav-bar">
      <Link to="/" className={`nav-link ${!isAdmin ? 'active' : ''}`}>
        <Award size={20} />
        <span>User Portal</span>
      </Link>
      <Link to="/admin" className={`nav-link ${isAdmin ? 'active' : ''}`}>
        <Shield size={20} />
        <span>Admin Dashboard</span>
      </Link>
    </nav>
  );
}

export default App;
