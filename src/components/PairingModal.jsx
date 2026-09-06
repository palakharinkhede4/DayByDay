import React, { useState } from 'react';
import { useHabits } from '../context/HabitContext';
import { Copy, Check, Share2, X, Users, ArrowRight } from 'lucide-react';

export const PairingModal = ({ isOpen, onClose }) => {
  const { pod, user, pairWithPartner } = useHabits();
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const myCode = user?.secretCode || pod?.code || 'DAY-1000';

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(myCode);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Pair with me on DayByDay',
          text: `Here is my DayByDay secret code: ${myCode}. Connect with me to track habits together!`,
          url: window.location.href,
        });
      } else {
        await handleCopy();
      }
    } catch {
      await handleCopy();
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (clean.length < 4) return;
    setError('');
    setLoading(true);

    try {
      await pairWithPartner(clean);
      setInputCode('');
      onClose();
    } catch (err) {
      setError(err.message || 'Could not connect with partner. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet pairing-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grabber"></div>

        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-pill-tag">Accountability Sync</span>
            <h2 className="modal-title">Pair With Partner</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* My Secret Code Card */}
        <div className="pod-code-box">
          <span className="code-eyebrow">YOUR SECRET CODE</span>
          <div className="code-display font-bold">{myCode}</div>
          <p className="code-instructions">
            Share this secret code with your accountability partner. They enter it on their device to connect with you.
          </p>

          <div className="code-actions-row">
            <button className="share-code-btn" onClick={handleShare}>
              <Share2 size={16} />
              <span>Share Code</span>
            </button>
            <button className="copy-code-btn" onClick={handleCopy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Enter partner's code */}
        <div className="join-pod-section">
          <h3 className="section-label">Enter Partner's Code</h3>
          {error && <div className="partner-error-banner">{error}</div>}
          <form onSubmit={handleJoin} className="code-input-form">
            <input
              type="text"
              placeholder="e.g. PAL-4788"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              maxLength={12}
              className="pod-code-input font-bold"
            />
            <button
              type="submit"
              disabled={loading || inputCode.trim().length < 4}
              className="join-btn"
            >
              {loading ? 'Connecting...' : 'Connect'}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>

        <button className="done-link-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
};
