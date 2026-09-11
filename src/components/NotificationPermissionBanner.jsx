import React, { useState, useEffect } from 'react';
import { useHabits } from '../context/HabitContext';
import { sound } from '../utils/sound';
import { BellRing, Share2, X, Check, Sparkles, BatteryCharging } from 'lucide-react';
import { isAndroidNativeApp } from '../utils/updateChecker';
import { isBatteryOptimizationIgnored, requestIgnoreBatteryOptimization } from '../utils/notifications';

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
  const [showBatteryOpt, setShowBatteryOpt] = useState(false);
  const [batteryHandled, setBatteryHandled] = useState(false);

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

    const checkStatus = async () => {
      const currentStatus = getNotificationPermissionStatus?.() || 'granted';
      setStatus(currentStatus);

      if (currentStatus === 'default' || (isIosSafariBrowser?.() && currentStatus !== 'granted')) {
        setDismissed(false);
        setShowBatteryOpt(false);
        return;
      }

      // If notifications already granted on Android, check if battery optimization is restricting reminders
      if (currentStatus === 'granted' && isAndroidNativeApp()) {
        try {
          const ignored = await isBatteryOptimizationIgnored();
          if (!ignored) {
            const batteryDismissed = localStorage.getItem('daybyday_battery_banner_dismissed');
            if (!batteryDismissed || (Date.now() - Number(batteryDismissed) > 3 * 24 * 60 * 60 * 1000)) {
              setShowBatteryOpt(true);
              setDismissed(false);
              return;
            }
          }
        } catch {}
      }

      setDismissed(true);
    };

    checkStatus();
  }, [getNotificationPermissionStatus, isIosSafariBrowser]);

  const handleDismiss = () => {
    sound.tap();
    setDismissed(true);
    try {
      if (showBatteryOpt) {
        localStorage.setItem('daybyday_battery_banner_dismissed', Date.now().toString());
      } else {
        localStorage.setItem('daybyday_notif_banner_dismissed', Date.now().toString());
      }
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
        dispatchTestNotification?.().catch(() => {});

        // On native Android, guide to battery optimization next if needed
        if (isAndroidNativeApp()) {
          const ignored = await isBatteryOptimizationIgnored();
          if (!ignored) {
            setTimeout(() => {
              setJustGranted(false);
              setShowBatteryOpt(true);
            }, 1800);
            return;
          }
        }

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

  const handleBatteryOptClick = async () => {
    sound.press();
    try {
      await requestIgnoreBatteryOptimization();
      setBatteryHandled(true);
      triggerIslandNotification?.('Battery settings opened. Choose Unrestricted for 100% reliable reminders!', 'check');
      setTimeout(() => {
        setDismissed(true);
        try {
          localStorage.setItem('daybyday_battery_banner_dismissed', Date.now().toString());
        } catch {}
      }, 3500);
    } catch (err) {
      console.warn('Battery optimization intent notice:', err);
    }
  };

  if (dismissed || (status === 'granted' && !showBatteryOpt)) {
    return null;
  }

  const isIosBrowserNotPwa = isIosSafariBrowser?.();

  return (
    <div className="notif-permission-banner animate-fade-in" role="region" aria-label="Notification Permission">
      <div className="notif-banner-content">
        <div className="notif-banner-icon-wrap">
          {batteryHandled ? (
            <Check size={20} className="text-emerald-400" />
          ) : showBatteryOpt ? (
            <BatteryCharging size={20} className="text-emerald-400 animate-pulse" />
          ) : justGranted ? (
            <Check size={20} className="text-emerald-400" />
          ) : isIosBrowserNotPwa ? (
            <Share2 size={20} className="text-blue-400" />
          ) : (
            <BellRing size={20} className="text-amber-400 animate-bounce-subtle" />
          )}
        </div>

        <div className="notif-banner-text">
          {batteryHandled ? (
            <>
              <h4 className="notif-banner-title text-emerald-400 font-bold">Background Reminders Configured!</h4>
              <p className="notif-banner-desc">Reminders will now pop up with heads-up banners on your lock screen.</p>
            </>
          ) : showBatteryOpt ? (
            <>
              <h4 className="notif-banner-title text-emerald-400 font-bold">Lock Screen Reminders (Android)</h4>
              <p className="notif-banner-desc">Disable battery optimization so reminders pop up reliably on your lock screen at the exact minute.</p>
            </>
          ) : justGranted ? (
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
          {showBatteryOpt && !batteryHandled ? (
            <button
              type="button"
              className="notif-enable-btn font-bold"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
              onClick={handleBatteryOptClick}
            >
              <BatteryCharging size={14} />
              <span>Disable Optimization</span>
            </button>
          ) : !justGranted && !isIosBrowserNotPwa && !batteryHandled ? (
            <button
              type="button"
              className="notif-enable-btn font-bold"
              onClick={handleEnable}
              disabled={isEnabling}
            >
              <Sparkles size={14} />
              <span>{isEnabling ? 'Enabling...' : 'Enable'}</span>
            </button>
          ) : null}

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
