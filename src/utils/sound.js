// DuoTrack High-Performance Tactile & Audio Engine (Memory-Optimized)

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.idleTimer = null;
    this.setupLifecycleListeners();
  }

  // Hook visibility changes to aggressively release audio hardware & memory
  setupLifecycleListeners() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend();
        }
      });
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
      this.ctx.resume();
    }
    this.scheduleIdleSuspension();
  }

  // Auto-suspend AudioContext after 3 seconds of silence to prevent memory leaks and save battery
  scheduleIdleSuspension() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend();
      }
    }, 3000);
  }

  // Soft tactile click (like iOS haptic tap / Android M3 click)
  tap() {
    if (!this.enabled) return;
    this.vibrate(10);
    try {
      this.init();
      if (!this.ctx) return;
      
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.035);
      
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.035);

      // Clean up nodes after playback to prevent memory retention
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch { }
      };
    } catch {
      // Autoplay or audio restriction fallback
    }
  }

  // Satisfying completion chime
  complete() {
    if (!this.enabled) return;
    this.vibrate([15, 30, 20]);
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      
      [659.25, 880.0, 1046.5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + i * 0.05;
        const duration = 0.16;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.09, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(start);
        osc.stop(start + duration);

        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch { }
        };
      });
    } catch {
      // Safe fallback
    }
  }

  // Native haptic feedback
  vibrate(pattern = 10) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch { }
    }
  }
}

export const sound = new SoundEngine();
