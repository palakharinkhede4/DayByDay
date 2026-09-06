import React, { useState, useEffect } from 'react';
import { HabitProvider } from './context/HabitContext';
import { AppLayout } from './components/AppLayout';
import { MyHabitsScreen } from './screens/MyHabitsScreen';
import { TrackScreen } from './screens/TrackScreen';
import { TogetherScreen } from './screens/TogetherScreen';
import { InsightsScreen } from './screens/InsightsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { PairingModal } from './components/PairingModal';
import { AddGoalModal } from './components/AddGoalModal';
import { UpdateModal } from './components/UpdateModal';
import { IosInstallPrompt } from './components/IosInstallPrompt';
import { AuthScreen } from './screens/AuthScreen';
import { useHabits } from './context/HabitContext';
import { checkForAppUpdate } from './utils/updateChecker';

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
              background: 'var(--primary, #1A56C4)',
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
  const { user, isSessionRestoring } = useHabits();
  const [activeTab, setActiveTab] = useState('habits');
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Automatically check for new releases when app opens (native Android APK & Web)
  useEffect(() => {
    let isCancelled = false;
    const checkUpdates = async () => {
      try {
        const info = await checkForAppUpdate();
        if (!isCancelled && info?.success && info?.updateAvailable) {
          setUpdateInfo(info);
          setIsUpdateModalOpen(true);
        }
      } catch (err) {
        console.warn('Startup update check notice:', err);
      }
    };

    const timer = setTimeout(checkUpdates, 1500);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // While restoring session from IndexedDB Vault, show a calm splash state
  if (isSessionRestoring) {
    return (
      <div className="auth-splash-loader">
        <div className="splash-logo-wrap">
          <img src="./icon.png" alt="DayByDay" className="splash-logo" />
          <div className="splash-spinner-ring" />
        </div>
      </div>
    );
  }

  // If not authenticated, render full-page AuthScreen like real native Android/iOS apps
  if (!user || !user.username) {
    return (
      <>
        <AuthScreen />
        <UpdateModal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          updateInfo={updateInfo}
        />
      </>
    );
  }

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

      {/* In-App Modals */}
      <PairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
      />

      <AddGoalModal
        isOpen={isAddGoalOpen}
        onClose={() => setIsAddGoalOpen(false)}
      />

      {/* In-App Update Modal */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateInfo={updateInfo}
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
