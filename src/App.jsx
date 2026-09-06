import React, { useState } from 'react';
import { HabitProvider } from './context/HabitContext';
import { AppLayout } from './components/AppLayout';
import { TogetherScreen } from './screens/TogetherScreen';
import { InsightsScreen } from './screens/InsightsScreen';
import { WidgetsScreen } from './screens/WidgetsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { BottomNavBar } from './components/BottomNavBar';
import { PairingModal } from './components/PairingModal';
import { AddGoalModal } from './components/AddGoalModal';
import { OnboardingModal } from './components/OnboardingModal';
import { IOSInstallBanner } from './components/IOSInstallBanner';

const MainAppContent = () => {
  const [activeTab, setActiveTab] = useState('together');
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);

  return (
    <div className="app-root">
      {/* Smart iOS Install Banner (shows only on iOS Safari) */}
      <IOSInstallBanner />

      {/* Main Responsive Application Layout */}
      <AppLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenPairing={() => setIsPairingOpen(true)}
        onOpenAddGoal={() => setIsAddGoalOpen(true)}
      >
        {activeTab === 'together' && (
          <TogetherScreen
            onOpenSettings={() => setActiveTab('settings')}
            onOpenAddGoal={() => setIsAddGoalOpen(true)}
            onOpenPairing={() => setIsPairingOpen(true)}
          />
        )}

        {activeTab === 'insights' && <InsightsScreen />}

        {activeTab === 'widgets' && <WidgetsScreen />}

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
