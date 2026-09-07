/**
 * DayByDay In-App Update Checker & Changelog Service
 * Queries GitHub Releases API to detect newer builds and provides direct APK download links.
 */

import { getApiBaseUrl } from './api';

export const CURRENT_APP_VERSION = '2.5.2';
export const RELEASES_PAGE_URL = 'https://github.com/palakharinkhede4/DayByDay/releases';
export const DIRECT_APK_URL = 'https://github.com/palakharinkhede4/DayByDay/releases/latest';
const RELEASES_API_URL = 'https://api.github.com/repos/palakharinkhede4/DayByDay/releases/latest';
const ALL_RELEASES_API_URL = 'https://api.github.com/repos/palakharinkhede4/DayByDay/releases?per_page=5';

/**
 * Returns the app version or default.
 */
export const getAppVersion = () => {
  try {
    if (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) {
      return __APP_VERSION__;
    }
  } catch {}
  return CURRENT_APP_VERSION;
};

/**
 * Returns the ISO string of the current app build timestamp injected by Vite, or null.
 */
export const getAppBuildTime = () => {
  try {
    if (typeof __APP_BUILD_TIME__ !== 'undefined' && __APP_BUILD_TIME__) {
      return __APP_BUILD_TIME__;
    }
  } catch {}
  return null;
};

/**
 * Format bytes to human readable format (MB/KB)
 */
export const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes)) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
};

/**
 * Safely open external link (works across Web and native Android Capacitor)
 */
export const openExternalUrl = (url) => {
  if (!url) return;
  try {
    if (window.Capacitor?.isNativePlatform?.()) {
      window.open(url, '_system');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    window.open(url, '_blank');
  }
};

/**
 * Resolves direct signed Azure CDN link (release-assets.githubusercontent.com)
 */
export const resolveDirectCdnUrl = async (inputUrl) => {
  if (inputUrl && inputUrl.includes('release-assets.githubusercontent.com')) {
    return inputUrl;
  }
  try {
    const baseUrl = getApiBaseUrl();
    const query = inputUrl ? `&url=${encodeURIComponent(inputUrl)}` : '';
    const res = await fetch(`${baseUrl}/api/user?action=resolve_latest_apk${query}`, {
      cache: 'no-cache',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.directApkUrl) {
        return data.directApkUrl;
      }
    }
  } catch (err) {
    console.warn('CDN resolution notice:', err);
  }
  return inputUrl || DIRECT_APK_URL;
};

/**
 * Direct in-app installer for native Android or fallback to browser download
 */
export const installApkDirectly = async (url) => {
  let targetUrl = url || DIRECT_APK_URL;
  try {
    const directUrl = await resolveDirectCdnUrl(targetUrl);
    if (directUrl) targetUrl = directUrl;
  } catch {}

  try {
    if (window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.AppInstaller) {
      const res = await window.Capacitor.Plugins.AppInstaller.installApk({ url: targetUrl });
      return { success: true, native: true, res };
    }
  } catch (err) {
    console.warn('Native installer error or permission needed:', err);
    // Fallback to open external
  }
  openExternalUrl(targetUrl);
  return { success: true, native: false };
};

/**
 * Helper to compare semantic versions like '1.1.0' vs '1.2.0'
 */
function compareSemVer(v1, v2) {
  const clean1 = (v1 || '').replace(/^v/, '').split('.').map(Number);
  const clean2 = (v2 || '').replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(clean1.length, clean2.length); i++) {
    const num1 = clean1[i] || 0;
    const num2 = clean2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Checks GitHub for the latest DayByDay release and determines if a newer version is available.
 */
export const checkForAppUpdate = async () => {
  const currentBuildTime = getAppBuildTime();
  const currentVersion = getAppVersion();

  try {
    const response = await fetch(RELEASES_API_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
      cache: 'no-cache',
    });

    if (!response.ok) {
      return {
        success: false,
        status: 'api_unavailable',
        currentVersion,
        message: 'Could not fetch release status from GitHub.',
        releasePageUrl: RELEASES_PAGE_URL,
        directApkUrl: DIRECT_APK_URL,
      };
    }

    const data = await response.json();
    const publishedAt = data.published_at || data.created_at;
    const releaseDate = publishedAt ? new Date(publishedAt) : null;
    const formattedDate = releaseDate
      ? releaseDate.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Recent';

    // Find APK asset in release
    const apkAsset = Array.isArray(data.assets)
      ? data.assets.find(
          (a) => a.name && (a.name.endsWith('.apk') || a.name === 'DayByDay.apk')
        )
      : null;

    const downloadUrl = apkAsset?.browser_download_url || DIRECT_APK_URL;
    const sizeFormatted = apkAsset?.size ? formatFileSize(apkAsset.size) : '';

    // Extract release version tag (if tag like v1.2.0 or 1.2.0)
    const releaseTag = data.tag_name || '';
    const isTagSemver = /^v?\d+\.\d+(\.\d+)?/.test(releaseTag);

    let updateAvailable = false;
    if (isTagSemver) {
      // Direct semantic version comparison
      updateAvailable = compareSemVer(releaseTag, currentVersion) > 0;
    } else if (currentBuildTime && releaseDate) {
      // When tags are 'latest', CI build step finishes ~2-5 minutes before GitHub creates release.
      // Therefore only consider it an actual new update if releaseDate is at least 30 minutes newer
      // than the app's build timestamp!
      const buildDate = new Date(currentBuildTime);
      const diffMs = releaseDate.getTime() - buildDate.getTime();
      updateAvailable = diffMs > 30 * 60 * 1000;
    } else {
      updateAvailable = false;
    }

    let finalDownloadUrl = downloadUrl;
    try {
      const directCdn = await resolveDirectCdnUrl(downloadUrl);
      if (directCdn) {
        finalDownloadUrl = directCdn;
      }
    } catch {}

    return {
      success: true,
      currentVersion,
      updateAvailable,
      releaseName: data.name || 'DayByDay Latest Build',
      tagName: data.tag_name || 'latest',
      publishedAt,
      formattedDate,
      releasePageUrl: data.html_url || RELEASES_PAGE_URL,
      directApkUrl: finalDownloadUrl,
      rawGithubUrl: downloadUrl,
      apkSize: sizeFormatted,
      changelog: data.body || 'No release notes provided.',
    };
  } catch (err) {
    console.warn('Update check failed:', err);
    return {
      success: false,
      status: 'network_error',
      currentVersion,
      message: 'Network offline or unable to reach GitHub.',
      releasePageUrl: RELEASES_PAGE_URL,
      directApkUrl: DIRECT_APK_URL,
    };
  }
};

/**
 * Fetch changelog text for the app
 */
export const fetchChangelog = async () => {
  try {
    const res = await fetch(RELEASES_API_URL, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        version: data.tag_name || 'v1.1.0',
        publishedAt: data.published_at,
        notes: data.body || 'Continuous build improvements and performance enhancements.',
      };
    }
  } catch {}
  return {
    success: true,
    version: 'v1.1.0',
    notes: '• Android runtime notification permissions\n• Xiaomi HyperOS dynamic island live notifications\n• Status bar margin overlap fixes across mobile & iOS\n• Dark and light mode tab navigation icon contrast\n• Habit card reordering controls\n• Custom habit categories creation\n• Separate account sign out and local data wipe\n• Dynamic accent palette color fixes\n• Modal background body scroll lock\n• Custom user profile picture upload',
  };
};
