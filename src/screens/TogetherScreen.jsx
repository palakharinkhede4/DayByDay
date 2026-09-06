import React from 'react';
import { HeaderDial } from '../components/HeaderDial';
import { HabitCards } from '../components/HabitCards';
import { useHabits } from '../context/HabitContext';

export const TogetherScreen = ({ onOpenSettings, onOpenAddGoal }) => {
  const { osMode } = useHabits();

  return (
    <div className="screen-together-container">
      {/* Top Header with Dotted Arch Progress Dial */}
      <HeaderDial onOpenSettings={onOpenSettings} onOpenAddGoal={onOpenAddGoal} />

      {/* Habit Cards (Sleep, Steps, Meditation, Water, Reading, Workouts, Vitamins, Beyond) */}
      <HabitCards onOpenAddGoal={onOpenAddGoal} />

      {/* Material 3 Expressive Floating Action Button (FAB) or iOS Floating Add Button */}
      {osMode === 'android' ? (
        <button
          className="m3-fab-extended"
          onClick={onOpenAddGoal}
          title="Add New Goal (Material 3 Expressive FAB)"
        >
          <span className="fab-icon">+</span>
          <span className="fab-text font-bold">Add Goal</span>
        </button>
      ) : (
        <button
          className="ios-floating-add-btn"
          onClick={onOpenAddGoal}
          title="Add Goal"
        >
          <span className="ios-add-plus">+</span>
        </button>
      )}
    </div>
  );
};
