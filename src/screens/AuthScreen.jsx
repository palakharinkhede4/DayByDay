import React, { useState, useRef } from 'react';
import { useHabits } from '../context/HabitContext';
import {
  setApiBaseUrl,
  getApiBaseUrl,
  checkApiHealth,
  hasRemoteBackend,
  isNativePlatform,
} from '../utils/api';
import {
  Sparkles,
  Eye,
  EyeOff,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Upload,
  RefreshCw,
  Server,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Laptop,
} from 'lucide-react';

const PRESET_SECURITY_QUESTIONS = [
  'What was the name of your first childhood pet?',
  'In what city or town were you born?',
  'What was the name of your first elementary school?',
  'What is the title of your favorite book or movie?',
  'What was the make and model of your first car?',
  'What was your childhood nickname?',
  'Custom question...',
];

export const AuthScreen = () => {
  const {
    registerUser,
    loginUser,
    getSecurityQuestion,
    resetPassword,
    importData,
    osMode,
  } = useHabits();

  // Screen mode: 'login' | 'register' | 'forgot'
  const [mode, setMode] = useState('login');

  // Input states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [partnerCode, setPartnerCode] = useState('');
  const [hasPartnerCode, setHasPartnerCode] = useState(false);

  // Security question & recovery states
  const [securityQuestion, setSecurityQuestion] = useState(PRESET_SECURITY_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [recoveredQuestion, setRecoveredQuestion] = useState('');
  const [recoveryStep, setRecoveryStep] = useState(1);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Cloud server configuration drawer
  const [showServerDrawer, setShowServerDrawer] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(() => getApiBaseUrl());
  const [serverTesting, setServerTesting] = useState(false);
  const [serverStatus, setServerStatus] = useState(null); // { ok: bool, message: string }

  // Status and feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const fileInputRef = useRef(null);

  // Handle Login
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
      setError(err.message || 'Failed to sign in. Please verify your credentials.');
      // If error mentions cloud server or device, open server drawer automatically to guide user
      if (err.message && (err.message.includes('Cloud Server') || err.message.includes('not found on this device'))) {
        setShowServerDrawer(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Registration
  const handleRegister = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername || cleanUsername.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setError('Username can only contain letters, numbers, and underscores');
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
    if (!securityAnswer.trim()) {
      setError('Please answer your security recovery question');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await registerUser(
        cleanUsername,
        password,
        displayName.trim() || cleanUsername,
        'star',
        finalQuestion,
        securityAnswer.trim()
      );
    } catch (err) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Lookup Security Question
  const handleLookupQuestion = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername) {
      setError('Please enter your username');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getSecurityQuestion(cleanUsername);
      if (data && data.securityQuestion) {
        setRecoveredQuestion(data.securityQuestion);
        setRecoveryStep(2);
      } else {
        setError('No security question found for this account.');
      }
    } catch (err) {
      setError(err.message || 'Account not found.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Password Reset
  const handleResetPassword = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!securityAnswer.trim()) {
      setError('Please enter your answer');
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
      setSuccessMsg('Password reset successfully! Logging you in...');
      setTimeout(async () => {
        try {
          await loginUser(cleanUsername, newPassword);
        } catch {
          setMode('login');
          setPassword('');
        }
      }, 1000);
    } catch (err) {
      setError(err.message || 'Incorrect answer or failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  // Test & Save Cloud Server URL
  const handleTestAndSaveServer = async () => {
    const clean = serverUrlInput.trim().replace(/\/$/, '');
    setServerTesting(true);
    setServerStatus(null);
    try {
      if (!clean) {
        setApiBaseUrl('');
        setServerStatus({ ok: true, message: 'Server URL cleared (Local vault mode)' });
        return;
      }
      const health = await checkApiHealth(clean);
      if (health.ok) {
        setApiBaseUrl(clean);
        setServerStatus({
          ok: true,
          message: `Connected! Latency: ${health.latency || 25}ms`,
        });
        setError(null);
      } else {
        setServerStatus({
          ok: false,
          message: health.message || 'Could not reach server. Verify URL and try again.',
        });
      }
    } catch (err) {
      setServerStatus({
        ok: false,
        message: err.message || 'Network error reaching server',
      });
    } finally {
      setServerTesting(false);
    }
  };

  // Handle JSON Backup File Import (for seamless transfer from PC web to mobile)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        const res = importData(text);
        if (res.success) {
          setSuccessMsg('Account and habits restored! Welcome back!');
        } else {
          setError(res.error || 'Invalid backup file format');
        }
      } catch {
        setError('Failed to read backup file');
      }
    };
    reader.readAsText(file);
  };

  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? `v${__APP_VERSION__}` : 'v1.3.0';

  return (
    <div className="auth-screen-root" data-os={osMode}>
      {/* Immersive Background Glows */}
      <div className="auth-bg-aura top-aura" />
      <div className="auth-bg-aura bottom-aura" />

      <div className="auth-content-container">
        {/* APP BRANDING HEADER */}
        <header className="auth-brand-header">
          <div className="auth-icon-wrapper">
            <img src="./icon.png" alt="DayByDay Logo" className="auth-app-logo" />
            <div className="auth-logo-pulse" />
          </div>
          <div className="auth-title-group">
            <div className="auth-brand-badge-row">
              <h1 className="auth-brand-title">DayByDay</h1>
              <span className="auth-version-pill">{appVersion}</span>
            </div>
            <p className="auth-tagline">Small habits, day by day.</p>
          </div>
        </header>

        {/* AUTH CARD */}
        <div className="auth-card-surface">
          {/* TOP SEGMENTED SWITCHER (M3 Expressive / Cupertino) */}
          <div className="auth-mode-segmented">
            <button
              type="button"
              className={`auth-segment-pill ${mode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMsg(null);
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-segment-pill ${mode === 'register' ? 'active' : ''}`}
              onClick={() => {
                setMode('register');
                setError(null);
                setSuccessMsg(null);
              }}
            >
              Create Account
            </button>
          </div>

          {/* STATUS NOTIFICATIONS */}
          {error && (
            <div className="auth-feedback-banner error-banner">
              <AlertCircle size={17} className="banner-icon" />
              <div className="banner-content">
                <span className="banner-text">{error}</span>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="auth-feedback-banner success-banner">
              <CheckCircle2 size={17} className="banner-icon" />
              <div className="banner-content">
                <span className="banner-text">{successMsg}</span>
              </div>
            </div>
          )}

          {/* ================= 1. SIGN IN FORM ================= */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="auth-form-body">
              <div className="auth-form-group">
                <label className="auth-field-label">Username</label>
                <div className="auth-input-wrapper">
                  <span className="auth-input-prefix">@</span>
                  <input
                    type="text"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    className="auth-text-input"
                  />
                </div>
              </div>

              <div className="auth-form-group">
                <div className="auth-field-header-row">
                  <label className="auth-field-label">Password</label>
                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                      setRecoveryStep(1);
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="auth-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="auth-text-input"
                  />
                  <button
                    type="button"
                    className="auth-input-action-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !username.trim() || !password}
                className="auth-primary-submit-btn"
              >
                {loading ? (
                  <span className="btn-loading-content">
                    <RefreshCw size={17} className="spin-icon" />
                    <span>Signing In...</span>
                  </span>
                ) : (
                  <span className="btn-label-content">
                    <span>Sign In</span>
                    <ArrowRight size={17} />
                  </span>
                )}
              </button>
            </form>
          )}

          {/* ================= 2. REGISTER FORM ================= */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="auth-form-body">
              <div className="auth-form-group">
                <label className="auth-field-label">Choose Username</label>
                <div className="auth-input-wrapper">
                  <span className="auth-input-prefix">@</span>
                  <input
                    type="text"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder="alex_smith"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    className="auth-text-input"
                  />
                </div>
                <span className="auth-field-hint">
                  Your unique handle. Cannot be changed later.
                </span>
              </div>

              <div className="auth-form-group">
                <label className="auth-field-label">Display Name (Optional)</label>
                <div className="auth-input-wrapper">
                  <input
                    type="text"
                    placeholder="e.g. Alex"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="auth-text-input no-prefix"
                  />
                </div>
              </div>

              <div className="auth-form-row">
                <div className="auth-form-group half-width">
                  <label className="auth-field-label">Password</label>
                  <div className="auth-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Min 4 chars"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="auth-text-input no-prefix"
                    />
                  </div>
                </div>

                <div className="auth-form-group half-width">
                  <label className="auth-field-label">Confirm</label>
                  <div className="auth-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Repeat"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="auth-text-input no-prefix"
                    />
                  </div>
                </div>
              </div>

              <div className="auth-form-group">
                <label className="auth-field-label">Password Recovery Question</label>
                <select
                  value={securityQuestion}
                  onChange={(e) => setSecurityQuestion(e.target.value)}
                  className="auth-select-input"
                >
                  {PRESET_SECURITY_QUESTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>

                {securityQuestion === 'Custom question...' && (
                  <input
                    type="text"
                    required
                    placeholder="Type your custom security question"
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    className="auth-text-input no-prefix custom-q-input"
                  />
                )}

                <div className="auth-input-wrapper answer-wrapper">
                  <input
                    type="text"
                    required
                    placeholder="Your secret answer (case-insensitive)"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    className="auth-text-input no-prefix"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !username.trim() || password.length < 4}
                className="auth-primary-submit-btn"
              >
                {loading ? (
                  <span className="btn-loading-content">
                    <RefreshCw size={17} className="spin-icon" />
                    <span>Creating Account...</span>
                  </span>
                ) : (
                  <span className="btn-label-content">
                    <Sparkles size={17} />
                    <span>Create My Account</span>
                  </span>
                )}
              </button>
            </form>
          )}

          {/* ================= 3. FORGOT PASSWORD FLOW ================= */}
          {mode === 'forgot' && (
            <div className="auth-form-body">
              {recoveryStep === 1 ? (
                <form onSubmit={handleLookupQuestion} className="auth-sub-form">
                  <div className="auth-form-group">
                    <label className="auth-field-label">Your Username</label>
                    <div className="auth-input-wrapper">
                      <span className="auth-input-prefix">@</span>
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        className="auth-text-input"
                      />
                    </div>
                    <span className="auth-field-hint">
                      Enter your username to retrieve your registered security question.
                    </span>
                  </div>

                  <div className="auth-button-row">
                    <button
                      type="button"
                      className="auth-secondary-btn"
                      onClick={() => setMode('login')}
                    >
                      Back to Sign In
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !username.trim()}
                      className="auth-primary-submit-btn flex-1"
                    >
                      {loading ? 'Finding...' : 'Find Account'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="auth-sub-form">
                  <div className="auth-question-card">
                    <span className="auth-question-label">Registered Security Question:</span>
                    <p className="auth-question-text">{recoveredQuestion}</p>
                  </div>

                  <div className="auth-form-group">
                    <label className="auth-field-label">Your Secret Answer</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="Enter your answer"
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      className="auth-text-input no-prefix"
                    />
                  </div>

                  <div className="auth-form-row">
                    <div className="auth-form-group half-width">
                      <label className="auth-field-label">New Password</label>
                      <input
                        type="password"
                        required
                        placeholder="Min 4 chars"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="auth-text-input no-prefix"
                      />
                    </div>
                    <div className="auth-form-group half-width">
                      <label className="auth-field-label">Confirm</label>
                      <input
                        type="password"
                        required
                        placeholder="Confirm"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="auth-text-input no-prefix"
                      />
                    </div>
                  </div>

                  <div className="auth-button-row">
                    <button
                      type="button"
                      className="auth-secondary-btn"
                      onClick={() => setRecoveryStep(1)}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !securityAnswer.trim() || newPassword.length < 4}
                      className="auth-primary-submit-btn flex-1"
                    >
                      {loading ? 'Resetting...' : 'Reset & Sign In'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ================= CROSS-DEVICE CLOUD SYNC & IMPORT ACCORDION ================= */}
          <div className="auth-cross-device-section">
            <div
              className="auth-accordion-trigger"
              onClick={() => setShowServerDrawer(!showServerDrawer)}
            >
              <div className="trigger-left">
                <Cloud size={16} className="trigger-icon" />
                <span className="trigger-label">
                  {hasRemoteBackend() ? 'Cloud Server Connected' : 'Connect Cloud Server / Transfer Account'}
                </span>
              </div>
              <span className={`accordion-indicator ${showServerDrawer ? 'open' : ''}`}>
                ›
              </span>
            </div>

            {showServerDrawer && (
              <div className="auth-server-drawer-content">
                <p className="drawer-description">
                  Connect your DayByDay Vercel deployment URL to synchronize accounts and habits between your PC, iOS, and Android devices.
                </p>

                {/* SERVER URL INPUT */}
                <div className="server-url-field">
                  <div className="server-input-row">
                    <Server size={16} className="server-icon" />
                    <input
                      type="url"
                      placeholder="https://your-daybyday-app.vercel.app"
                      value={serverUrlInput}
                      onChange={(e) => setServerUrlInput(e.target.value)}
                      className="server-text-input"
                    />
                    <button
                      type="button"
                      disabled={serverTesting}
                      onClick={handleTestAndSaveServer}
                      className="server-test-btn"
                    >
                      {serverTesting ? 'Testing...' : 'Test & Save'}
                    </button>
                  </div>

                  {serverStatus && (
                    <div className={`server-status-pill ${serverStatus.ok ? 'success' : 'failed'}`}>
                      {serverStatus.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      <span>{serverStatus.message}</span>
                    </div>
                  )}
                </div>

                {/* TRANSFER / IMPORT FROM PC */}
                <div className="drawer-divider">
                  <span>OR RESTORE FROM BACKUP</span>
                </div>

                <div className="transfer-action-row">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    className="transfer-file-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={16} />
                    <span>Import Account from PC / Web Backup (.json)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER FEATURES BADGES */}
        <footer className="auth-platform-footer">
          <div className="feature-pill">
            <ShieldCheck size={14} />
            <span>100% Private & Local-First</span>
          </div>
          <div className="feature-pill">
            <Smartphone size={14} />
            <span>Cross-Platform Sync</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
