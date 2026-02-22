import React, { useState } from 'react';
import { LayoutDashboard, BookOpen, Users, FileText, Zap, BarChart3, LogOut, Menu, X } from 'lucide-react';
import { cn } from '../lib/cn';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '#' },
  { label: 'Ledger', icon: BookOpen, href: '#ledger' },
  { label: 'Workers', icon: Users, href: '#workers' },
  { label: 'Obligations', icon: FileText, href: '#obligations' },
  { label: 'Settlement', icon: Zap, href: '#settlement' },
  { label: 'Metrics', icon: BarChart3, href: '#metrics' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const [active, setActive] = useState('Dashboard');

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && <div className="menu-toggle" onClick={onClose} />}

      {/* MATCH YOUR CSS: Use 'sidebar' and 'closed' classes */}
      <aside className={cn('sidebar', !isOpen && 'closed')}>
        <div className="sidebar-brand">
          <div className="brand-icon">⚡</div>
          <div>
            <h1 className="brand-title">Ledger</h1>
            <p className="brand-sub">TideBridge</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.label;
            return (
              <button
                key={item.label}
                onClick={() => setActive(item.label)}
                className={cn('nav-btn', isActive && 'active')}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-btn nav-btn-danger">
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

interface NavbarProps {
  onMenuClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  return (
    <nav className="navbar"> {/* Matches .navbar in your CSS */}
      <div className="navbar-left">
        <button onClick={onMenuClick} className="menu-toggle">☰</button>
        <div>
          <h2 className="navbar-title">Admin Dashboard</h2>
          <p className="navbar-sub">TideBridge Settlement</p>
        </div>
      </div>

      <div className="navbar-right">
        <div className="status-pill">
          <span className="pulse" />
          DEV
        </div>
        <div className="avatar-block">
          <div className="avatar" />
          <div className="avatar-info">
            <span className="avatar-name">Admin</span>
            <span className="avatar-role">System</span>
          </div>
        </div>
      </div>
    </nav>
  );
};
