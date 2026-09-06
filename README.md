<div align="center">

# 🔥 DuoTrack
### Production Co-Op Habit Tracking for Individuals, Best Friends & Couples

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Neon Database](https://img.shields.io/badge/Neon-PostgreSQL-00E599?style=for-the-badge&logo=postgresql&logoColor=black)](https://neon.tech/)
[![Capacitor](https://img.shields.io/badge/Capacitor-Android-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Serverless%20Sync-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-CI%2FCD-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/palakharinkhede4/DuoTrack/actions)
[![License](https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge)](LICENSE)

*Inspired by Cedlom's viral journey (**"I Built an App with 0 Experience"**), re-engineered as a production application with **Real User Accounts**, **Solo & Together Modes**, **Neon PostgreSQL**, **Light/Dark/Auto Themes**, and **Cross-Platform Responsive Layouts**.*

[📥 Download Android APK (v1.0)](./DuoTrack.apk) • [🚀 Deploy to Vercel](#-deploy-to-vercel--neon-db) • [✨ Key Features](#-key-features) • [🍎 iOS Setup](#-ios-installation-safari-pwa) • [🤖 Automated APK Releases](#-automated-apk-releases-via-github-actions)

---

</div>

## 📖 The Philosophy: Solo by Default, Together on Demand

Building habits starts with personal consistency. **DuoTrack** lets any user track their own routines solo. Whenever you want an accountability partner, family member, or friend to keep an eye on you, simply share your unique **Secret Code** (e.g. `PLK-8429`). They can connect from their phone or laptop to view and synchronize habits with you live!

---

## ✨ Key Features

### 👤 1. Real User Accounts & Secret Code Sharing
- **Unique @Username**: Pick your identity on first launch (e.g. `@palak`).
- **Private Secret Code**: Generates a shareable key for easy pairing without complex passwords.
- **Solo Mode by Default**: Track sleep, steps, meditation, water, reading, workouts, and vitamins independently.
- **Accountability Partner Mode**: Connect with a partner to turn on the dual-colored Together Pod dial.

### 🌓 2. Light / Dark / Auto (System) Theme Modes
- **Light Mode ☀️**: Clean porcelain surfaces with crisp slate typography and soft drop shadows.
- **Dark Mode 🌙**: Deep obsidian and emerald tones with high-contrast glowing indicators.
- **Auto Mode ⚙️**: Automatically mirrors your device's system appearance (`prefers-color-scheme`).

### 📱 3. Responsive Web & Mobile Layouts
- **Desktop / Laptop Viewport**: Spacious, modern web application dashboard (multi-column cards, sticky header, profile chip, zero fake phone bezels).
- **Mobile Viewport (iOS & Android)**: Edge-to-edge native layout with safe-area insets, Dynamic Island activity alerts, and bottom tab bar.
- **Auto OS Detection**: Automatically loads **iOS 18 Liquid Glass** on Apple devices or **Android 16 Material 3 Expressive** on Android phones.

### 🎯 4. Signature Progress Dial & Habit Cards
- **Adaptive Dotted Arch Dial**: 22-segment curved arc. Fills continuously across the arch in Solo mode, and splits side-by-side in Together mode.
- **💤 Sleep Cycles**: Horizontal segmented sleep bars comparing hours & minutes.
- **👟 Steps**: Concentric circular progress rings with quick `+500` and `+1.5k` steppers.
- **🧘 Meditation**: Mindfulness breathing pulse animation with quick minutes logger.
- **💧 Hydration**: Interactive liquid pint counter with tactile drink action.
- **📖 Reading & 🏋️ Workouts**: Visual bookmark meters and active exercise hero tracking.
- **💊 Vitamins**: AM/PM split toggle pill with micro-animations.
- **🌱 Beyond Today**: Periodic shared goals for Savings (`$`) and Weight (`lbs`).

### 📱 5. Symmetrical 5-Widget Suite (Both OSs)
1. **Small (2×2) Pod Sync Ring**: Frosted glass squircle / M3 surface dial.
2. **Medium (4×2) Shared Pod Progress**: Side-by-side user progress with inline action chips.
3. **Bento (4×2) Dashboard Card**: Pod score, step rings, vitamin check, and instant partner ping.
4. **Scalloped (2×2) Organic Dial**: Tactile circular gauge with quick logger button.
5. **Lock Screen Minimal Capsule**: At-a-glance lock screen status widget.

---

## 🐘 Deploy to Vercel & Neon PostgreSQL

DuoTrack runs serverless on Vercel and connects to **Neon Serverless PostgreSQL** for permanent, robust data storage.

```mermaid
sequenceDiagram
    autonumber
    actor User as User (@palak)
    participant Vercel as Vercel Serverless (/api/user & /api/pod)
    participant Neon as Neon PostgreSQL Database
    actor Partner as Partner (@alex)

    User->>Vercel: POST /api/user (create @palak, code: PLK-8429)
    Vercel->>Neon: INSERT INTO duotrack_users
    Neon-->>Vercel: User saved
    Vercel-->>User: Registered!
    Partner->>Vercel: POST /api/user (action: 'pair', code: 'PLK-8429')
    Vercel->>Neon: INSERT INTO duotrack_pairings
    Neon-->>Vercel: Paired!
    Vercel-->>Partner: Linked with @palak
    Vercel-->>User: Live 4s poll reflects partner in real time!
```

### 1-Minute Setup:
1. **Create Free Neon Database**:
   - Go to [neon.tech](https://neon.tech) and create a free PostgreSQL project.
   - Copy your connection string (`postgres://user:password@ep-xxx.neon.tech/neondb?sslmode=require`).
2. **Add to Vercel**:
   - Go to your project on [vercel.com](https://vercel.com) &rarr; **Settings** &rarr; **Environment Variables**.
   - Add variable: `DATABASE_URL` = your Neon connection string.
   - Redeploy.
3. **Automatic Migration**:
   - DuoTrack automatically creates the `duotrack_users`, `duotrack_habits`, and `duotrack_pairings` tables on its first query!

*(Note: Even before setting `DATABASE_URL`, DuoTrack includes an in-memory/local storage fallback so it works immediately without breaking!)*

---

## 🍎 iOS Installation (Safari PWA)

Apple blocks sideloading `.ipa` files directly from WhatsApp or Google Drive. DuoTrack is configured as a standalone **Progressive Web App (PWA)**:

1. Open your Vercel URL in **Safari** on your iPhone.
2. Tap the **Share** button (the square with an arrow pointing up ⎋) at the bottom.
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add** in the top right corner.
5. Launch **DuoTrack** from your home screen — it runs full-screen with native safe areas, haptics, and zero browser bars!

---

## 🤖 Automated APK Releases via GitHub Actions

This repository includes [`.github/workflows/release.yml`](./.github/workflows/release.yml) to automatically compile and publish the Android APK to GitHub's **Releases** tab:

* **Automatic Release on Tag**: Push any version tag to trigger a release:
  ```bash
  git tag v1.0.1
  git push origin v1.0.1
  ```
* **Manual One-Click Release**:
  - Go to the **Actions** tab on your GitHub repo.
  - Select **"Build & Publish DuoTrack APK Release"**.
  - Click **"Run workflow"** &rarr; Enter your version tag &rarr; Click **Run**.
  - GitHub Actions will build the APK with Gradle and upload it to GitHub Releases automatically!

---

## 💻 Local Development

```bash
# Clone the repository
git clone https://github.com/palakharinkhede4/DuoTrack.git
cd DuoTrack

# Install dependencies
npm install

# Start Vite dev server
npm run dev

# Build production bundle
npm run build

# Build Android APK locally
npx cap sync android
cd android && ./gradlew assembleDebug
```

---

## 📄 License
MIT © [Palak Harinkhede](https://github.com/palakharinkhede4)
