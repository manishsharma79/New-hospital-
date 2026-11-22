import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { HospitalLogo } from '../components/HospitalLogo';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface DashboardLayoutProps {
  roleLabel: string;
  navItems: NavItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  roleLabel,
  navItems,
  activeTab,
  onSelectTab,
  primaryAction,
  children,
}) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeItem = navItems.find((n) => n.id === activeTab) ?? navItems[0];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen flex bg-[#EEF4FB] text-[#0F172A]">
      {/* Mobile Sidebar Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar (Clinical Ocean Navy) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-gradient-to-b from-[#0A2744] via-[#0B3256] to-[#071D34] text-white transition-all duration-200 lg:static ${
          collapsed ? 'lg:w-[76px]' : 'lg:w-[276px]'
        } ${mobileOpen ? 'translate-x-0 w-[276px]' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="flex min-h-[84px] items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <HospitalLogo size={collapsed ? 'sm' : 'md'} />
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-base font-bold leading-snug tracking-tight text-white [text-wrap:balance]">
                  Hospital Management Information System
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:inline-flex rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeTab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileOpen(false);
                }}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-[#0284C7] to-[#1D4ED8] text-white shadow-sm'
                    : 'text-[#CBD5E1] hover:bg-white/10 hover:text-white'
                } ${collapsed ? 'justify-center px-2' : ''}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="border-t border-white/10 p-3">
          {!collapsed && user && (
            <div className="mb-2.5 px-2">
              <p className="text-xs font-semibold text-white truncate">{user.fullName}</p>
              <p className="text-[11px] font-mono text-[#93C5FD] truncate">{user.staffCode}</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#CBD5E1] hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap ${
              collapsed ? 'justify-center px-2' : ''
            }`}
            title="Sign out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Prominent Hospital Header on Left, Controls & Account on Right */}
        <header className="sticky top-0 z-30 flex min-h-[72px] items-center justify-between gap-4 border-b border-[#CBD5E1]/80 bg-white/95 dark:border-[#1E293B] dark:bg-[#0F172A]/95 backdrop-blur-xs px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-[#E2E8F0] p-2 text-[#334155] hover:bg-slate-50 dark:border-[#334155] dark:text-[#E2E8F0] dark:hover:bg-[#1E293B] lg:hidden shrink-0"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <HospitalLogo size="sm" className="lg:hidden" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl xl:text-2xl font-bold tracking-tight text-[#0B1F3A] dark:text-[#F8FAFC] truncate">
                Hospital Management Information System
              </h1>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">
                <span className="font-semibold text-[#0284C7] dark:text-[#38BDF8]">{roleLabel}</span> ·{' '}
                <span className="font-medium text-[#334155] dark:text-[#CBD5E1]">{activeItem?.label}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-2 text-xs font-medium text-[#334155] hover:bg-slate-100 dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#E2E8F0] dark:hover:bg-[#334155] transition-colors whitespace-nowrap shrink-0"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="h-3.5 w-3.5 text-[#FBBF24]" /> : <Moon className="h-3.5 w-3.5 text-[#475569]" />}
              <span className="hidden md:inline">{isDark ? 'Light' : 'Dark'}</span>
            </button>
            {primaryAction}
            <div className="hidden sm:flex items-center gap-2.5 border-l border-[#E2E8F0] dark:border-[#1E293B] pl-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-xs font-semibold text-[#1D4ED8] shrink-0">
                {user?.fullName
                  ? user.fullName
                      .replace(/^Dr\.\s+/i, '')
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join('')
                      .toUpperCase()
                  : 'HM'}
              </div>
              <div className="text-right leading-tight">
                <p className="text-xs font-semibold text-[#0B1F3A] dark:text-[#F8FAFC] whitespace-nowrap">{user?.fullName}</p>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap">
                  {roleLabel}
                  {user?.departmentName ? ` · ${user.departmentName}` : ''}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
