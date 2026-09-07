import React from 'react';
import {
  CheckCircle2,
  Users,
  HeartHandshake,
  BarChart2,
  Activity,
  Palette,
  X,
  Compass,
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
      title: 'Habits',
      icon: CheckCircle2,
      accentColor: '#10B981',
      bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.08))',
      location: 'Habits Tab',
      description: 'Log daily routines with one tap, track steps and water, and maintain streaks.',
    },
    {
      id: 'track',
      title: 'Track Friends',
      icon: Users,
      accentColor: '#3B82F6',
      bgGradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.08))',
      location: 'Track Tab',
      description: 'Follow up to 5 friends live with their code and send real-time encouragement.',
    },
    {
      id: 'together',
      title: 'Together Pods',
      icon: HeartHandshake,
      accentColor: '#F97316',
      bgGradient: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(234, 88, 12, 0.08))',
      location: 'Together Tab',
      description: 'Pair with a partner or join up to 5 group pods with shared milestone targets.',
    },
    {
      id: 'insights',
      title: 'Insights & Trends',
      icon: BarChart2,
      accentColor: '#8B5CF6',
      bgGradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(124, 58, 237, 0.08))',
      location: 'Insights Tab',
      description: 'Check completion rates, weekly consistency graphs, and streak records.',
    },
    {
      id: 'health_sync',
      title: 'Health & Fitness Sync',
      icon: Activity,
      accentColor: '#00D284',
      bgGradient: 'linear-gradient(135deg, rgba(0, 210, 132, 0.15), rgba(16, 185, 129, 0.08))',
      location: 'Settings Menu',
      description: 'Syncs your daily steps automatically every 30 minutes into habits and pod goals.',
    },
    {
      id: 'themes',
      title: 'Themes & Modes',
      icon: Palette,
      accentColor: '#EC4899',
      bgGradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(219, 39, 119, 0.08))',
      location: 'Settings Menu',
      description: 'Switch between Dark mode, Light mode, or Material You system themes.',
    },
  ];

  return (
    <div className="features-guide-overlay" onClick={handleClose}>
      <div className="features-guide-modal compact-guide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="features-guide-header">
          <div className="features-guide-header-left">
            <div className="features-guide-badge-icon">
              <Compass size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="features-guide-title font-bold">App Overview</h2>
              <p className="features-guide-subtitle">
                Core features to help you build and maintain daily momentum.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="features-guide-close-btn"
            onClick={handleClose}
            aria-label="Close guide"
          >
            <X size={16} />
          </button>
        </div>

        {/* Features List */}
        <div className="features-guide-list compact-list">
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="features-guide-card compact-card">
                <div
                  className="features-guide-card-icon compact-icon"
                  style={{ background: item.bgGradient, color: item.accentColor }}
                >
                  <Icon size={18} />
                </div>
                <div className="features-guide-card-body">
                  <div className="features-guide-card-top">
                    <span className="features-guide-card-title font-semibold">{item.title}</span>
                    <span className="features-guide-card-badge">
                      <MapPin size={9} style={{ marginRight: 2 }} />
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
            You can re-open this guide anytime in Settings → App Feature Guide.
          </div>
          <button
            type="button"
            className="features-guide-cta-btn font-semibold"
            onClick={handleClose}
          >
            <span>Get Started</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
