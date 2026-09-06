import React from 'react';
import { HeaderDial } from '../components/HeaderDial';
import { HabitCards } from '../components/HabitCards';
import { useHabits } from '../context/HabitContext';
import { Plus } from 'lucide-react';

export const MyHabitsScreen = ({ onOpenSettings, onOpenAddGoal }) => {
  const { osMode } = useHabits();

  return (
    <div className="screen-habits-container">
      {/* Top Header with Circular Progress Ring & Day Summary */}
      <HeaderDial onOpenSettings={onOpenSettings} onOpenAddGoal={onOpenAddGoal} />

      {/* Modern Interactive Habit Cards */}
      <HabitCards onOpenAddGoal={onOpenAddGoal} />

      {/* Floating Action Button (Mobile) */}
      <button
        className="floating-add-fab"
        onClick={onOpenAddGoal}
        title="Add New Goal"
        aria-label="Add New Goal"
      >
        <Plus size={22} strokeWidth={2.6} />
      </button>
    </div>
  );
};
