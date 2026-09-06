/**
 * DayByDay In-App Update Checker
 * Queries GitHub Releases API to detect newer builds and provides direct APK download links.
 */

export const RELEASES_PAGE_URL = 'https://github.com/palakharinkhede4/DayByDay/releases/latest';
export const DIRECT_APK_URL = 'https://github.com/palakharinkhede4/DayByDay/releases/latest/download/DayByDay.apk';
const RELEASES_API_URL = 'https://api.github.com/repos/palakharinkhede4/DayByDay/releases/latest';

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
 * Checks GitHub for the latest DayByDay release and determines if a newer version is available.
 */
export const checkForAppUpdate = async () => {
  const currentBuildTime = getAppBuildTime();

  try {
    const response = await fetch(RELEASES_API_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
      cache: 'no-cache',
    });

    if (!response.ok) {
      // If rate limited or private, return fallback with links
      return {
        success: false,
        status: 'api_unavailable',
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

    // Determine if update is available
    let updateAvailable = false;
    if (currentBuildTime && releaseDate) {
      const buildDate = new Date(currentBuildTime);
      // Give a 60 second grace period for build/release timestamps
      updateAvailable = releaseDate.getTime() > buildDate.getTime() + 60 * 1000;
    } else {
      // In dev or untracked build, default to showing release info
      updateAvailable = true;
    }

    return {
      success: true,
      updateAvailable,
      releaseName: data.name || 'DayByDay Latest Build',
      tagName: data.tag_name || 'latest',
      publishedAt,
      formattedDate,
      releasePageUrl: data.html_url || RELEASES_PAGE_URL,
      directApkUrl: downloadUrl,
      apkSize: sizeFormatted,
      releaseNotes: data.body || '',
    };
  } catch (err) {
    console.warn('Update check failed:', err);
    return {
      success: false,
      status: 'network_error',
      message: 'Network offline or unable to reach GitHub.',
      releasePageUrl: RELEASES_PAGE_URL,
      directApkUrl: DIRECT_APK_URL,
    };
  }
};
