import React, { useState } from 'react';
import { useHabits } from '../context/HabitContext';
import { DynamicIslandHud } from './DynamicIslandHud';
import {
  CheckCircle2,
  Users,
  Eye,
  BarChart3,
  Settings,
  Sun,
  Moon,
  Plus,
} from 'lucide-react';

export const AppLayout = ({ activeTab, onTabChange, onOpenAddGoal, children }) => {
  const {
    user,
    themeMode,
    setThemeMode,
    osMode,
  } = useHabits();

  const isMobile = typeof window !== 'undefined' && (
    window.innerWidth <= 768 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    Boolean(window.Capacitor?.isNativePlatform?.())
  );

  const toggleTheme = () => {
    if (themeMode === 'dark') setThemeMode('light');
    else setThemeMode('dark');
  };

  const navTabs = [
    { id: 'habits', label: 'My Habits', icon: <CheckCircle2 size={16} /> },
    { id: 'track', label: 'Track', icon: <Eye size={16} /> },
    { id: 'together', label: 'Together', icon: <Users size={16} /> },
    { id: 'insights', label: 'Insights', icon: <BarChart3 size={16} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
  ];

  const userInitial = (user?.displayName || user?.username || 'U')[0].toUpperCase();

  return (
    <div className={`app-container ${isMobile ? 'mobile-viewport' : 'desktop-viewport'}`}>
      {/* DESKTOP RESPONSIVE HEADER */}
      {!isMobile && (
        <header className="desktop-navbar">
          <div className="desktop-nav-inner">
            {/* Left: Brand */}
            <div className="nav-brand-group">
              <div className="brand-logo" onClick={() => onTabChange('habits')}>
                <span className="brand-flame-icon font-black">🔥</span>
                <span className="brand-name font-black">DayByDay</span>
              </div>
            </div>

            {/* Center: Navigation Tabs */}
            <nav className="desktop-nav-links">
              {navTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                    onClick={() => onTabChange(tab.id)}
                  >
                    <span className="tab-icon-wrap">{tab.icon}</span>
                    <span className="tab-label font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right: Actions & User Profile */}
            <div className="desktop-nav-right">
              {/* Theme Toggle Button */}
              <button
                className="theme-mode-btn"
                onClick={toggleTheme}
                title={`Switch to ${themeMode === 'dark' ? 'Light' : 'Dark'} Mode`}
                aria-label="Toggle Theme"
              >
                {themeMode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </button>

              {/* Add Goal Button */}
              <button className="desktop-add-btn font-bold" onClick={onOpenAddGoal}>
                <Plus size={16} strokeWidth={2.4} />
                <span>Add Goal</span>
              </button>

              {/* User Profile Avatar Pill */}
              <div
                className="desktop-profile-pill"
                onClick={() => onTabChange('settings')}
                title="Open Profile Settings"
              >
                <div className="profile-pill-avatar font-bold">
                  {userInitial}
                </div>
                <span className="profile-pill-name font-medium">@{user?.username || 'user'}</span>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* MOBILE TOP STATUS BAR & DYNAMIC ISLAND */}
      {isMobile && osMode === 'ios' && (
        <div className="mobile-ios-island-bar">
          <DynamicIslandHud isDesktopMockup={false} />
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className={`app-main-content ${isMobile ? 'mobile-main' : 'desktop-main'}`}>
        <div className="content-inner-wrapper">
          {children}
        </div>
      </main>
    </div>
  );
};
