import React, { useState } from 'react';
import { useHabits } from '../context/HabitContext';

const PRESET_SECURITY_QUESTIONS = [
  'What was the name of your first childhood pet?',
  'In what city or town were you born?',
  'What was the name of your first elementary school?',
  'What is the title of your favorite book or movie?',
  'What was the make and model of your first car?',
  'What was your childhood nickname?',
  'Custom question...',
];

export const OnboardingModal = () => {
  const { user, isSessionRestoring, registerUser, loginUser, getSecurityQuestion, resetPassword, pairWithPartner } = useHabits();

  // Mode: 'login' | 'register' | 'forgot'
  const [mode, setMode] = useState('login');

  // Common fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [partnerCode, setPartnerCode] = useState('');
  const [hasPartnerCode, setHasPartnerCode] = useState(false);

  // Security question & recovery
  const [securityQuestion, setSecurityQuestion] = useState(PRESET_SECURITY_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [recoveredQuestion, setRecoveredQuestion] = useState('');
  const [recoveryStep, setRecoveryStep] = useState(1); // 1 = enter username, 2 = answer question & new password
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // If session is restoring from IndexedDB Vault, or user is already authenticated, do not show modal
  if (isSessionRestoring || (user && user.username)) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername) {
      setError('Please enter your username');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await loginUser(cleanUsername, password);
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (cleanUsername.length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const finalQuestion = securityQuestion === 'Custom question...' ? customQuestion.trim() : securityQuestion;
    if (!finalQuestion) {
      setError('Please choose or enter a security question');
      return;
    }
    if (!securityAnswer.trim()) {
      setError('Please provide an answer to your security question');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await registerUser(
        cleanUsername,
        password,
        displayName.trim() || cleanUsername,
        '🌱',
        finalQuestion,
        securityAnswer.trim()
      );

      if (hasPartnerCode && partnerCode.trim()) {
        try {
          await pairWithPartner(partnerCode.trim().toUpperCase());
        } catch {
          // Can be paired later in settings
        }
      }
    } catch (err) {
      setError(err.message || 'Error creating account');
    } finally {
      setLoading(false);
    }
  };

  const handleFindAccountForRecovery = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername) {
      setError('Please enter your username');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getSecurityQuestion(cleanUsername);
      if (res && res.securityQuestion) {
        setRecoveredQuestion(res.securityQuestion);
        setRecoveryStep(2);
      }
    } catch (err) {
      setError(err.message || 'Account not found or no security question set');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!securityAnswer.trim()) {
      setError('Please answer the security question');
      return;
    }
    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await resetPassword(cleanUsername, securityAnswer.trim(), newPassword);
      setSuccessMsg('Password reset successfully! Signing in...');
      setTimeout(async () => {
        try {
          await loginUser(cleanUsername, newPassword);
        } catch {
          setMode('login');
          setSuccessMsg('Password reset! Please sign in with your new password.');
        }
      }, 1000);
    } catch (err) {
      setError(err.message || 'Incorrect security answer or error resetting password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card auth-card">
        {/* Auth Mode Header Tabs */}
        {mode !== 'forgot' ? (
          <div className="auth-tabs-row">
            <button
              type="button"
              className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setMode('login');
                setError(null);
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
              onClick={() => {
                setMode('register');
                setError(null);
              }}
            >
              Create Account
            </button>
          </div>
        ) : (
          <div className="auth-recovery-header">
            <button
              type="button"
              className="recovery-back-btn"
              onClick={() => {
                setMode('login');
                setRecoveryStep(1);
                setError(null);
                setSuccessMsg(null);
              }}
            >
              ← Back to Sign In
            </button>
            <span className="auth-pill-tag">PASSWORD RECOVERY</span>
          </div>
        )}

        <div className="auth-card-title-group">
          <h2 className="onboarding-title">
            {mode === 'login' && 'Sign In to DayByDay'}
            {mode === 'register' && 'Create Your Account'}
            {mode === 'forgot' && 'Reset Your Password'}
          </h2>
          <p className="onboarding-desc">
            {mode === 'login' && 'Enter your username and password to access your habits.'}
            {mode === 'register' && 'Protect your habits with a secure password and recovery question.'}
            {mode === 'forgot' &&
              (recoveryStep === 1
                ? 'Enter your username to retrieve your security question.'
                : 'Answer your question to set a new password.')}
          </p>
        </div>

        {error && <div className="onboarding-error-box">{error}</div>}
        {successMsg && <div className="onboarding-success-box">{successMsg}</div>}

        {/* 1. SIGN IN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="onboarding-form">
            <div className="form-group">
              <label className="form-label">Username</label>
              <div className="input-with-at">
                <span className="at-prefix">@</span>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  maxLength={32}
                  className="onboarding-input"
                />
              </div>
            </div>

            <div className="form-group">
              <div className="password-label-row">
                <label className="form-label">Password</label>
                <button
                  type="button"
                  className="forgot-link-btn"
                  onClick={() => {
                    setMode('forgot');
                    setRecoveryStep(1);
                    setError(null);
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="onboarding-input password-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="onboarding-submit-btn"
            >
              {loading ? 'Verifying...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* 2. REGISTER / CREATE ACCOUNT FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="onboarding-form">
            <div className="form-group">
              <label className="form-label">Choose a Unique Username</label>
              <div className="input-with-at">
                <span className="at-prefix">@</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. palak"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  maxLength={32}
                  className="onboarding-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Display Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Palak"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
                className="onboarding-input boxed-input"
              />
            </div>

            <div className="form-row-two">
              <div className="form-group half">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Min. 4 chars"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="onboarding-input boxed-input"
                />
              </div>
              <div className="form-group half">
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  required
                  placeholder="Confirm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="onboarding-input boxed-input"
                />
              </div>
            </div>

            {/* SECURITY QUESTION & RECOVERY */}
            <div className="security-recovery-section">
              <span className="recovery-section-title">Password Recovery Question</span>
              <span className="form-hint">Used to securely recover your account if you forget your password.</span>

              <div className="form-group">
                <select
                  value={securityQuestion}
                  onChange={(e) => setSecurityQuestion(e.target.value)}
                  className="onboarding-select"
                >
                  {PRESET_SECURITY_QUESTIONS.map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>

              {securityQuestion === 'Custom question...' && (
                <div className="form-group">
                  <input
                    type="text"
                    required
                    placeholder="Enter your custom security question"
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    className="onboarding-input boxed-input"
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Your Answer</label>
                <input
                  type="text"
                  required
                  placeholder="Answer (case-insensitive)"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  className="onboarding-input boxed-input"
                />
              </div>
            </div>

            {/* OPTIONAL PARTNER CODE */}
            {!hasPartnerCode ? (
              <button
                type="button"
                className="link-toggle-btn"
                onClick={() => setHasPartnerCode(true)}
              >
                + Connect to a partner with secret code
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
                  className="onboarding-input boxed-input font-bold"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || username.trim().length < 2 || password.length < 4}
              className="onboarding-submit-btn"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* 3. FORGOT PASSWORD RECOVERY FLOW */}
        {mode === 'forgot' && (
          <div className="recovery-flow-container">
            {recoveryStep === 1 ? (
              <form onSubmit={handleFindAccountForRecovery} className="onboarding-form">
                <div className="form-group">
                  <label className="form-label">Enter Your Username</label>
                  <div className="input-with-at">
                    <span className="at-prefix">@</span>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="onboarding-input"
                    />
                  </div>
                  <span className="form-hint">We will retrieve your registered security question.</span>
                </div>

                <button
                  type="submit"
                  disabled={loading || !username.trim()}
                  className="onboarding-submit-btn"
                >
                  {loading ? 'Looking Up...' : 'Find Account'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="onboarding-form">
                <div className="recovery-question-card">
                  <span className="recovery-question-label">Security Question:</span>
                  <p className="recovery-question-prompt font-bold">{recoveredQuestion}</p>
                </div>

                <div className="form-group">
                  <label className="form-label">Your Secret Answer</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Enter your answer"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    className="onboarding-input boxed-input"
                  />
                </div>

                <div className="form-row-two">
                  <div className="form-group half">
                    <label className="form-label">New Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Min. 4 chars"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="onboarding-input boxed-input"
                    />
                  </div>
                  <div className="form-group half">
                    <label className="form-label">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Confirm"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="onboarding-input boxed-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !securityAnswer.trim() || newPassword.length < 4}
                  className="onboarding-submit-btn"
                >
                  {loading ? 'Resetting Password...' : 'Reset Password & Sign In'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
