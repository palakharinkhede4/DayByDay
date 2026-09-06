import React, { useState } from 'react';
import { HabitProvider, useHabits } from './context/HabitContext';
import { OSBar } from './components/OSBar';
import { PhoneFrame } from './components/PhoneFrame';
import { TogetherScreen } from './screens/TogetherScreen';
import { InsightsScreen } from './screens/InsightsScreen';
import { WidgetsScreen } from './screens/WidgetsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { BottomNavBar } from './components/BottomNavBar';
import { PairingModal } from './components/PairingModal';
import { AddGoalModal } from './components/AddGoalModal';

const MainAppContent = () => {
  const [activeTab, setActiveTab] = useState('together');
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);

  return (
    <div className="app-root">
      {/* Top Desktop Controls Toolbar */}
      <OSBar
        onOpenPairing={() => setIsPairingOpen(true)}
        onOpenAddGoal={() => setIsAddGoalOpen(true)}
      />

      {/* Phone Mockup Frame or Fullscreen Device */}
      <PhoneFrame>
        {activeTab === 'together' && (
          <TogetherScreen
            onOpenSettings={() => setActiveTab('settings')}
            onOpenAddGoal={() => setIsAddGoalOpen(true)}
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

        {/* Dynamic Navigation Bar (Android M3 vs iOS Cupertino) */}
        <BottomNavBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </PhoneFrame>

      {/* Modals */}
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
