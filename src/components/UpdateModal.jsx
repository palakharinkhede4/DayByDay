import React, { useState } from 'react';
import { Sparkles, Download, ExternalLink, CheckCircle2, RefreshCw, Copy, Check, ShieldCheck, Loader2 } from 'lucide-react';
import { installApkDirectly, openExternalUrl, DIRECT_APK_URL, RELEASES_PAGE_URL, CURRENT_APP_VERSION, isAndroidNativeApp } from '../utils/updateChecker';
import { sound } from '../utils/sound';

const extractCleanVersion = (info) => {
  if (!info) return CURRENT_APP_VERSION;
  const candidates = [info.tagName, info.releaseTag, info.releaseName, info.version];
  for (const c of candidates) {
    if (!c || typeof c !== 'string') continue;
    const match = c.match(/v?(\d+\.\d+(?:\.\d+)?)/i);
    if (match) return match[1];
  }
  return (info.tagName || info.version || CURRENT_APP_VERSION).replace(/^v/, '');
};

export const UpdateModal = ({ isOpen, onClose, updateInfo, isChecking = false }) => {
  const [copied, setCopied] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Strictly for native Android app — iOS webapp and website directly migrate to latest version
  if (!isOpen || !isAndroidNativeApp()) return null;

  const isUpdate = updateInfo?.updateAvailable;
  const cleanVer = extractCleanVersion(updateInfo);

  const handleCopyLink = async () => {
    sound.press();
    const url = updateInfo?.directApkUrl || updateInfo?.rawGithubUrl || DIRECT_APK_URL;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Non-blocking fallback
    }
  };

  const handleInstall = async () => {
    sound.complete();
    setIsInstalling(true);
    try {
      const url = updateInfo?.directApkUrl || DIRECT_APK_URL;
      await installApkDirectly(url);
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="update-modal-backdrop" onClick={onClose}>
      <div className="update-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="update-modal-header">
          <div className="update-icon-circle">
            {isChecking ? (
              <RefreshCw size={24} className="animate-spin text-primary" />
            ) : isUpdate ? (
              <Sparkles size={24} className="text-emerald-400" />
            ) : (
              <CheckCircle2 size={24} className="text-primary" />
            )}
          </div>
          <h3 className="update-modal-title font-extrabold">
            {isChecking
              ? 'Checking for Updates'
              : isUpdate
              ? 'New Update Available'
              : 'Up to Date'}
          </h3>
          <p className="update-modal-subtitle">
            {isChecking
              ? 'Checking for the latest DayByDay improvements...'
              : isUpdate
              ? `Version ${cleanVer} is ready to install.`
              : `You are on the latest version of DayByDay (${updateInfo?.currentVersion ? (updateInfo.currentVersion.startsWith('v') ? updateInfo.currentVersion : `v${updateInfo.currentVersion}`) : `v${CURRENT_APP_VERSION}`}).`}
          </p>
        </div>

        {/* Details Box */}
        {!isChecking && updateInfo && (
          <div className="update-details-box">
            <div className="update-detail-row">
              <span className="detail-label">Version</span>
              <span className="detail-value font-mono font-bold text-primary">
                {`v${cleanVer}`}
              </span>
            </div>
            {updateInfo.formattedDate && (
              <div className="update-detail-row">
                <span className="detail-label">Date</span>
                <span className="detail-value">{updateInfo.formattedDate}</span>
              </div>
            )}
            {updateInfo.apkSize && (
              <div className="update-detail-row">
                <span className="detail-label">Update Size</span>
                <span className="detail-value font-mono">{updateInfo.apkSize}</span>
              </div>
            )}
            <div className="update-detail-row">
              <span className="detail-label">Data Safety</span>
              <span className="detail-value text-emerald-400 font-medium">
                Habits & streaks preserved
              </span>
            </div>
          </div>
        )}

        {/* User Tip Box */}
        {isUpdate && (
          <div className="update-tip-box">
            <div className="update-tip-header">
              <ShieldCheck size={16} className="update-tip-icon" />
              <span className="update-tip-title">Direct In-App Update</span>
            </div>
            <p className="update-tip-text">
              Tap Update Now to install directly. If your phone asks for permission to install updates, allow it and return to finish.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="update-modal-actions">
          {isUpdate && (
            <button
              type="button"
              className="update-action-btn primary font-bold"
              disabled={isInstalling}
              onClick={handleInstall}
            >
              {isInstalling ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              <span>{isInstalling ? 'Preparing Update...' : 'Update Now'}</span>
            </button>
          )}

          {!isChecking && (
            <button
              type="button"
              className="update-action-btn secondary font-medium"
              onClick={handleCopyLink}
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              <span>{copied ? 'Link Copied' : 'Copy Download Link'}</span>
            </button>
          )}

          <button
            type="button"
            className="update-action-btn secondary font-medium"
            onClick={() => {
              sound.press();
              openExternalUrl(updateInfo?.releasePageUrl || RELEASES_PAGE_URL);
              onClose();
            }}
          >
            <ExternalLink size={16} />
            <span>View What's New</span>
          </button>

          <button
            type="button"
            className="update-action-btn close font-medium"
            onClick={() => {
              sound.press();
              onClose();
            }}
          >
            {isUpdate ? 'Remind Me Later' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
