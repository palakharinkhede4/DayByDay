import React, { useState, useEffect } from 'react';

export const IOSInstallBanner = () => {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showFullGuide, setShowFullGuide] = useState(false);

  useEffect(() => {
    // Check if device is iOS (iPhone/iPad/iPod)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    // Check if running inside Safari standalone PWA
    const isStandaloneMode = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

    setIsIOS(isIOSDevice);
    setIsStandalone(isStandaloneMode);

    const savedDismiss = sessionStorage.getItem('duotrack_ios_banner_dismissed');
    if (savedDismiss) setDismissed(true);
  }, []);

  if (!isIOS || isStandalone || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('duotrack_ios_banner_dismissed', 'true');
  };

  return (
    <aside className="ios-install-banner" aria-label="iOS installation guide">
      <div className="banner-main">
        <div className="banner-left">
          <span className="banner-icon">📲</span>
          <div className="banner-texts">
            <span className="banner-title">Install DuoTrack on iPhone</span>
            <span className="banner-desc">Tap Share &rarr; <strong>"Add to Home Screen"</strong> for full-screen mode</span>
          </div>
        </div>
        <div className="banner-actions">
          <button
            className="banner-guide-btn"
            onClick={() => setShowFullGuide((p) => !p)}
          >
            {showFullGuide ? 'Close' : 'View Steps'}
          </button>
          <button className="banner-close-btn" onClick={handleDismiss} title="Dismiss">
            ✕
          </button>
        </div>
      </div>

      {showFullGuide && (
        <div className="banner-expanded-guide">
          <div className="step-item">
            <span className="step-num">1</span>
            <span>Tap the <strong>Share</strong> button (square with arrow ⎋) at the bottom of Safari.</span>
          </div>
          <div className="step-item">
            <span className="step-num">2</span>
            <span>Scroll down and tap <strong>"Add to Home Screen"</strong>.</span>
          </div>
          <div className="step-item">
            <span className="step-num">3</span>
            <span>Tap <strong>Add</strong>. Launch from your home screen with zero browser bars!</span>
          </div>
        </div>
      )}
    </aside>
  );
};
