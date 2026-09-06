import React, { useState, useEffect } from 'react';
import { useHabits } from '../context/HabitContext';
import { DynamicIslandHud } from './DynamicIslandHud';

export const AppLayout = ({ activeTab, onTabChange, onOpenPairing, onOpenAddGoal, children }) => {
  const {
    user,
    partner,
    isSolo,
    pod,
    themeMode,
    setThemeMode,
    osMode,
    setOsMode,
    currentPercent,
    islandMessage,
  } = useHabits();

  const [copiedCode, setCopiedCode] = useState(false);
  const [islandExpanded, setIslandExpanded] = useState(false);

  const isMobile = typeof window !== 'undefined' && (
    window.innerWidth <= 768 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    Boolean(window.Capacitor?.isNativePlatform?.())
  );

  const handleCopyCode = () => {
    const code = user?.secretCode || pod.code;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const cycleThemeMode = () => {
    if (themeMode === 'dark') setThemeMode('light');
    else if (themeMode === 'light') setThemeMode('auto');
    else setThemeMode('dark');
  };

  const getThemeIcon = () => {
    if (themeMode === 'light') return '☀️ Light';
    if (themeMode === 'auto') return '⚙️ Auto';
    return '🌙 Dark';
  };

  return (
    <div className={`app-container ${isMobile ? 'mobile-viewport' : 'desktop-viewport'}`}>
      {/* DESKTOP RESPONSIVE HEADER */}
      {!isMobile && (
        <header className="desktop-navbar">
          <div className="desktop-nav-inner">
            {/* Left: Brand & Mode */}
            <div className="nav-brand-group">
              <div className="brand-logo" onClick={() => onTabChange('together')}>
                <span className="brand-flame">🔥</span>
                <span className="brand-name font-bold">DayByDay</span>
              </div>
              <div className={`mode-badge ${isSolo ? 'solo' : 'pod'}`} onClick={onOpenPairing} title="Click to view pairing">
                <span className="mode-dot"></span>
                <span>{isSolo ? 'Solo Tracker' : `Pod with @${partner?.username || 'Partner'}`}</span>
              </div>
            </div>

            {/* Center: Navigation Tabs */}
            <nav className="desktop-nav-links">
              <button
                className={`nav-tab-btn ${activeTab === 'together' ? 'active' : ''}`}
                onClick={() => onTabChange('together')}
              >
                <span>{isSolo ? 'My Habits' : 'Together'}</span>
              </button>
              <button
                className={`nav-tab-btn ${activeTab === 'insights' ? 'active' : ''}`}
                onClick={() => onTabChange('insights')}
              >
                <span>Insights</span>
              </button>
              <button
                className={`nav-tab-btn ${activeTab === 'widgets' ? 'active' : ''}`}
                onClick={() => onTabChange('widgets')}
              >
                <span>Widgets</span>
              </button>
              <button
                className={`nav-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => onTabChange('settings')}
              >
                <span>Settings</span>
              </button>
            </nav>

            {/* Right: Secret Code, Theme Toggle & Profile */}
            <div className="desktop-nav-right">
              {/* Secret Code Quick Chip */}
              {user && (
                <button
                  className="secret-code-chip"
                  onClick={handleCopyCode}
                  title="Click to copy your secret code to share with a partner"
                >
                  <span className="chip-label">Secret Code:</span>
                  <span className="chip-code">{user.secretCode}</span>
                  <span className="copy-icon">{copiedCode ? '✓' : '📋'}</span>
                </button>
              )}

              {/* Theme Toggle Button */}
              <button
                className="theme-mode-btn"
                onClick={cycleThemeMode}
                title="Toggle Light / Dark / Auto Mode"
              >
                {getThemeIcon()}
              </button>

              {/* Add Goal Button */}
              <button className="desktop-add-btn" onClick={onOpenAddGoal}>
                <span>+ Add Goal</span>
              </button>

              {/* User Profile Pill */}
              <div
                className="desktop-profile-pill"
                onClick={() => onTabChange('settings')}
                title="Open profile settings"
              >
                <span className="profile-pill-avatar">{user?.avatar || '🌱'}</span>
                <span className="profile-pill-name">@{user?.username || 'user'}</span>
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
