import React from 'react';
import { Search, Bell, HelpCircle, ChevronDown, Menu } from 'lucide-react';
import './TopBar.css';

interface TopBarProps {
  onMenuClick?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  return (
    <header className="top-bar">
      <button className="icon-btn hamburger-btn" title="Abrir menú" onClick={onMenuClick}>
        <Menu size={22} />
      </button>

      <div className="top-bar-search">
        <Search size={18} className="search-icon" />
        <input type="text" placeholder="Buscar pacientes, turnos o personal..." className="search-input" />
      </div>

      <div className="top-bar-actions">
        <button className="icon-btn" title="Ayuda">
          <HelpCircle size={20} />
        </button>
        <button className="icon-btn" title="Notificaciones">
          <div className="notification-badge"></div>
          <Bell size={20} />
        </button>

        <div className="divider"></div>

        <div className="user-menu-trigger">
          <div className="user-avatar-small">AD</div>
          <div className="user-details-mini">
            <span className="user-name-mini">Admin User</span>
            <span className="user-role-mini">Super Admin</span>
          </div>
          <ChevronDown size={14} className="chevron" />
        </div>
      </div>
    </header>
  );
};

export default TopBar;
