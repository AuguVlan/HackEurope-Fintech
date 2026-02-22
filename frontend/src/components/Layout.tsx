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
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor" opacity="0.2"/>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div>
            <h1 className="brand-title">TideBridge</h1>
            <p className="brand-sub">Settlement Engine</p>
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
          <div className="px-4 py-3 mb-2 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Environment</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold text-foreground">Production</span>
            </div>
          </div>
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
          <h2 className="navbar-title">Operations Center</h2>
          <p className="navbar-sub">Real-time Settlement Monitoring</p>
        </div>
      </div>

      <div className="navbar-right">
        <div className="status-pill" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)' }}>
          <span className="pulse" />
          <span style={{ color: '#22c55e' }}>LIVE</span>
        </div>
        <div className="avatar-block">
          <div className="avatar" style={{ 
            background: 'linear-gradient(135deg, #38bdf8, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 600,
            color: 'white'
          }}>
            TB
          </div>
          <div className="avatar-info">
            <span className="avatar-name">TideBridge</span>
            <span className="avatar-role">Admin Console</span>
          </div>
        </div>
      </div>
    </nav>
  );
};
