import React, { useState } from 'react';
import { HabitProvider } from './context/HabitContext';
import { AppLayout } from './components/AppLayout';
import { MyHabitsScreen } from './screens/MyHabitsScreen';
import { TrackScreen } from './screens/TrackScreen';
import { TogetherScreen } from './screens/TogetherScreen';
import { InsightsScreen } from './screens/InsightsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { PairingModal } from './components/PairingModal';
import { AddGoalModal } from './components/AddGoalModal';
import { OnboardingModal } from './components/OnboardingModal';
import { IosInstallPrompt } from './components/IosInstallPrompt';

class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Screen caught error:', error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.activeTab !== this.props.activeTab && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--text-primary)' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: 700 }}>View Error</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            {this.state.error?.message || 'An unexpected error occurred while rendering this screen.'}
          </p>
          <button
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '10px',
              background: 'var(--primary, #00D284)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onReset) this.props.onReset();
            }}
          >
            Back to Habits
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const MainAppContent = () => {
  const [activeTab, setActiveTab] = useState('habits');
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);

  return (
    <div className="app-root">
      {/* Dynamic iOS Pop-up (shows only on iOS browser) */}
      <IosInstallPrompt />

      {/* Main Responsive Application Layout */}
      <AppLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenAddGoal={() => setIsAddGoalOpen(true)}
      >
        <ScreenErrorBoundary activeTab={activeTab} onReset={() => setActiveTab('habits')}>
          {activeTab === 'habits' && (
            <MyHabitsScreen
              onOpenSettings={() => setActiveTab('settings')}
              onOpenAddGoal={() => setIsAddGoalOpen(true)}
            />
          )}

          {activeTab === 'track' && <TrackScreen />}

          {activeTab === 'together' && <TogetherScreen />}

          {activeTab === 'insights' && <InsightsScreen />}

          {activeTab === 'settings' && (
            <SettingsScreen
              onOpenPairing={() => setIsPairingOpen(true)}
              onOpenAddGoal={() => setIsAddGoalOpen(true)}
            />
          )}
        </ScreenErrorBoundary>
      </AppLayout>

      {/* Modals */}
      <OnboardingModal />

      <PairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
      />

      <AddGoalModal
        isOpen={isAddGoalOpen}
        onClose={() => setIsAddGoalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <HabitProvider>
      <MainAppContent />
    </HabitProvider>
  );
}
