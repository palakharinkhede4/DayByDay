import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Activity,
  Copy,
  Check,
  Heart,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { sound } from '../utils/sound';
import { getApiBaseUrl } from '../utils/api';

export const IosHealthSetupGuide = ({
  isOpen,
  onClose,
  userSecretCode,
  onManualEntry,
  currentHealthData,
}) => {
  const [copiedKey, setCopiedKey] = useState(null);
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' front-and-center, or 'shortcut'

  // Manual form state
  const [manualSteps, setManualSteps] = useState(() => currentHealthData?.steps || '');
  const [manualCalories, setManualCalories] = useState(() => currentHealthData?.calories || '');
  const [manualDistance, setManualDistance] = useState(() => currentHealthData?.distanceKm || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const secretCode = userSecretCode || 'DBD-1000';
  const apiBase = getApiBaseUrl();
  
  // Fast 1-action sync link prefilled with user's private code
  const syncLink = `${apiBase}/api/user?action=health_sync&secretCode=${encodeURIComponent(secretCode)}&steps=`;

  const handleCopy = async (text, key) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedKey(key);
      sound.tap();
      setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      // clipboard fallback
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const steps = Math.max(0, parseInt(manualSteps, 10) || 0);
    if (!steps && !manualCalories && !manualDistance) return;

    setIsSubmitting(true);
    try {
      const calories = Math.max(0, parseInt(manualCalories, 10) || Math.round(steps * 0.04));
      const distanceKm = Math.max(
        0,
        parseFloat(manualDistance) || Math.round(steps * 0.000762 * 100) / 100
      );
      await onManualEntry?.({ steps, calories, distanceKm });
      sound.complete();
      onClose();
    } catch (err) {
      console.warn('Manual health entry error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ios-health-backdrop" onClick={onClose}>
      <div className="ios-health-modal" onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className="ios-health-header">
          <div className="ios-health-header-left">
            <div className="ios-health-icon-badge">
              <Heart size={22} />
            </div>
            <div>
              <h3 className="ios-health-title">Apple Health Sync</h3>
              <span className="ios-health-subtitle">Sync your steps on iPhone</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sound.press();
              onClose();
            }}
            aria-label="Close"
            className="ios-health-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* PRIVACY GUARANTEE BANNER */}
        <div className="ios-health-privacy">
          <ShieldCheck size={20} color="#10B981" style={{ flexShrink: 0 }} />
          <div>
            <span className="ios-health-privacy-title">100% Private to your account</span>
            <span className="ios-health-privacy-desc">
              Protected by code <strong>{secretCode}</strong>. Your steps are only saved to your personal profile.
            </span>
          </div>
        </div>

        {/* TAB SWITCHER */}
        <div className="ios-health-tabs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('manual');
              sound.tap();
            }}
            className={`ios-health-tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
          >
            <Activity size={15} />
            <span>Quick Log</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('shortcut');
              sound.tap();
            }}
            className={`ios-health-tab-btn ${activeTab === 'shortcut' ? 'active' : ''}`}
          >
            <Smartphone size={15} />
            <span>Automate (Shortcuts)</span>
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="ios-health-body">
          {activeTab === 'manual' ? (
            /* MANUAL LOG TAB — FRONT AND CENTER */
            <form onSubmit={handleManualSubmit} className="ios-health-form">
              <span className="ios-health-step-desc">
                Log your steps for today directly. Open your iPhone's <strong>Fitness</strong> or <strong>Health</strong> app to see your current count:
              </span>

              {/* STEPS INPUT */}
              <div>
                <label className="ios-health-label">
                  👣 Today's Steps
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 8500"
                  value={manualSteps}
                  onChange={(e) => setManualSteps(e.target.value)}
                  className="ios-health-input"
                  autoFocus
                />
              </div>

              {/* CALORIES INPUT */}
              <div>
                <label className="ios-health-label">
                  🔥 Active Calories (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Auto-calculated if left blank"
                  value={manualCalories}
                  onChange={(e) => setManualCalories(e.target.value)}
                  className="ios-health-input"
                />
              </div>

              {/* DISTANCE INPUT */}
              <div>
                <label className="ios-health-label">
                  📍 Distance in km (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Auto-calculated if left blank"
                  value={manualDistance}
                  onChange={(e) => setManualDistance(e.target.value)}
                  className="ios-health-input"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || (!manualSteps && !manualCalories && !manualDistance)}
                className="ios-health-submit-btn"
              >
                <Sparkles size={16} />
                {isSubmitting ? 'Saving Activity...' : 'Save Steps to Habits'}
              </button>
            </form>
          ) : (
            /* AUTOMATION SHORTCUT TAB — DEAD SIMPLE & ZERO TECHNICAL JARGON */
            <>
              <span className="ios-health-step-desc">
                Apple requires web apps to sync through Apple's free <strong>Shortcuts</strong> app. Follow these 4 easy steps once:
              </span>

              {/* STEP 1 */}
              <div className="ios-health-step-card">
                <div className="ios-health-step-num">1</div>
                <div>
                  <span className="ios-health-step-title">Open the Shortcuts App</span>
                  <span className="ios-health-step-desc">
                    Open the pre-installed <strong>Shortcuts</strong> app on your iPhone and tap <strong>+</strong> in the top-right corner.
                  </span>
                </div>
              </div>

              {/* STEP 2 */}
              <div className="ios-health-step-card">
                <div className="ios-health-step-num">2</div>
                <div>
                  <span className="ios-health-step-title">Add "Find Health Samples"</span>
                  <span className="ios-health-step-desc">
                    Tap <strong>Add Action</strong>, search for <strong>Find Health Samples</strong>, and set Type to <strong>Steps</strong> and Date to <strong>Today</strong>.
                  </span>
                </div>
              </div>

              {/* STEP 3 */}
              <div className="ios-health-step-card">
                <div className="ios-health-step-num">3</div>
                <div>
                  <span className="ios-health-step-title">Add "Calculate Statistics"</span>
                  <span className="ios-health-step-desc">
                    Search for <strong>Calculate Statistics</strong> and choose <strong>Sum</strong>. This adds up all your steps today.
                  </span>
                </div>
              </div>

              {/* STEP 4 */}
              <div className="ios-health-step-card">
                <div className="ios-health-step-num">4</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="ios-health-step-title">Add "Get Contents of URL"</span>
                  <span className="ios-health-step-desc">
                    Search for <strong>Get Contents of URL</strong> and paste your personal sync link below. Then tap after <strong>steps=</strong> and select your <strong>Statistics Result</strong>:
                  </span>

                  <div className="ios-health-link-box">
                    <span className="ios-health-link-code">
                      {syncLink}[Statistics Result]
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(syncLink, 'url')}
                      className={`ios-health-copy-btn ${copiedKey === 'url' ? 'copied' : ''}`}
                    >
                      {copiedKey === 'url' ? (
                        <>
                          <Check size={13} /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={13} /> Copy Link
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* STEP 5 */}
              <div className="ios-health-step-card">
                <div className="ios-health-step-num">5</div>
                <div>
                  <span className="ios-health-step-title">Run Automatically (Optional)</span>
                  <span className="ios-health-step-desc">
                    In Shortcuts, go to the <strong>Automation</strong> tab → <strong>New Automation</strong> → <strong>Time of Day</strong> (e.g. 8:00 PM) → select this shortcut. Your steps will sync automatically every evening!
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="ios-health-footer">
          <button
            type="button"
            onClick={() => {
              sound.tap();
              onClose();
            }}
            className="ios-health-done-btn"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
