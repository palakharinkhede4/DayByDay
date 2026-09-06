// DayByDay Privacy & Security Engine

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
    app: 'DayByDay',
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
  a.download = `daybyday-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url); // Immediate memory cleanup
};

/**
 * Validate and parse a DayByDay JSON backup file.
 */
export const parseLocalBackup = (jsonString) => {
  try {
    const parsed = JSON.parse(jsonString);
    const data = parsed.data || parsed;
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid backup file structure.');
    }
    return {
      success: true,
      data,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Failed to read backup file.',
    };
  }
};

/**
 * Secure local wipe of all habit, pod, and preference data.
 */
export const wipeLocalData = () => {
  const keys = [
    'daybyday_user',
    'daybyday_partner',
    'daybyday_os',
    'daybyday_theme',
    'daybyday_theme_mode',
    'daybyday_view',
    'daybyday_habits',
    'daybyday_pod',
    'daybyday_beyond',
    'daybyday_server_url',
    // Clean up legacy keys
    'duotrack_user',
    'duotrack_partner',
    'duotrack_os',
    'duotrack_theme',
    'duotrack_theme_mode',
    'duotrack_view',
    'duotrack_habits',
    'duotrack_pod',
    'duotrack_beyond',
    'duotrack_server_url',
  ];
  keys.forEach((k) => localStorage.removeItem(k));
};
