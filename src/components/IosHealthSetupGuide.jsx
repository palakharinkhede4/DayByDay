import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Activity,
  Copy,
  Check,
  Zap,
  Heart,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { sound } from '../utils/sound';

export const IosHealthSetupGuide = ({
  isOpen,
  onClose,
  userSecretCode,
  onManualEntry,
  currentHealthData,
}) => {
  const [copiedKey, setCopiedKey] = useState(null);
  const [activeTab, setActiveTab] = useState('shortcut'); // 'shortcut' | 'manual'
  const [showAdvancedPost, setShowAdvancedPost] = useState(false);

  // Manual form fields
  const [manualSteps, setManualSteps] = useState(() => currentHealthData?.steps || '');
  const [manualCalories, setManualCalories] = useState(() => currentHealthData?.calories || '');
  const [manualDistance, setManualDistance] = useState(() => currentHealthData?.distanceKm || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const secretCode = userSecretCode || 'DBD-1000';
  const apiBase = typeof window !== 'undefined' ? window.location.origin : 'https://daybyday.vercel.app';
  
  // Fast 1-action GET webhook URL prefilled with user's secret code
  const getWebhookUrl = `${apiBase}/api/user?action=health_sync&secretCode=${encodeURIComponent(secretCode)}&steps=`;

  // POST JSON body prefilled with user's secret code
  const postEndpoint = `${apiBase}/api/user`;
  const postJsonExample = JSON.stringify(
    {
      action: 'health_sync',
      secretCode: secretCode,
      healthData: {
        steps: 8500,
        calories: 340,
        distanceKm: 6.2,
        source: 'apple_health',
      },
    },
    null,
    2
  );

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
    <div
      className="manage-categories-modal-backdrop"
      onClick={onClose}
      style={{
        zIndex: 10000,
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="manage-categories-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 20,
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '1.25rem 1.25rem 0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Heart size={22} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: 'var(--text-primary, #F8FAFC)',
                  letterSpacing: '-0.02em',
                }}
              >
                Apple Health Sync
              </h3>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary, #94A3B8)',
                }}
              >
                Automate step tracking on iPhone
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sound.press();
              onClose();
            }}
            aria-label="Close"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              color: 'var(--text-secondary, #94A3B8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* PRIVACY GUARANTEE BANNER */}
        <div
          style={{
            margin: '0.75rem 1.25rem 0',
            padding: '0.65rem 0.85rem',
            borderRadius: 12,
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <ShieldCheck size={18} color="#10B981" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span
              style={{
                display: 'block',
                fontSize: '0.74rem',
                color: '#A7F3D0',
                lineHeight: 1.35,
                fontWeight: 600,
              }}
            >
              100% Private to your account
            </span>
            <span
              style={{
                display: 'block',
                fontSize: '0.68rem',
                color: 'rgba(255, 255, 255, 0.65)',
                lineHeight: 1.3,
              }}
            >
              Locked to code{' '}
              <strong style={{ color: '#FCD34D' }}>{secretCode}</strong>. Never shared or visible to anyone else.
            </span>
          </div>
        </div>

        {/* TAB SWITCHER */}
        <div
          style={{
            display: 'flex',
            padding: '0.75rem 1.25rem 0',
            gap: '0.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('shortcut');
              sound.tap();
            }}
            style={{
              flex: 1,
              padding: '0.6rem 0.5rem',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              background:
                activeTab === 'shortcut'
                  ? 'var(--primary, #3B82F6)'
                  : 'rgba(255, 255, 255, 0.05)',
              color: activeTab === 'shortcut' ? '#FFFFFF' : 'var(--text-secondary, #94A3B8)',
              transition: 'all 0.15s ease',
            }}
          >
            <Smartphone size={14} />
            Apple Shortcut (1-Min)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('manual');
              sound.tap();
            }}
            style={{
              flex: 1,
              padding: '0.6rem 0.5rem',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              background:
                activeTab === 'manual'
                  ? 'var(--primary, #3B82F6)'
                  : 'rgba(255, 255, 255, 0.05)',
              color: activeTab === 'manual' ? '#FFFFFF' : 'var(--text-secondary, #94A3B8)',
              transition: 'all 0.15s ease',
            }}
          >
            <Activity size={14} />
            Manual Log
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem 1.25rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          {activeTab === 'shortcut' ? (
            <>
              {/* INTRO NOTE */}
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary, #94A3B8)',
                  lineHeight: 1.45,
                }}
              >
                Apple requires web apps to sync via the built-in{' '}
                <strong style={{ color: '#60A5FA' }}>Shortcuts</strong> app. Once configured,
                your iPhone auto-syncs steps every evening!
              </div>

              {/* STEP 1 */}
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: 'rgba(59, 130, 246, 0.2)',
                    color: '#60A5FA',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  1
                </div>
                <div>
                  <span
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: 'var(--text-primary, #F8FAFC)',
                      display: 'block',
                      marginBottom: '0.2rem',
                    }}
                  >
                    Open Shortcuts on iPhone
                  </span>
                  <span
                    style={{
                      fontSize: '0.76rem',
                      color: 'var(--text-secondary, #94A3B8)',
                      lineHeight: 1.4,
                    }}
                  >
                    Open Apple's pre-installed <strong>Shortcuts</strong> app and tap the{' '}
                    <strong>+</strong> in the top-right corner to create a new shortcut.
                  </span>
                </div>
              </div>

              {/* STEP 2 */}
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34D399',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  2
                </div>
                <div>
                  <span
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: 'var(--text-primary, #F8FAFC)',
                      display: 'block',
                      marginBottom: '0.2rem',
                    }}
                  >
                    Add "Find Health Samples"
                  </span>
                  <span
                    style={{
                      fontSize: '0.76rem',
                      color: 'var(--text-secondary, #94A3B8)',
                      lineHeight: 1.4,
                    }}
                  >
                    Search action <strong>Find Health Samples</strong>. Set Type to{' '}
                    <strong style={{ color: '#F87171' }}>Steps</strong>, and Filter to{' '}
                    <strong>Start Date is Today</strong>.
                  </span>
                </div>
              </div>

              {/* STEP 3 */}
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: '#FBBF24',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  3
                </div>
                <div>
                  <span
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: 'var(--text-primary, #F8FAFC)',
                      display: 'block',
                      marginBottom: '0.2rem',
                    }}
                  >
                    Add "Calculate Statistics"
                  </span>
                  <span
                    style={{
                      fontSize: '0.76rem',
                      color: 'var(--text-secondary, #94A3B8)',
                      lineHeight: 1.4,
                    }}
                  >
                    Search action <strong>Calculate Statistics</strong> on Health Samples. Set Function to{' '}
                    <strong style={{ color: '#FBBF24' }}>Sum</strong>.
                  </span>
                </div>
              </div>

              {/* STEP 4 — PREFILLED URL */}
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: 12,
                  background: 'rgba(59, 130, 246, 0.05)',
                  border: '1.5px solid rgba(59, 130, 246, 0.3)',
                  display: 'flex',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: 'rgba(59, 130, 246, 0.25)',
                    color: '#60A5FA',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  4
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: 'var(--text-primary, #F8FAFC)',
                      display: 'block',
                      marginBottom: '0.2rem',
                    }}
                  >
                    Add "Get Contents of URL"
                  </span>
                  <p
                    style={{
                      margin: '0 0 0.5rem',
                      fontSize: '0.76rem',
                      color: 'var(--text-secondary, #94A3B8)',
                      lineHeight: 1.4,
                    }}
                  >
                    Add <strong>Get Contents of URL</strong> action and paste this prefilled link (tap
                    to copy). Then tap after <code style={{ color: '#34D399' }}>steps=</code> and select
                    your <strong>Statistics Result</strong> variable:
                  </p>

                  {/* PREFILLED URL BOX */}
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      borderRadius: 10,
                      padding: '0.5rem 0.65rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <code
                      style={{
                        flex: 1,
                        fontSize: '0.72rem',
                        color: '#60A5FA',
                        wordBreak: 'break-all',
                        fontFamily: 'monospace',
                      }}
                    >
                      {getWebhookUrl}[Statistics Result]
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(getWebhookUrl, 'url')}
                      style={{
                        background: copiedKey === 'url' ? '#10B981' : 'rgba(59, 130, 246, 0.2)',
                        border: 'none',
                        color: copiedKey === 'url' ? '#FFFFFF' : '#93C5FD',
                        borderRadius: 8,
                        padding: '0.35rem 0.6rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {copiedKey === 'url' ? (
                        <>
                          <Check size={12} /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={12} /> Copy Link
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* STEP 5 — AUTOMATION */}
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: 'rgba(168, 85, 247, 0.2)',
                    color: '#C084FC',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  5
                </div>
                <div>
                  <span
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: 'var(--text-primary, #F8FAFC)',
                      display: 'block',
                      marginBottom: '0.2rem',
                    }}
                  >
                    Run Automatically Every Evening (Optional)
                  </span>
                  <span
                    style={{
                      fontSize: '0.76rem',
                      color: 'var(--text-secondary, #94A3B8)',
                      lineHeight: 1.4,
                    }}
                  >
                    In Shortcuts, switch to the <strong>Automation</strong> tab → tap{' '}
                    <strong>New Automation</strong> → pick <strong>Time of Day</strong> (e.g. 8:00
                    PM) → select your shortcut. Set to <strong>Run Immediately</strong>. Done forever!
                  </span>
                </div>
              </div>

              {/* ADVANCED TOGGLE: JSON POST */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedPost(!showAdvancedPost)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-tertiary, #64748B)',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    cursor: 'pointer',
                    padding: '0.25rem 0',
                  }}
                >
                  {showAdvancedPost ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Advanced: POST method with JSON payload
                </button>

                {showAdvancedPost && (
                  <div
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.75rem',
                      borderRadius: 10,
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.4rem',
                      }}
                    >
                      <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>
                        POST URL: <code>{postEndpoint}</code>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(postJsonExample, 'json')}
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: 'none',
                          color: copiedKey === 'json' ? '#10B981' : '#94A3B8',
                          padding: '0.25rem 0.5rem',
                          borderRadius: 6,
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        {copiedKey === 'json' ? <Check size={12} /> : <Copy size={12} />}
                        {copiedKey === 'json' ? 'Copied' : 'Copy JSON'}
                      </button>
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        fontSize: '0.68rem',
                        color: '#A5F3FC',
                        fontFamily: 'monospace',
                        overflowX: 'auto',
                      }}
                    >
                      {postJsonExample}
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* MANUAL LOG TAB */
            <form
              onSubmit={handleManualSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
            >
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary, #94A3B8)',
                  lineHeight: 1.4,
                }}
              >
                Log today's activity directly. Open your iPhone's <strong>Health</strong> app to check
                your current numbers.
              </div>

              {/* STEPS INPUT */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--text-primary, #F8FAFC)',
                    marginBottom: '0.35rem',
                  }}
                >
                  👣 Today's Steps
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 8500"
                  value={manualSteps}
                  onChange={(e) => setManualSteps(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.9rem',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1.5px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-primary, #F8FAFC)',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* CALORIES INPUT */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--text-primary, #F8FAFC)',
                    marginBottom: '0.35rem',
                  }}
                >
                  🔥 Active Calories (kcal) — Optional
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Auto-calculated if left blank"
                  value={manualCalories}
                  onChange={(e) => setManualCalories(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.9rem',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1.5px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-primary, #F8FAFC)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* DISTANCE INPUT */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--text-primary, #F8FAFC)',
                    marginBottom: '0.35rem',
                  }}
                >
                  📍 Distance (km) — Optional
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Auto-calculated if left blank"
                  value={manualDistance}
                  onChange={(e) => setManualDistance(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.9rem',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1.5px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-primary, #F8FAFC)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || (!manualSteps && !manualCalories && !manualDistance)}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.85rem',
                  borderRadius: 12,
                  border: 'none',
                  background: 'var(--primary, #3B82F6)',
                  color: '#FFFFFF',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity:
                    isSubmitting || (!manualSteps && !manualCalories && !manualDistance) ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'opacity 0.15s ease',
                }}
              >
                <Sparkles size={16} />
                {isSubmitting ? 'Saving Activity...' : 'Save Activity Now'}
              </button>
            </form>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={() => {
              sound.tap();
              onClose();
            }}
            style={{
              padding: '0.55rem 1.1rem',
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: 'var(--text-primary, #F8FAFC)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
