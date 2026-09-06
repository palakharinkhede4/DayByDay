import React, { useState } from 'react';
import { useHabits } from '../context/HabitContext';

export const PairingModal = ({ isOpen, onClose }) => {
  const { pod, pairPod, leavePod } = useHabits();
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [partnerInviteActive, setPartnerInviteActive] = useState(false);

  if (!isOpen) return null;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join my DuoTrack Habit Pod!',
          text: `Use my Pod code ${pod.code} to pair up and track habits together!`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(pod.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      await navigator.clipboard.writeText(pod.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (inputCode.trim().length >= 4) {
      pairPod(inputCode.trim().toUpperCase(), 'Joe');
      setInputCode('');
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet pairing-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grabber"></div>

        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-pill-tag">Pair up to start</span>
            <h2 className="modal-title">Your Pod Code</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Big Pod Code Card (from video) */}
        <div className="pod-code-box">
          <span className="code-eyebrow">POD ACCESS KEY</span>
          <div className="code-display font-bold">{pod.code}</div>
          <p className="code-instructions">
            Share this code with your partner. They'll enter it on their device to pair up.
          </p>

          <button className="share-code-btn" onClick={handleShare}>
            <span className="btn-icon">🔗</span>
            <span>{copied ? 'Code Copied! ✓' : 'Share Code'}</span>
          </button>
        </div>

        {/* Enter partner's code */}
        <div className="join-pod-section">
          <h3 className="section-label">Enter Partner's Code</h3>
          <form onSubmit={handleJoin} className="code-input-form">
            <input
              type="text"
              placeholder="e.g. ZAU8PP"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="pod-code-input font-bold"
            />
            <button
              type="submit"
              disabled={inputCode.trim().length < 4}
              className="join-btn"
            >
              Join
            </button>
          </form>
        </div>

        {/* Mock Invite Notification banner (as shown in video) */}
        <div className="mock-invite-callout">
          <div className="invite-callout-header">
            <span className="avatar-chip">J</span>
            <div>
              <span className="invite-name font-bold">Joe invited you!</span>
              <p className="invite-desc">Join their pod and start tracking goals together</p>
            </div>
          </div>
          <div className="invite-actions">
            <button
              className="accept-invite-btn"
              onClick={() => {
                pairPod('ZAU8PP', 'Joe');
                onClose();
              }}
            >
              Accept & Connect
            </button>
          </div>
        </div>

        <button className="done-link-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
};
