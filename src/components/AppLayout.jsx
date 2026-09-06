import React, { useState, useEffect } from 'react';
import { useHabits } from '../context/HabitContext';
import { sound } from '../utils/sound';
import {
  CheckCircle2,
  Users,
  Eye,
  BarChart3,
  Settings,
  Sun,
  Moon,
  Plus,
  Flame,
} from 'lucide-react';
import { BottomNavBar } from './BottomNavBar';

export const AppLayout = ({ activeTab, onTabChange, onOpenAddGoal, children }) => {
  const {
    user,
    themeMode,
    setThemeMode,
    osMode,
    profilePicture,
  } = useHabits();

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.innerWidth <= 768 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      Boolean(window.Capacitor?.isNativePlatform?.())
    );
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(
        window.innerWidth <= 768 ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        Boolean(window.Capacitor?.isNativePlatform?.())
      );
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleTheme = () => {
    sound.selection();
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
            <div
              className="nav-brand-group"
              onClick={() => {
                sound.selection();
                onTabChange('habits');
              }}
              style={{ cursor: 'pointer' }}
            >
              <div className="brand-logo">
                <div className="brand-logo-badge">
                  <Flame size={16} className="brand-logo-flame text-amber-400" strokeWidth={2.4} />
                </div>
                <span className="brand-name font-bold">DayByDay</span>
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
                    onClick={() => {
                      sound.selection();
                      onTabChange(tab.id);
                    }}
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
              <button
                className="desktop-add-btn font-bold"
                onClick={() => {
                  sound.press();
                  onOpenAddGoal();
                }}
              >
                <Plus size={16} strokeWidth={2.4} />
                <span>Add Goal</span>
              </button>

              {/* User Profile Avatar Pill */}
              <div
                className="desktop-profile-pill"
                onClick={() => {
                  sound.selection();
                  onTabChange('settings');
                }}
                title="Open Profile Settings"
              >
                <div className="profile-pill-avatar font-bold">
                  {profilePicture ? (
                    <img src={profilePicture} alt="Avatar" className="profile-pill-img" />
                  ) : (
                    userInitial
                  )}
                </div>
                <span className="profile-pill-name font-medium">@{user?.username || 'user'}</span>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* MOBILE RESPONSIVE TOP BAR (Brand Logo & App Name on Top Left across all pages) */}
      {isMobile && (
        <header className="mobile-app-header">
          <div
            className="mobile-brand-logo"
            onClick={() => {
              sound.selection();
              onTabChange('habits');
            }}
            title="DayByDay Home"
          >
            <div className="mobile-brand-badge">
              <Flame size={16} className="mobile-brand-flame" strokeWidth={2.4} />
            </div>
            <div className="mobile-brand-text-col">
              <span className="mobile-brand-title font-black tracking-tight">DayByDay</span>
              <span className="mobile-brand-status font-bold">Consistent</span>
            </div>
          </div>

          <div className="mobile-header-right">
            <button
              className="mobile-theme-btn"
              onClick={toggleTheme}
              title={`Switch to ${themeMode === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle Theme"
            >
              {themeMode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <div
              className="mobile-avatar-badge"
              onClick={() => {
                sound.selection();
                onTabChange('settings');
              }}
              title="Open Settings"
            >
              {profilePicture ? (
                <img src={profilePicture} alt="Avatar" className="mobile-avatar-img" />
              ) : (
                <span className="mobile-avatar-char font-bold">{userInitial}</span>
              )}
            </div>
          </div>
        </header>
      )}

      {/* MAIN CONTENT AREA */}
      <main className={`app-main-content ${isMobile ? 'mobile-main' : 'desktop-main'}`}>
        <div className="content-inner-wrapper">
          {children}
        </div>
      </main>

      {/* MOBILE-ONLY BOTTOM NAVIGATION BAR (Strictly excluded from desktop) */}
      {isMobile && (
        <BottomNavBar
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      )}
    </div>
  );
};
