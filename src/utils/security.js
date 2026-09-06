// DuoTrack Privacy & Security Engine

/**
 * XSS Sanitizer to ensure user input (custom habit names, units, etc.)
 * cannot inject script tags or malicious entities.
 */
export const sanitizeInput = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>'"&]/g, (tag) => {
      const chars = {
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
        '&': '&amp;',
      };
      return chars[tag] || tag;
    })
    .trim()
    .slice(0, 80); // Strict length limit to prevent buffer / memory abuse
};

/**
 * Export all user data as an encrypted/clean JSON file for backup.
 * Pure local download without passing through any server or 3rd party.
 */
export const exportLocalBackup = (data) => {
  const exportPayload = {
    app: 'DuoTrack',
    version: '2.4.0',
    exportedAt: new Date().toISOString(),
    privacyNotice: '100% Client-side local data. Zero tracking, zero telemetry.',
    data,
  };

  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `duotrack-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url); // Immediate memory cleanup
};

/**
 * Secure local wipe of all habit, pod, and preference data.
 */
export const wipeLocalData = () => {
  const keys = [
    'duotrack_os',
    'duotrack_theme',
    'duotrack_view',
    'duotrack_habits',
    'duotrack_pod',
    'duotrack_beyond',
  ];
  keys.forEach((k) => localStorage.removeItem(k));
};
