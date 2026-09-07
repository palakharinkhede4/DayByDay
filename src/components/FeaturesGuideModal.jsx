import React from 'react';
import {
  CheckCircle2,
  Users,
  HeartHandshake,
  BarChart2,
  FolderPlus,
  Activity,
  Palette,
  X,
  Sparkles,
  MapPin,
  ArrowRight,
} from 'lucide-react';
import { sound } from '../utils/sound';

export const FeaturesGuideModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleClose = () => {
    sound.tap();
    onClose();
  };

  const features = [
    {
      id: 'habits',
      title: 'Habits Tab (Daily Routines & Streaks)',
      icon: CheckCircle2,
      accentColor: '#10B981',
      bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))',
      location: 'Bottom Bar → Habits',
      description: 'Log daily routines with one tap, track countable quantities like steps or water, and build unbroken streaks.',
    },
    {
      id: 'track',
      title: 'Track Tab (Live Social Accountability)',
      icon: Users,
      accentColor: '#3B82F6',
      bgGradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.1))',
      location: 'Bottom Bar → Track',
      description: 'Follow up to 5 friends live using their secret codes, see their real-time habit completion, and send cheering emojis.',
    },
    {
      id: 'together',
      title: 'Together Tab (Duo Pairs & Group Pods)',
      icon: HeartHandshake,
      accentColor: '#F97316',
      bgGradient: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(234, 88, 12, 0.1))',
      location: 'Bottom Bar → Together',
      description: 'Pair 1-on-1 with an accountability partner or join a shared group pod to tackle collaborative milestone targets together.',
    },
    {
      id: 'insights',
      title: 'Insights Tab (Analytics & Consistency)',
      icon: BarChart2,
      accentColor: '#8B5CF6',
      bgGradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(124, 58, 237, 0.1))',
      location: 'Bottom Bar → Insights',
      description: 'View weekly completion percentages, consistency trends, best streaks, and smart analytics to measure your progress.',
    },
    {
      id: 'categories',
      title: 'Custom Categories & Organization',
      icon: FolderPlus,
      accentColor: '#F59E0B',
      bgGradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.1))',
      location: 'Habits Screen → Top Bar [+] Button',
      description: 'Create and color-code personalized categories (like Fitness, Work, Mind) to filter and organize your daily routine.',
    },
    {
      id: 'health_sync',
      title: 'Sync with Health App (Android & Apple Health)',
      icon: Activity,
      accentColor: '#00D284',
      bgGradient: 'linear-gradient(135deg, rgba(0, 210, 132, 0.2), rgba(16, 185, 129, 0.1))',
      location: 'Settings Menu → Health & Fitness Sync',
      description: 'Automatically imports your step count every 30 minutes from your phone directly into your habits and shared pod goals.',
    },
    {
      id: 'themes',
      title: 'Themes, Modes & Personalization',
      icon: Palette,
      accentColor: '#EC4899',
      bgGradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(219, 39, 119, 0.1))',
      location: 'Settings Menu → Appearance & Theme',
      description: 'Customize your look with high-contrast Light mode, sleek Dark mode, Android Material You colors, or System Auto.',
    },
  ];

  return (
    <div className="features-guide-overlay" onClick={handleClose}>
      <div className="features-guide-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="features-guide-header">
          <div className="features-guide-header-left">
            <div className="features-guide-badge-icon">
              <Sparkles size={20} className="text-amber-400" />
            </div>
            <div>
              <h2 className="features-guide-title font-extrabold">Welcome to DayByDay</h2>
              <p className="features-guide-subtitle">
                Here is a quick tour of all features available to help you build great habits.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="features-guide-close-btn"
            onClick={handleClose}
            aria-label="Close guide"
          >
            <X size={18} />
          </button>
        </div>

        {/* Features List */}
        <div className="features-guide-list">
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="features-guide-card">
                <div
                  className="features-guide-card-icon"
                  style={{ background: item.bgGradient, color: item.accentColor }}
                >
                  <Icon size={20} />
                </div>
                <div className="features-guide-card-body">
                  <div className="features-guide-card-top">
                    <span className="features-guide-card-title font-bold">{item.title}</span>
                    <span className="features-guide-card-badge">
                      <MapPin size={10} style={{ marginRight: 2 }} />
                      {item.location}
                    </span>
                  </div>
                  <p className="features-guide-card-desc">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="features-guide-footer">
          <div className="features-guide-footer-hint">
            💡 You can re-open this anytime in <strong>Settings → App Feature Guide</strong>.
          </div>
          <button
            type="button"
            className="features-guide-cta-btn font-bold"
            onClick={handleClose}
          >
            <span>Got It, Let's Start! 🚀</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
