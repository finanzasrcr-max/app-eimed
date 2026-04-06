import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserRound,
  Calendar as CalendarIcon,
  Settings,
  CreditCard,
  Building2,
  Package,
  BarChart2,
  Wallet,
  FolderOpen,
  X
} from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Inicio',        path: '/dashboard' },
    { icon: <CalendarIcon size={20} />,   label: 'Agenda',         path: '/calendar' },
    { icon: <Users size={20} />,          label: 'Pacientes',      path: '/patients' },
    { icon: <Building2 size={20} />,      label: 'Clientes',       path: '/clients' },
    { icon: <UserRound size={20} />,      label: 'Enfermeras',     path: '/nurses' },
    { icon: <Package size={20} />,        label: 'Catálogo',       path: '/catalog' },
    { icon: <Wallet size={20} />,         label: 'Cobros',         path: '/financials' },
    { icon: <CreditCard size={20} />,     label: 'Pagos',          path: '/payroll' },
    { icon: <FolderOpen size={20} />,     label: 'Documentos',     path: '/documents' },
    { icon: <BarChart2 size={20} />,      label: 'Reportes',       path: '/reports' },
    { icon: <Settings size={20} />,       label: 'Configuración',  path: '/settings' },
  ];

  return (
    <>
      {/* Backdrop para mobile */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
      />

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-container">
            <img src="/logo-icon.svg" alt="EIMED" className="sidebar-logo-icon" />
            <span className="logo-text">EIMED</span>
          </div>
          <button className="sidebar-close-btn" onClick={onClose} title="Cerrar menú">
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">AD</div>
            <div className="user-info">
              <p className="user-name">Admin User</p>
              <p className="user-role">Super Admin</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
