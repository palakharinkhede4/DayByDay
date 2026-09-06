// DayByDay High-Performance Tactile & Audio Engine (Capacitor & Web Audio)
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.idleTimer = null;
    this.setupLifecycleListeners();
  }

  // Hook visibility & first user touch to initialize audio hardware
  setupLifecycleListeners() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend();
        }
      });

      // Warm up audio context on first interactive gesture
      const warmUp = () => {
        this.init();
        document.removeEventListener('pointerdown', warmUp);
        document.removeEventListener('touchstart', warmUp);
      };
      document.addEventListener('pointerdown', warmUp, { passive: true });
      document.addEventListener('touchstart', warmUp, { passive: true });
    }
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext({ latencyHint: 'interactive' });
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.scheduleIdleSuspension();
  }

  // Auto-suspend AudioContext after 4 seconds of silence to prevent memory leaks and save battery
  scheduleIdleSuspension() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    }, 4000);
  }

  // Soft tactile click (like iOS haptic tap / Android M3 click)
  tap() {
    if (!this.enabled) return;
    this.triggerHaptic('light', 35);
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };
    } catch {
      // Audio fallback
    }
  }

  // Micro-tick for progress bar slider scrubbing
  scrub() {
    if (!this.enabled) return;
    this.triggerHaptic('light', 15);
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.02);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.02);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };
    } catch {}
  }

  // Satisfying completion chime
  complete() {
    if (!this.enabled) return;
    this.triggerHaptic('success', [40, 60, 80]);
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Radiant ascending triad: E5, A5, C#6
      [659.25, 880.0, 1108.73].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + i * 0.055;
        const duration = 0.22;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(start);
        osc.stop(start + duration);

        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {}
        };
      });
    } catch {
      // Safe fallback
    }
  }

  // Hardware Haptics via Capacitor with Web Vibration Fallback
  async triggerHaptic(type = 'light', fallbackPattern = 35) {
    try {
      if (type === 'success') {
        await Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      } else if (type === 'medium') {
        await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
      } else {
        await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      }
    } catch {
      // Fallback to browser vibration API
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(fallbackPattern);
        } catch {}
      }
    }
  }

  vibrate(pattern = 35) {
    this.triggerHaptic('light', pattern);
  }
}

export const sound = new SoundEngine();
