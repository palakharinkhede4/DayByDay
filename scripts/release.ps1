# =============================================================================
# DayByDay Release Script
# Usage:  .\scripts\release.ps1          (bump patch: 1.2.0 → 1.2.1)
#         .\scripts\release.ps1 minor    (bump minor: 1.2.0 → 1.3.0)
#         .\scripts\release.ps1 major    (bump major: 1.2.0 → 2.0.0)
# =============================================================================

param(
    [string]$BumpType = "patch",
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

# ── 1. Read current version ──────────────────────────────────────────────────
$pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
$current = $pkg.version
Write-Host "Current version: $current" -ForegroundColor Cyan

$parts = $current.Split(".")
$major = [int]$parts[0]
$minor = [int]$parts[1]
$patch = [int]$parts[2]

switch ($BumpType.ToLower()) {
    "major" { $major++; $minor = 0; $patch = 0 }
    "minor" { $minor++; $patch = 0 }
    default { $patch++ }
}

$next = "$major.$minor.$patch"
Write-Host "Bumping to:      $next" -ForegroundColor Green

# ── 2. Update package.json ───────────────────────────────────────────────────
$pkgRaw = Get-Content "package.json" -Raw
$pkgRaw = $pkgRaw -replace `
    '"version":\s*"[^"]+"', `
    "`"version`": `"$next`""
$pkgRaw | Set-Content "package.json" -NoNewline
Write-Host "Updated package.json" -ForegroundColor Gray

# ── 3. Update android/app/build.gradle versionName ──────────────────────────
$gradle = Get-Content "android/app/build.gradle" -Raw
$gradle = $gradle -replace `
    'versionName\s+"[^"]+"', `
    "versionName `"$next`""
$gradle | Set-Content "android/app/build.gradle" -NoNewline
Write-Host "Updated android/app/build.gradle" -ForegroundColor Gray

# ── 4. Update updateChecker.js ───────────────────────────────────────────────
$checker = Get-Content "src/utils/updateChecker.js" -Raw
$checker = $checker -replace `
    "CURRENT_APP_VERSION = '[^']+'", `
    "CURRENT_APP_VERSION = '$next'"
$checker | Set-Content "src/utils/updateChecker.js" -NoNewline
Write-Host "Updated updateChecker.js" -ForegroundColor Gray

# ── 5. Commit and push ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "Committing version bump and all changes..." -ForegroundColor Cyan
git add -A
$commitMsg = if ($Message) { "release: v$next - $Message" } else { "release: v$next - clean native auth, DB cloud sync & eliminate technical UI" }
git commit -m $commitMsg
git push origin main

Write-Host ""
Write-Host "SUCCESS: v$next pushed to main." -ForegroundColor Green
Write-Host "GitHub Actions will now build and publish DayByDay-v$next.apk to Releases." -ForegroundColor Green
Write-Host "Track progress: https://github.com/palakharinkhede4/DayByDay/actions" -ForegroundColor Cyan
