import React, { useState, useEffect } from 'react';
import { useHabits } from '../context/HabitContext';
import { sound } from '../utils/sound';
import { BellRing, Share2, X, Check, Sparkles } from 'lucide-react';

export const NotificationPermissionBanner = () => {
  const {
    requestNotificationPermission,
    getNotificationPermissionStatus,
    isIosSafariBrowser,
    dispatchTestNotification,
    triggerIslandNotification,
    triggerCelebration,
  } = useHabits();

  const [status, setStatus] = useState('granted');
  const [dismissed, setDismissed] = useState(true);
  const [isEnabling, setIsEnabling] = useState(false);
  const [justGranted, setJustGranted] = useState(false);

  useEffect(() => {
    // Check if dismissed within last 3 days
    try {
      const lastDismissed = localStorage.getItem('daybyday_notif_banner_dismissed');
      if (lastDismissed) {
        const diffMs = Date.now() - Number(lastDismissed);
        if (diffMs < 3 * 24 * 60 * 60 * 1000) {
          setDismissed(true);
          return;
        }
      }
    } catch {}

    const currentStatus = getNotificationPermissionStatus?.() || 'granted';
    setStatus(currentStatus);
    // Only show if default (unprompted) or on iOS Safari where PWA install is needed
    if (currentStatus === 'default' || (isIosSafariBrowser?.() && currentStatus !== 'granted')) {
      setDismissed(false);
    } else {
      setDismissed(true);
    }
  }, [getNotificationPermissionStatus, isIosSafariBrowser]);

  const handleDismiss = () => {
    sound.tap();
    setDismissed(true);
    try {
      localStorage.setItem('daybyday_notif_banner_dismissed', Date.now().toString());
    } catch {}
  };

  const handleEnable = async () => {
    sound.press();
    setIsEnabling(true);
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        sound.complete();
        setJustGranted(true);
        setStatus('granted');
        triggerCelebration?.();
        triggerIslandNotification?.('Notifications enabled! 🔥', 'sparkles');
        // Dispatch test cheer confirmation
        dispatchTestNotification?.().catch(() => {});
        setTimeout(() => {
          setDismissed(true);
        }, 2500);
      } else {
        setStatus(getNotificationPermissionStatus?.() || 'denied');
      }
    } catch (err) {
      console.warn('Notification prompt notice:', err);
    } finally {
      setIsEnabling(false);
    }
  };

  if (dismissed || status === 'granted') {
    return null;
  }

  const isIosBrowserNotPwa = isIosSafariBrowser?.();

  return (
    <div className="notif-permission-banner animate-fade-in" role="region" aria-label="Notification Permission">
      <div className="notif-banner-content">
        <div className="notif-banner-icon-wrap">
          {justGranted ? (
            <Check size={20} className="text-emerald-400" />
          ) : isIosBrowserNotPwa ? (
            <Share2 size={20} className="text-blue-400" />
          ) : (
            <BellRing size={20} className="text-amber-400 animate-bounce-subtle" />
          )}
        </div>

        <div className="notif-banner-text">
          {justGranted ? (
            <>
              <h4 className="notif-banner-title text-emerald-400 font-bold">Notifications Activated!</h4>
              <p className="notif-banner-desc">You will now receive cheer alerts & daily habit reminders in real time.</p>
            </>
          ) : isIosBrowserNotPwa ? (
            <>
              <h4 className="notif-banner-title font-bold">Enable iOS Web App Alerts</h4>
              <p className="notif-banner-desc">
                To get cheer alerts on iPhone/iPad: tap Share <span className="notif-inline-icon">􀈂</span> and select <strong>Add to Home Screen</strong> <span className="notif-inline-icon">􀎶</span>.
              </p>
            </>
          ) : (
            <>
              <h4 className="notif-banner-title font-bold">Never Miss a Pod Cheer</h4>
              <p className="notif-banner-desc">Turn on notifications to get instant encouragement and daily reminders from teammates.</p>
            </>
          )}
        </div>

        <div className="notif-banner-actions">
          {!justGranted && !isIosBrowserNotPwa && (
            <button
              type="button"
              className="notif-enable-btn font-bold"
              onClick={handleEnable}
              disabled={isEnabling}
            >
              <Sparkles size={14} />
              <span>{isEnabling ? 'Enabling...' : 'Enable'}</span>
            </button>
          )}

          <button
            type="button"
            className="notif-dismiss-btn"
            onClick={handleDismiss}
            title="Dismiss notification prompt"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
