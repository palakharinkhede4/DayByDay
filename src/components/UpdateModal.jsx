import React from 'react';
import { Sparkles, Download, ExternalLink, X, CheckCircle2, RefreshCw } from 'lucide-react';
import { openExternalUrl, DIRECT_APK_URL, RELEASES_PAGE_URL } from '../utils/updateChecker';
import { sound } from '../utils/sound';

export const UpdateModal = ({ isOpen, onClose, updateInfo, isChecking = false }) => {
  if (!isOpen) return null;

  const isUpdate = updateInfo?.updateAvailable;

  return (
    <div className="update-modal-backdrop" onClick={onClose}>
      <div className="update-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="update-modal-header">
          <div className="update-icon-circle">
            {isChecking ? (
              <RefreshCw size={26} className="animate-spin text-primary" />
            ) : isUpdate ? (
              <Sparkles size={26} className="text-emerald-400" />
            ) : (
              <CheckCircle2 size={26} className="text-primary" />
            )}
          </div>
          <h3 className="update-modal-title font-extrabold">
            {isChecking
              ? 'Checking for Updates...'
              : isUpdate
              ? 'New Update Available!'
              : 'App is Up to Date'}
          </h3>
          <p className="update-modal-subtitle">
            {isChecking
              ? 'Connecting to GitHub Releases to check for the latest DayByDay build...'
              : isUpdate
              ? `A new version (${updateInfo?.releaseTag || 'Latest'}) of DayByDay is ready for you.`
              : `You are on the latest build (${updateInfo?.currentVersion || 'v1.8.0'}).`}
          </p>
        </div>

        {/* Details Box */}
        {!isChecking && updateInfo && (
          <div className="update-details-box">
            <div className="update-detail-row">
              <span className="detail-label">Release Version</span>
              <span className="detail-value font-mono font-bold text-primary">
                {updateInfo.releaseTag || updateInfo.releaseName || 'Latest Release'}
              </span>
            </div>
            {updateInfo.formattedDate && (
              <div className="update-detail-row">
                <span className="detail-label">Released</span>
                <span className="detail-value">{updateInfo.formattedDate}</span>
              </div>
            )}
            {updateInfo.apkSize && (
              <div className="update-detail-row">
                <span className="detail-label">Download Size</span>
                <span className="detail-value font-mono">{updateInfo.apkSize}</span>
              </div>
            )}
            <div className="update-detail-row">
              <span className="detail-label">Safety</span>
              <span className="detail-value text-emerald-400 font-medium">
                In-place update · habits & login preserved
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="update-modal-actions">
          {isUpdate && (
            <button
              type="button"
              className="update-action-btn primary font-bold"
              onClick={() => {
                sound.complete();
                openExternalUrl(updateInfo?.directApkUrl || DIRECT_APK_URL);
                onClose();
              }}
            >
              <Download size={18} />
              <span>Download & Install APK</span>
            </button>
          )}

          <button
            type="button"
            className="update-action-btn secondary font-medium"
            onClick={() => {
              sound.tap();
              openExternalUrl(updateInfo?.releasePageUrl || RELEASES_PAGE_URL);
              onClose();
            }}
          >
            <ExternalLink size={16} />
            <span>View Release on GitHub</span>
          </button>

          <button
            type="button"
            className="update-action-btn close font-medium"
            onClick={() => {
              sound.tap();
              onClose();
            }}
          >
            {isUpdate ? 'Remind Me Later' : 'Dismiss'}
          </button>
        </div>
      </div>
    </div>
  );
};
