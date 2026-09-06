import React, { useState } from 'react';
import { useHabits } from '../context/HabitContext';

export const OnboardingModal = () => {
  const { user, registerUser, pairWithPartner } = useHabits();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [partnerCode, setPartnerCode] = useState('');
  const [hasPartnerCode, setHasPartnerCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // If user already has a username registered, don't show modal
  if (user && user.username) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim().replace(/^@/, '');
    if (cleanUsername.length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newUser = await registerUser(cleanUsername, displayName.trim() || cleanUsername);
      if (hasPartnerCode && partnerCode.trim()) {
        try {
          await pairWithPartner(partnerCode.trim().toUpperCase());
        } catch {
          // Partner pairing can be done later in settings
        }
      }
    } catch (err) {
      setError(err.message || 'Error creating profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-badge">🚀 WELCOME TO DUOTRACK</div>
        <h2 className="onboarding-title">Set Up Your Profile</h2>
        <p className="onboarding-desc">
          Track your personal habits solo, or share your secret code anytime to pair with a partner.
        </p>

        <form onSubmit={handleSubmit} className="onboarding-form">
          <div className="form-group">
            <label className="form-label">Choose a Unique @Username</label>
            <div className="input-with-at">
              <span className="at-prefix">@</span>
              <input
                type="text"
                required
                autoFocus
                placeholder="palak"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                maxLength={24}
                className="onboarding-input username-field"
              />
            </div>
            <span className="form-hint">This will be your identity and generate your secret code.</span>
          </div>

          <div className="form-group">
            <label className="form-label">Display Name (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Palak"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={32}
              className="onboarding-input"
            />
          </div>

          {!hasPartnerCode ? (
            <button
              type="button"
              className="link-toggle-btn"
              onClick={() => setHasPartnerCode(true)}
            >
              + I already have a partner's secret code
            </button>
          ) : (
            <div className="form-group partner-code-group">
              <label className="form-label">Partner's Secret Code</label>
              <input
                type="text"
                placeholder="e.g. ALEX-4821"
                value={partnerCode}
                onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                maxLength={12}
                className="onboarding-input font-bold"
              />
            </div>
          )}

          {error && <div className="onboarding-error-box">⚠️ {error}</div>}

          <button
            type="submit"
            disabled={loading || username.trim().length < 2}
            className="onboarding-submit-btn"
          >
            {loading ? 'Creating Profile...' : 'Get Started →'}
          </button>
        </form>
      </div>
    </div>
  );
};
