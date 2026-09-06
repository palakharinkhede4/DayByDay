import React, { useState } from 'react';
import { useHabits } from '../context/HabitContext';

export const WidgetsScreen = () => {
  const {
    osMode,
    pod,
    habits,
    currentPercent,
    inSyncGoalsCount,
    activeUserId,
    updateHabit,
    simulatePartnerActivity,
  } = useHabits();

  const [widgetOS, setWidgetOS] = useState(osMode);
  const stepsHabit = habits.find((h) => h.id === 'steps') || { user1: 2200, user2: 7400, target: 10000 };
  const waterHabit = habits.find((h) => h.id === 'water') || { user1: 5, user2: 8, target: 8 };
  const vitaminsHabit = habits.find((h) => h.id === 'vitamins') || { user1: false, user2: true };

  return (
    <div className="screen-widgets-container">
      <div className="widgets-header-banner">
        <div className="widgets-title-row">
          <span className="widgets-hero-badge">Full Widget Suite</span>
          <h1 className="widgets-screen-title">Interactive Widgets (Both OS)</h1>
        </div>
        <p className="widgets-desc">
          Both Android 16 and iOS 18+ have the complete, identical suite of 5 interactive widgets — rendered natively in their respective design systems. You can tap the buttons directly on any widget!
        </p>

        {/* OS Widget Preview Switcher */}
        <div className="widget-os-tabs">
          <button
            className={`widget-tab-btn ${widgetOS === 'ios' ? 'active' : ''}`}
            onClick={() => setWidgetOS('ios')}
          >
            🍎 iOS 18+ Liquid Glass (5 Widgets)
          </button>
          <button
            className={`widget-tab-btn ${widgetOS === 'android' ? 'active' : ''}`}
            onClick={() => setWidgetOS('android')}
          >
            🤖 Android 16 M3 Expressive (5 Widgets)
          </button>
        </div>
      </div>

      {widgetOS === 'ios' ? (
        /* =========================================================
           IOS 18+ LIQUID GLASS WIDGET GALLERY (5 COMPLETE WIDGETS)
           ========================================================= */
        <div className="widgets-gallery ios-gallery">
          {/* 1. iOS SMALL (2x2) POD SYNC RING */}
          <div className="widget-showcase-item">
            <div className="widget-label-row">
              <span className="widget-type">Small (2×2)</span>
              <span className="widget-name">Pod Sync Ring</span>
            </div>

            <div className="ios-widget-small">
              <div className="widget-inner-glow"></div>
              <div className="w-small-top">
                <span className="w-pair-names">{pod.user1.name} + {pod.user2.name}</span>
                <span className="w-streak">🔥 {pod.currentStreak}d</span>
              </div>

              <div className="w-small-center">
                <div className="w-mini-ring">
                  <svg width="68" height="68" viewBox="0 0 68 68">
                    <circle cx="34" cy="34" r="28" stroke="rgba(255,255,255,0.12)" strokeWidth="6" fill="none" />
                    <circle
                      cx="34"
                      cy="34"
                      r="28"
                      stroke="var(--user1-color)"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={2 * Math.PI * 28}
                      strokeDashoffset={2 * Math.PI * 28 * (1 - currentPercent / 100)}
                      strokeLinecap="round"
                      transform="rotate(-90 34 34)"
                    />
                  </svg>
                  <div className="w-ring-text">
                    <span className="w-pct font-bold">{currentPercent}%</span>
                  </div>
                </div>
              </div>

              <div className="w-small-footer">
                <span className="w-sub-label">{inSyncGoalsCount} in sync</span>
                <button
                  className="w-interactive-tap"
                  onClick={() => updateHabit('water', activeUserId, 1)}
                  title="Quick tap to log water"
                >
                  +1💧
                </button>
              </div>
            </div>
          </div>

          {/* 2. iOS MEDIUM (4x2) SHARED POD PROGRESS */}
          <div className="widget-showcase-item">
            <div className="widget-label-row">
              <span className="widget-type">Medium (4×2)</span>
              <span className="widget-name">Shared Pod Progress</span>
            </div>

            <div className="ios-widget-medium">
              <div className="w-medium-left">
                <div className="w-pod-badge">
                  <span className="badge-dot pulse-mint"></span>
                  <span className="font-bold">DayByDay Pod</span>
                </div>
                <div className="w-big-percent">{currentPercent}%</div>
                <div className="w-status-sub">
                  {pod.healthStatus} · {inSyncGoalsCount} matching
                </div>
                <div className="w-quick-actions">
                  <button
                    className="w-action-chip"
                    onClick={() => updateHabit('steps', activeUserId, 500)}
                  >
                    +500 👟
                  </button>
                  <button
                    className="w-action-chip"
                    onClick={() => updateHabit('water', activeUserId, 1)}
                  >
                    +1 💧
                  </button>
                </div>
              </div>

              <div className="w-medium-right">
                <div className="w-progress-item">
                  <div className="w-item-header">
                    <span>👟 Steps</span>
                    <span className="w-item-val">{stepsHabit.user1 + stepsHabit.user2}</span>
                  </div>
                  <div className="w-mini-bar-track">
                    <div
                      className="w-bar-fill u1"
                      style={{ width: `${Math.min(50, (stepsHabit.user1 / stepsHabit.target) * 50)}%` }}
                    />
                    <div
                      className="w-bar-fill u2"
                      style={{ width: `${Math.min(50, (stepsHabit.user2 / stepsHabit.target) * 50)}%` }}
                    />
                  </div>
                </div>

                <div className="w-progress-item">
                  <div className="w-item-header">
                    <span>💧 Water</span>
                    <span className="w-item-val">{waterHabit[activeUserId]} / {waterHabit.target}</span>
                  </div>
                  <div className="w-mini-bar-track">
                    <div
                      className="w-bar-fill u1"
                      style={{ width: `${(waterHabit.user1 / waterHabit.target) * 50}%` }}
                    />
                    <div
                      className="w-bar-fill u2"
                      style={{ width: `${(waterHabit.user2 / waterHabit.target) * 50}%` }}
                    />
                  </div>
                </div>

                <div className="w-partner-status-row">
                  <span className="w-ping-text">{pod.user2.name} active</span>
                  <button className="w-ping-btn" onClick={simulatePartnerActivity}>
                    ⚡ Sync
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 3. iOS BENTO DASHBOARD (4x2) */}
          <div className="widget-showcase-item">
            <div className="widget-label-row">
              <span className="widget-type">Bento Card (4×2)</span>
              <span className="widget-name">Liquid Glass Dashboard</span>
            </div>

            <div className="ios-widget-bento">
              <div className="ios-bento-header">
                <div className="w-pod-badge">
                  <span className="badge-dot pulse-mint"></span>
                  <span className="font-bold">Pod: {pod.code}</span>
                  <span className="ios-streak-pill">🔥 {pod.currentStreak}d</span>
                </div>
                <span className="ios-health-tag">THRIVING</span>
              </div>

              <div className="ios-bento-grid">
                <div className="ios-tile">
                  <span className="ios-tile-lbl">Steps Total</span>
                  <span className="ios-tile-val font-bold">
                    {(stepsHabit.user1 + stepsHabit.user2).toLocaleString()}
                  </span>
                  <button
                    className="ios-tile-btn"
                    onClick={() => updateHabit('steps', activeUserId, 1000)}
                  >
                    +1k 👟
                  </button>
                </div>

                <div className="ios-tile">
                  <span className="ios-tile-lbl">Vitamins</span>
                  <span className="ios-tile-val">
                    {vitaminsHabit[activeUserId] ? 'Checked ✓' : 'Pending ○'}
                  </span>
                  <button
                    className={`ios-tile-btn ${vitaminsHabit[activeUserId] ? 'active' : ''}`}
                    onClick={() => updateHabit('vitamins', activeUserId, !vitaminsHabit[activeUserId], true)}
                  >
                    {vitaminsHabit[activeUserId] ? 'Undo' : 'Check'}
                  </button>
                </div>

                <div className="ios-tile">
                  <span className="ios-tile-lbl">Simulate</span>
                  <span className="ios-tile-val">{pod.user2.name}</span>
                  <button className="ios-tile-btn accent" onClick={simulatePartnerActivity}>
                    ⚡ Ping
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 4. iOS SCALLOPED ORGANIC SHAPE (2x2) */}
          <div className="widget-showcase-item">
            <div className="widget-label-row">
              <span className="widget-type">Organic Glass (2×2)</span>
              <span className="widget-name">Scalloped Pod Meter</span>
            </div>

            <div className="ios-widget-scallop">
              <div className="ios-scallop-inner">
                <div className="ios-scallop-header">
                  <span>🎯</span>
                  <span className="font-bold">Sync</span>
                </div>
                <div className="ios-scallop-number font-bold">{currentPercent}%</div>
                <div className="ios-scallop-sub">In Sync Today</div>
                <button
                  className="ios-fab-mini"
                  onClick={() => updateHabit('water', activeUserId, 1)}
                  title="Interactive Tap"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* 5. iOS LOCK SCREEN MINIMAL WIDGET */}
          <div className="widget-showcase-item">
            <div className="widget-label-row">
              <span className="widget-type">Lock Screen (Inline)</span>
              <span className="widget-name">Glanceable Pod Pill</span>
            </div>

            <div className="ios-lock-screen-widget">
              <div className="lock-widget-pill">
                <span className="lock-icon">⚡</span>
                <span className="lock-names">{pod.user1.name} + {pod.user2.name}:</span>
                <span className="lock-val font-bold">{currentPercent}% Sync</span>
                <span className="lock-streak">🔥 {pod.currentStreak}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* =========================================================
           ANDROID 16 M3 EXPRESSIVE WIDGET GALLERY (5 COMPLETE WIDGETS)
           ========================================================= */
        <div className="widgets-gallery android-gallery">
          {/* 1. ANDROID M3 SMALL (2x2) POD SYNC RING */}
          <div className="widget-showcase-item">
            <div className="widget-label-row">
              <span className="widget-type">M3 Small (2×2)</span>
              <span className="widget-name">Pod Sync Ring</span>
            </div>

            <div className="m3-widget-small">
              <div className="m3-small-top">
                <span className="m3-pair-names font-bold">{pod.user1.name} + {pod.user2.name}</span>
                <span className="m3-streak-chip">🔥 {pod.currentStreak}d</span>
              </div>

              <div className="m3-small-center">
                <div className="w-mini-ring">
                  <svg width="68" height="68" viewBox="0 0 68 68">
                    <circle cx="34" cy="34" r="28" stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" />
                    <circle
                      cx="34"
                      cy="34"
                      r="28"
                      stroke="#4FE0B5"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={2 * Math.PI * 28}
                      strokeDashoffset={2 * Math.PI * 28 * (1 - currentPercent / 100)}
                      strokeLinecap="round"
                      transform="rotate(-90 34 34)"
                    />
                  </svg>
                  <div className="w-ring-text">
                    <span className="m3-pct font-bold">{currentPercent}%</span>
                  </div>
                </div>
              </div>

              <div className="m3-small-footer">
                <span className="m3-sub-label">{inSyncGoalsCount} goals in sync</span>
                <button
                  className="m3-interactive-tap"
                  onClick={() => updateHabit('water', activeUserId, 1)}
                  title="Quick tap to log water"
                >
                  +1💧
                </button>
              </div>
            </div>
          </div>

          {/* 2. ANDROID M3 MEDIUM (4x2) SHARED POD PROGRESS */}
          <div className="widget-showcase-item">
            <div className="widget-label-row">
              <span className="widget-type">M3 Medium (4×2)</span>
              <span className="widget-name">Shared Pod Progress</span>
            </div>

            <div className="m3-widget-medium">
              <div className="m3-medium-left">
                <div className="m3-pod-badge">
                  <span className="badge-dot pulse-mint"></span>
                  <span className="font-bold">M3 Pod</span>
                </div>
                <div className="m3-big-percent font-bold">{currentPercent}%</div>
                <div className="m3-status-sub">
                  {pod.healthStatus} · {inSyncGoalsCount} in sync
                </div>
                <div className="m3-quick-actions">
                  <button
                    className="m3-action-chip"
                    onClick={() => updateHabit('steps', activeUserId, 500)}
                  >
                    +500 👟
                  </button>
                  <button
                    className="m3-action-chip"
                    onClick={() => updateHabit('water', activeUserId, 1)}
                  >
                    +1 💧
                  </button>
                </div>
              </div>

              <div className="m3-medium-right">
                <div className="m3-progress-item">
                  <div className="m3-item-header">
                    <span>👟 Steps</span>
                    <span className="m3-item-val font-bold">{stepsHabit.user1 + stepsHabit.user2}</span>
                  </div>
                  <div className="m3-mini-bar-track">
                    <div
                      className="m3-bar-fill u1"
                      style={{ width: `${Math.min(50, (stepsHabit.user1 / stepsHabit.target) * 50)}%` }}
                    />
                    <div
                      className="m3-bar-fill u2"
                      style={{ width: `${Math.min(50, (stepsHabit.user2 / stepsHabit.target) * 50)}%` }}
                    />
                  </div>
                </div>

                <div className="m3-progress-item">
                  <div className="m3-item-header">
                    <span>💧 Water</span>
                    <span className="m3-item-val font-bold">{waterHabit[activeUserId]} / {waterHabit.target}</span>
                  </div>
                  <div className="m3-mini-bar-track">
                    <div
                      className="m3-bar-fill u1"
                      style={{ width: `${(waterHabit.user1 / waterHabit.target) * 50}%` }}
                    />
                    <div
                      className="m3-bar-fill u2"
                      style={{ width: `${(waterHabit.user2 / waterHabit.target) * 50}%` }}
                    />
                  </div>
                </div>

                <div className="m3-partner-status-row">
                  <span className="m3-ping-text">{pod.user2.name} active</span>
                  <button className="m3-ping-btn" onClick={simulatePartnerActivity}>
                    ⚡ Sync
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 3. ANDROID M3 BENTO DASHBOARD (4x2) */}
          <div className="widget-showcase-item">
            <div className="widget-label-row">
              <span className="widget-type">M3 Bento Card (4×2)</span>
              <span className="widget-name">Tonal Expressive Dashboard</span>
            </div>

            <div className="m3-widget-bento">
              <div className="m3-bento-header">
                <div className="m3-pod-title">
                  <span className="m3-chip-pill">Pod: {pod.code}</span>
                  <span className="m3-streak-pill">🔥 {pod.currentStreak} Days</span>
                </div>
                <span className="m3-health-tag">THRIVING</span>
              </div>

              <div className="m3-bento-row">
                <div className="m3-metric-tile">
                  <span className="m3-tile-lbl">Steps Total</span>
                  <span className="m3-tile-val font-bold">
                    {(stepsHabit.user1 + stepsHabit.user2).toLocaleString()}
                  </span>
                  <button
                    className="m3-pill-btn"
                    onClick={() => updateHabit('steps', activeUserId, 1000)}
                  >
                    +1k Steps
                  </button>
                </div>

                <div className="m3-metric-tile">
                  <span className="m3-tile-lbl">Vitamins</span>
                  <span className="m3-tile-val">
                    {vitaminsHabit[activeUserId] ? 'Checked ✓' : 'Pending ○'}
                  </span>
                  <button
                    className={`m3-pill-btn ${vitaminsHabit[activeUserId] ? 'active' : ''}`}
                    onClick={() => updateHabit('vitamins', activeUserId, !vitaminsHabit[activeUserId], true)}
                  >
                    {vitaminsHabit[activeUserId] ? 'Undo' : 'Check'}
                  </button>
                </div>

                <div className="m3-metric-tile">
                  <span className="m3-tile-lbl">Simulate</span>
                  <span className="m3-tile-val">{pod.user2.name}</span>
                  <button className="m3-pill-btn accent" onClick={simulatePartnerActivity}>
                    ⚡ Ping
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 4. ANDROID M3 SCALLOPED FLOWER WIDGET (2x2) */}
          <div className="widget-showcase-item">
            <div className="widget-label-row">
              <span className="widget-type">M3 Expressive Shape (2×2)</span>
              <span className="widget-name">Scalloped Pod Meter</span>
            </div>

            <div className="m3-widget-scallop">
              <div className="m3-scallop-inner">
                <div className="m3-scallop-header">
                  <span className="m3-icon">🎯</span>
                  <span className="m3-badge">M3 Today</span>
                </div>
                <div className="m3-scallop-number font-bold">{currentPercent}%</div>
                <div className="m3-scallop-sub">In Sync</div>
                <button
                  className="m3-fab-mini"
                  onClick={() => updateHabit('water', activeUserId, 1)}
                  title="Interactive M3 Floating Action Button"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* 5. ANDROID M3 AT-A-GLANCE LOCK SCREEN PILL */}
          <div className="widget-showcase-item">
            <div className="widget-label-row">
              <span className="widget-type">At a Glance (Lock Screen)</span>
              <span className="widget-name">M3 Expressive Pill Chip</span>
            </div>

            <div className="m3-lock-screen-widget">
              <div className="m3-lock-pill">
                <span className="m3-lock-icon">🎯</span>
                <span className="m3-lock-names">{pod.user1.name} + {pod.user2.name}:</span>
                <span className="m3-lock-val font-bold">{currentPercent}% In Sync</span>
                <span className="m3-lock-streak">🔥 {pod.currentStreak}d</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
