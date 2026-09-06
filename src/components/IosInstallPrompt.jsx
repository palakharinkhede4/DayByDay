import React, { useState, useEffect } from 'react';
import { Share, X, PlusSquare } from 'lucide-react';

export const IosInstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect iOS
    const ua = window.navigator.userAgent || '';
    const isIos = /iPhone|iPad|iPod/i.test(ua);

    // Detect standalone / already installed mode
    const isStandalone =
      window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean(window.Capacitor?.isNativePlatform?.());

    // Check if dismissed before
    const isDismissed = localStorage.getItem('daybyday_ios_prompt_dismissed') === 'true';

    if (isIos && !isStandalone && !isDismissed) {
      // Small timeout so it smoothly animates in after initial load
      const timer = setTimeout(() => setShowPrompt(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('daybyday_ios_prompt_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="ios-install-overlay" role="dialog" aria-modal="true">
      <div className="ios-install-card">
        <button
          className="ios-prompt-close-btn"
          onClick={handleDismiss}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="ios-prompt-header">
          <div className="ios-prompt-icon-badge">
            <Share size={22} className="ios-share-glyph" />
          </div>
          <div className="ios-prompt-title-group">
            <h3 className="ios-prompt-title">Add to Home Screen</h3>
            <p className="ios-prompt-subtitle">Enjoy DayByDay fullscreen without browser bars</p>
          </div>
        </div>

        <div className="ios-prompt-steps">
          <div className="ios-step-row">
            <span className="step-num">1</span>
            <span>Open in <strong>Safari</strong> on your iPhone</span>
          </div>
          <div className="ios-step-row">
            <span className="step-num">2</span>
            <span>Tap the <strong>Share</strong> button <Share size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></span>
          </div>
          <div className="ios-step-row">
            <span className="step-num">3</span>
            <span>Scroll down and select <strong>"Add to Home Screen"</strong> <PlusSquare size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></span>
          </div>
        </div>

        <button className="ios-prompt-action-btn font-bold" onClick={handleDismiss}>
          Got it
        </button>
      </div>
    </div>
  );
};
