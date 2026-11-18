import React, { useId, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, User, Users, History, LogOut, Menu, X } from 'lucide-react';
import './AdminNavigation.css';

export default function AdminNavigation({ onLogout }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef(null);
  const close = () => setOpen(false);
  const links = [
    { to: '/', label: '使用者入口', Icon: User },
    { to: '/admin', label: '管理員控制台', Icon: Home },
    { to: '/history', label: '海報紀錄', Icon: Users },
    { to: '/master-data-history', label: '主資料上傳紀錄', Icon: History },
  ];

  return (
    <aside className={`admin-sidebar${open ? ' is-open' : ''}`} aria-label="管理員導覽" onKeyDown={event => {
      if (event.key === 'Escape' && open) { close(); toggleRef.current?.focus(); }
    }}>
      <div className="admin-navigation-header">
        <div className="sidebar-logo">
          <img src={`${process.env.PUBLIC_URL}/PRU_logo_white_RGB_v1%201.png`} alt="保誠" />
        </div>
        <button ref={toggleRef} type="button" className="admin-menu-toggle" aria-expanded={open} aria-controls={panelId}
          onClick={() => setOpen(value => !value)}>
          {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          <span>{open ? '關閉選單' : '開啟選單'}</span>
        </button>
      </div>
      <div className="admin-navigation-panel" id={panelId}>
        <nav className="sidebar-nav" aria-label="管理員頁面">
          {links.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={() => { close(); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }}>
              <Icon size={20} aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button type="button" className="logout-button" onClick={() => { close(); onLogout(); }}>
          <LogOut size={18} aria-hidden="true" /><span>登出</span>
        </button>
      </div>
    </aside>
  );
}
