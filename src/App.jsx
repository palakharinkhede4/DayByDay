import React, { useState } from 'react';
import { HabitProvider } from './context/HabitContext';
import { AppLayout } from './components/AppLayout';
import { MyHabitsScreen } from './screens/MyHabitsScreen';
import { TrackScreen } from './screens/TrackScreen';
import { TogetherScreen } from './screens/TogetherScreen';
import { InsightsScreen } from './screens/InsightsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { BottomNavBar } from './components/BottomNavBar';
import { PairingModal } from './components/PairingModal';
import { AddGoalModal } from './components/AddGoalModal';
import { OnboardingModal } from './components/OnboardingModal';
import { IosInstallPrompt } from './components/IosInstallPrompt';

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

        {/* Mobile Bottom Navigation Bar (Hidden on Desktop via CSS) */}
        <BottomNavBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
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
