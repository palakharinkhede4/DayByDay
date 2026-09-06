import React from 'react';
import { useHabits } from '../context/HabitContext';

export const OSBar = ({ onOpenPairing, onOpenAddGoal }) => {
  const {
    osMode,
    setOsMode,
    viewMode,
    setViewMode,
    themeColor,
    setThemeColor,
    activeUserId,
    setActiveUserId,
    pod,
    simulatePartnerActivity,
    triggerCelebration,
  } = useHabits();

  const partnerName = activeUserId === 'user1' ? pod.user2.name : pod.user1.name;
  const currentUserName = activeUserId === 'user1' ? pod.user1.name : pod.user2.name;

  return (
    <header className="os-toolbar" aria-label="Device and OS controls">
      <div className="os-toolbar-inner">
        {/* Brand & Mode */}
        <div className="toolbar-section brand-section">
          <div className="app-badge">
            <span className="badge-pulse"></span>
            <span className="badge-title">DayByDay</span>
            <span className="badge-version">v2.4 Pro</span>
          </div>
        </div>

        {/* OS Engine Switcher */}
        <div className="toolbar-section os-switcher-section">
          <div className="segmented-control" role="tablist" aria-label="Select Operating System">
            <button
              className={`segment-btn ${osMode === 'android' ? 'active' : ''}`}
              onClick={() => setOsMode('android')}
              title="Switch to Android 16 Material 3 Expressive"
            >
              <svg className="os-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993s-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993s-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.4126 13.8533 8 12 8s-3.5902.4126-5.1367 1.0507L4.841 5.5477a.416.416 0 00-.5676-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
              </svg>
              <span>Android 16 M3</span>
            </button>
            <button
              className={`segment-btn ${osMode === 'ios' ? 'active' : ''}`}
              onClick={() => setOsMode('ios')}
              title="Switch to iOS 18+ Liquid Glass"
            >
              <svg className="os-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.66-.82 1.11-1.96.99-3.1-.96.04-2.12.64-2.8 1.44-.6.69-1.12 1.83-.98 2.94 1.07.08 2.15-.55 2.79-1.28z" />
              </svg>
              <span>iOS 18+ Glass</span>
            </button>
          </div>
        </div>

        {/* View Mode (Chassis Frame vs Fullscreen) */}
        <div className="toolbar-section frame-toggle-section">
          <div className="segmented-control mini">
            <button
              className={`segment-btn ${viewMode === 'frame' ? 'active' : ''}`}
              onClick={() => setViewMode('frame')}
              title="Show in Realistic Phone Bezel"
            >
              📱 Phone
            </button>
            <button
              className={`segment-btn ${viewMode === 'fullscreen' ? 'active' : ''}`}
              onClick={() => setViewMode('fullscreen')}
              title="Fill Screen Edge-to-Edge"
            >
              🖥️ Full
            </button>
          </div>
        </div>

        {/* Co-op Simulation & Perspective */}
        <div className="toolbar-section coop-actions">
          {/* Active Perspective */}
          <div className="user-perspective-pill">
            <span className="perspective-label">View As:</span>
            <button
              className={`user-btn ${activeUserId === 'user1' ? 'active user1' : ''}`}
              onClick={() => setActiveUserId('user1')}
            >
              <span className="dot dot-user1"></span>
              <span>{pod.user1.name} (You)</span>
            </button>
            <button
              className={`user-btn ${activeUserId === 'user2' ? 'active user2' : ''}`}
              onClick={() => setActiveUserId('user2')}
            >
              <span className="dot dot-user2"></span>
              <span>{pod.user2.name}</span>
            </button>
          </div>

          {/* Simulate Partner Button */}
          <button
            className="sim-btn"
            onClick={simulatePartnerActivity}
            title={`Simulate ${partnerName} checking off an activity`}
          >
            <span className="sim-icon">⚡</span>
            <span>Ping {partnerName}</span>
          </button>

          {/* Confetti Celebration */}
          <button
            className="celebrate-btn"
            onClick={triggerCelebration}
            title="Celebrate completed goals!"
          >
            🎉
          </button>

          {/* Pair Code Quick Launcher */}
          <button
            className="pair-code-pill"
            onClick={onOpenPairing}
            title="Open Pod Pairing Modal"
          >
            <span className="pair-label">Pod:</span>
            <span className="pair-code">{pod.code}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
