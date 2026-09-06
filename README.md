# DuoTrack

Production-grade, cross-platform habit tracking application designed for individuals, pairs, and accountability pods.

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Neon Database](https://img.shields.io/badge/Neon-PostgreSQL-00E599?style=flat-square&logo=postgresql&logoColor=black)](https://neon.tech/)
[![Capacitor](https://img.shields.io/badge/Capacitor-Android-119EFF?style=flat-square&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![CI/CD](https://img.shields.io/badge/GitHub%20Actions-Automated%20Builds-2088FF?style=flat-square&logo=githubactions&logoColor=white)](https://github.com/palakharinkhede4/DuoTrack/actions)
[![License](https://img.shields.io/badge/License-MIT-10B981?style=flat-square)](LICENSE)

---

## Executive Summary

DuoTrack is an architectural evolution of collaborative habit tracking. It supports both solo tracking and synchronized dual-user accountability pods. Unlike traditional platforms that require mandatory logins with third-party tracking, DuoTrack uses cryptographic secret codes for instant pairing, offline-first state persistence, client-side notification dispatching, and a storage-optimized Neon PostgreSQL schema designed to operate comfortably within strict infrastructure quotas.

---

## System Architecture

DuoTrack consists of a progressive web frontend, native Android container, serverless API gateway, and serverless PostgreSQL database.

```
+-------------------------------------------------------------------------+
|                              Client Layer                               |
|                                                                         |
|   +--------------------------+          +---------------------------+   |
|   |   Android Native App     |          |      Safari iOS (PWA)     |   |
|   |  (Capacitor / Android 16)|          |     (Standalone Display)  |   |
|   +------------+-------------+          +-------------+-------------+   |
|                |                                      |                 |
|                +------------------+-------------------+                 |
|                                   |                                     |
|                                   v                                     |
|                     +---------------------------+                       |
|                     |     React 19 Frontend     |                       |
|                     |  - Adaptive Dotted Arch   |                       |
|                     |  - Local Notification Sched|                      |
|                     |  - Light / Dark / Auto    |                       |
|                     +-------------+-------------+                       |
+-----------------------------------|-------------------------------------+
                                    |
                                    v HTTPS / REST
+-----------------------------------|-------------------------------------+
|                             Backend Layer                               |
|                                                                         |
|                     +-------------+-------------+                       |
|                     |  Serverless Functions     |                       |
|                     |  - /api/user              |                       |
|                     |  - /api/pod               |                       |
|                     +-------------+-------------+                       |
|                                   |                                     |
|                                   v Connection Pooling                  |
|                     +-------------+-------------+                       |
|                     |  Neon PostgreSQL Engine   |                       |
|                     |  (duotrack_users, habits) |                       |
|                     +---------------------------+                       |
+-------------------------------------------------------------------------+
```

---

## Database Storage Architecture & 0.5 GB Free Tier Optimization

DuoTrack is engineered specifically to operate within Neon's 0.5 GB (512 MB) storage limit while guaranteeing continuous operation for 50 or more active users for over a full calendar year.

### Mathematical Storage Analysis

Traditional relational models insert one row per habit completion per day (50 users x 10 habits x 365 days = 182,500 rows/year), resulting in table bloat, heavy index overhead, and rapid quota exhaustion.

DuoTrack eliminates this overhead through a **Single-Row Consolidated JSONB Map Pattern**:

1. **Fixed Row Allocation**: Each user habit occupies exactly one row in `duotrack_habits`. 50 users tracking 10 habits create a constant footprint of exactly 500 rows.
2. **Compact Key Sizing**: Daily logs are stored within a JSONB dictionary using ISO 8601 date keys (`{"2026-09-06": 1}`).
3. **Data Footprint per Habit/Year**:
   - 365 days x 18 bytes per key-value pair = 6,570 bytes (~6.4 KB).
   - 500 total habits x 6.4 KB = **3.2 MB total history data**.
4. **Relational Table Overhead**:
   - `duotrack_users` (50 rows x 180 bytes) = ~9 KB.
   - `duotrack_pairings` (25 rows x 120 bytes) = ~3 KB.
   - `duotrack_habits` base columns (500 rows x 220 bytes) = ~110 KB.
   - B-tree Indexes (`idx_users_username`, `idx_users_secret`, `idx_habits_user`) = ~250 KB.
5. **Total Database Consumption After 1 Year**:
   - Total Space Consumed: **~3.6 MB**
   - Percentage of 512 MB Neon Quota: **0.70%**
   - Available Headroom: **99.30%** (Sufficient for over 5,000 active users).

### PostgreSQL Schema Specification

```sql
-- Users Table: Unique identity and pairing secret codes
CREATE TABLE IF NOT EXISTS duotrack_users (
  id VARCHAR(48) PRIMARY KEY,
  username VARCHAR(32) UNIQUE NOT NULL,
  secret_code VARCHAR(16) UNIQUE NOT NULL,
  display_name VARCHAR(64),
  avatar VARCHAR(8) DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_active TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Habits Table: 1 row per habit with compact JSONB historical tracking
CREATE TABLE IF NOT EXISTS duotrack_habits (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(48) REFERENCES duotrack_users(id) ON DELETE CASCADE,
  habit_id VARCHAR(32) NOT NULL,
  name VARCHAR(64) NOT NULL,
  target NUMERIC(8, 2) NOT NULL DEFAULT 1,
  unit VARCHAR(16) DEFAULT '',
  icon VARCHAR(32) DEFAULT 'target',
  category VARCHAR(24) DEFAULT 'Daily',
  today_value NUMERIC(8, 2) DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  reminder_time VARCHAR(5),
  reminder_days VARCHAR(24),
  streak INT DEFAULT 0,
  history JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, habit_id)
);

-- Pairings Table: Active accountability connections
CREATE TABLE IF NOT EXISTS duotrack_pairings (
  id SERIAL PRIMARY KEY,
  user1_id VARCHAR(48) REFERENCES duotrack_users(id) ON DELETE CASCADE,
  user2_id VARCHAR(48) REFERENCES duotrack_users(id) ON DELETE CASCADE,
  pod_code VARCHAR(24) UNIQUE NOT NULL,
  status VARCHAR(16) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON duotrack_users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_secret ON duotrack_users(UPPER(secret_code));
CREATE INDEX IF NOT EXISTS idx_habits_user ON duotrack_habits(user_id);
```

---

## Core Features

### 1. Flexible Habit Creation and Custom Units
* Add custom habits with user-defined names, categories, numerical targets, and unit types (e.g., pages, minutes, repetitions, kilometers, pints).
* Preset templates available for immediate setup: Morning Run, Journaling, Code Practice, Stretching, and Reading.
* Quick logging controls: `-1`, `+1`, `+5`, or binary completion toggles.
* Habit deletion and management with automatic database synchronization.

### 2. Scheduled Reminders and Notification Dispatcher
* Custom notification scheduler supporting specific reminder times (`HH:mm`).
* Granular day-of-week selection:
  * Individual days (Monday through Sunday).
  * Quick filter presets: Daily, Weekdays, or Weekends.
* Multi-layer alert execution:
  * Browser / OS Web Notifications via the standard `Notification` API.
  * In-app status banner alerts.
  * Audio confirmation cues.
* Deduplicated dispatching: Checks timestamps every 25 seconds and prevents duplicate alerts during the active window.

### 3. Consecutive Streak Calculation
* Automatic streak tracking computed from consecutive historical completions in the JSONB archive.
* Preserves active streaks even before the current day's target is finalized.
* Displayed on each habit card to motivate user consistency.

### 4. Categorization and Progress Filtering
* Filter habits by domain: All, Daily, Health, Fitness, Mind, and Work.
* Real-time completion counter indicating completed habits against total active habits for the day.

### 5. Solo and Together Modes
* **Solo Mode (Default)**: Personal habit tracking with 100% user-centric progress dial metrics.
* **Together Pod Mode**: Connect via Secret Code (e.g., `PLK-8429`) to enable live synchronization, dual progress arches, and activity logs without exposing passwords.

### 6. Light, Dark, and Auto Theme Engine
* **Light Mode**: High-contrast slate typography on neutral porcelain surfaces.
* **Dark Mode**: Deep obsidian background with muted emerald accents.
* **Auto Mode**: Listens to system-level `prefers-color-scheme` changes in real time.

---

## Installation & Deployment

### Environment Configuration

Configure the following environment variable on your hosting platform:

```env
DATABASE_URL=postgres://user:password@ep-sample-pool.neon.tech/neondb?sslmode=require
```

If `DATABASE_URL` is omitted, the application automatically falls back to local storage and in-memory persistence.

### Local Development

```bash
# Clone the repository
git clone https://github.com/palakharinkhede4/DuoTrack.git
cd DuoTrack

# Install dependencies
npm install

# Start Vite development server
npm run dev

# Compile production bundle
npm run build
```

---

## Mobile Deployment Guide

### Android Installation (Native APK)

Pre-built binaries are available in the repository root and via GitHub Releases:

1. Download [`DuoTrack.apk`](./DuoTrack.apk).
2. Transfer the `.apk` file to your Android device via USB, Google Drive, or local storage.
3. Tap the file in your device's file manager and allow installation from your file provider if prompted.
4. Launch DuoTrack.

To build the APK from source:

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

Compiled output is generated at:
`android/app/build/outputs/apk/debug/app-debug.apk`

### iOS Installation (Safari Standalone PWA)

Apple requires Apple Developer Program membership to sign native `.ipa` files for sideloading. DuoTrack provides full native parity through a standalone Progressive Web App configuration:

1. Open your production URL in **Safari** on iOS.
2. Tap the **Share** button in the Safari toolbar.
3. Scroll down the actions sheet and tap **Add to Home Screen**.
4. Confirm by tapping **Add** in the top right corner.
5. Launch **DuoTrack** from the home screen. The app operates in standalone mode with full viewport height, system haptics, and zero browser navigation chrome.

---

## Automated CI/CD Pipeline

The repository includes [`.github/workflows/release.yml`](./.github/workflows/release.yml) to automate APK compilation and release publishing.

### Workflow Triggering

* **Tag-based Release**: Push a version tag to trigger an automated build:
  ```bash
  git tag v1.0.1
  git push origin v1.0.1
  ```
* **Manual Workflow Dispatch**:
  1. Navigate to the **Actions** tab in GitHub.
  2. Select **Build & Publish DuoTrack APK Release**.
  3. Click **Run workflow**, specify the version tag, and confirm.
  4. The workflow will compile the project with Java 21, run Gradle build tasks, and upload the signed debug APK directly to GitHub Releases.

---

## API Reference

### `POST /api/user`

Handles account provisioning, authentication, password recovery, habit persistence, and partner pairing.

| Action | Payload Parameters | Description |
| :--- | :--- | :--- |
| `register` | `username`, `password`, `displayName`, `securityQuestion`, `securityAnswer` | Registers a new account with PBKDF2-salted password hashing and a recovery question. |
| `login` | `username`, `password` | Authenticates existing users and returns habit progress and pod status. |
| `get_security_question` | `username` | Retrieves the security question associated with an account for password recovery. |
| `reset_password` | `username`, `securityAnswer`, `newPassword` | Verifies the recovery answer and updates the account password. |
| `sync_habits` | `userId`, `habits` (array) | Persists user habits, reminder schedules, streaks, and history. |
| `delete_habit`| `userId`, `habitId` | Removes a habit and its historical record from the database. |
| `pair` | `userId`, `partnerCode` | Connects two users into a synchronized accountability pod. |
| `unpair` | `userId` | Disconnects the pod and returns the user to Solo mode. |

### `POST /api/pod`

Handles live bidirectional habit value updates between paired users.

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `podCode` | `string` | Unique pairing identifier. |
| `userId` | `string` | ID of the updating participant (`user1` or `user2`). |
| `habitId` | `string` | Identifier of the modified habit. |
| `value` | `number \| boolean` | New value to broadcast to the paired client. |

---

## Security and Privacy Policy

* **Salted Password Hashing**: Passwords are never stored in plaintext. DuoTrack uses cryptographic PBKDF2 with SHA-256 and unique 16-byte random salts per user to resist rainbow table and brute-force attacks.
* **Security Question Account Recovery**: Forgotten passwords can be reset via personal security questions without relying on third-party email brokers or SMS gateways. Answers are case-insensitively hashed and salted.
* **Account Impersonation Prevention**: Usernames are strictly guarded; duplicate registrations are rejected, and only authenticated users can access or modify their habit records.
* **Data Sanitization**: All custom habit inputs, unit names, and profile information undergo XSS sanitization prior to database storage and DOM rendering.
* **No Third-Party Telemetry**: DuoTrack includes zero tracking beacons, advertising libraries, or invasive analytic SDKs.
---

## Persistent Session Architecture and Durability

DuoTrack implements a multi-layer storage vault architecture to guarantee that user sessions remain continuously active across devices until an explicit user logout is executed:

* **Dual-Layer Persistence Engine**: Active sessions are written simultaneously to both `localStorage` and an IndexedDB database (`duotrack_vault`).
* **iOS Safari ITP and Cache Flush Protection**: Mobile Safari applies Intelligent Tracking Prevention (ITP) and purges `localStorage` on unused sites after seven days. DuoTrack requests permanent storage rights via `navigator.storage.persist()`. If `localStorage` is cleared by the operating system, DuoTrack automatically recovers the user session, habits, and paired pod state from IndexedDB upon launch, re-seeding `localStorage` with zero interruption.
* **Standalone iOS PWA Support**: In standalone Add-to-Home-Screen display mode, session snapshots survive app closures and background termination.
* **Android Native App Lifecycle**: On Android native builds, the Capacitor WebView SQLite data layer maintains persistent storage through application restarts, background task memory collection, and system reboots.
* **Offline-First Resilience**: DuoTrack never terminates or resets an active session due to network dropouts or backend latency. Users can access, check off, and review their habits without internet access.
* **Multi-Tab State Synchronization**: When running across multiple tabs or browser windows, storage event listeners immediately synchronize authentication state, habit progress, and theme settings in real time.
* **Explicit Session Termination**: Sessions and vault entries are permanently expunged only when the user explicitly triggers "Sign Out" or "Wipe Data".

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for full details.

