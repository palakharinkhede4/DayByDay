import React, { useState } from 'react';
import { useHabits } from '../context/HabitContext';
import { DynamicIslandHud } from './DynamicIslandHud';

export const PhoneFrame = ({ children }) => {
  const { osMode, viewMode } = useHabits();

  // Check if running on a real mobile phone or native Capacitor container
  const isRealMobile = typeof window !== 'undefined' && (
    window.innerWidth <= 640 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    Boolean(window.Capacitor?.isNativePlatform?.())
  );

  const isFrame = viewMode === 'frame' && !isRealMobile;

  return (
    <div className={`app-viewport ${isFrame ? 'frame-mode' : 'fullscreen-mode'} ${isRealMobile ? 'native-mobile' : ''}`}>
      <div className={`phone-chassis ${osMode} ${isRealMobile ? 'device-native' : ''}`}>
        {/* Physical hardware frame buttons for desktop mockup view only */}
        {isFrame && (
          <>
            <div className="hardware-btn silent-switch"></div>
            <div className="hardware-btn volume-up"></div>
            <div className="hardware-btn volume-down"></div>
            <div className="hardware-btn power-btn"></div>
          </>
        )}

        <div className="screen-container">
          {/* Mock Status Bar only rendered in desktop mockup mode */}
          {!isRealMobile && (
            osMode === 'ios' ? (
            <div className="ios-status-bar">
              <span className="status-time">10:52</span>

              {/* DYNAMIC ISLAND */}
              <DynamicIslandHud isDesktopMockup={true} />

              <div className="status-icons-ios">
                <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
                  <path d="M1 11h2V8H1v3zm4 0h2V5H5v6zm4 0h2V3H9v8zm4 0h2V1h-2v10z" />
                </svg>
                <span className="status-cell">5G</span>
                <div className="ios-battery">
                  <div className="battery-level" style={{ width: '85%' }}></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="android-status-bar">
              <div className="android-status-left">
                <span className="status-time">10:52</span>
                <span className="android-notif-glyph">💬</span>
                <span className="android-notif-glyph">🎯</span>
              </div>

              <div className="android-camera-punch"></div>

              <div className="android-status-right">
                <svg width="15" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98C20.93 5.9 16.69 4 12 4z" />
                </svg>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 22h20V2L2 22z" />
                </svg>
                <div className="android-battery-pill">
                  <span>94%</span>
                </div>
              </div>
            </div>
          ))}

          {/* INNER APP CONTENT SCROLLER */}
          <main className="screen-content">
            {children}
          </main>

          {/* OS SPECIFIC BOTTOM NAVIGATION GESTURE INDICATOR (Mockup View Only) */}
          {!isRealMobile && (
            osMode === 'ios' ? (
              <div className="ios-home-indicator-area">
                <div className="ios-home-bar"></div>
              </div>
            ) : (
              <div className="android-nav-indicator-area">
                <div className="android-gesture-pill"></div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
