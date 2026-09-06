import React from 'react';
import { useHabits } from '../context/HabitContext';
import { sound } from '../utils/sound';
import {
  CheckCircle2,
  Eye,
  Users,
  BarChart3,
  Settings,
} from 'lucide-react';

export const BottomNavBar = ({ activeTab, onTabChange }) => {
  const { osMode } = useHabits();

  const tabs = [
    {
      id: 'habits',
      label: 'Habits',
      icon: <CheckCircle2 size={20} strokeWidth={2.2} />,
    },
    {
      id: 'track',
      label: 'Track',
      icon: <Eye size={20} strokeWidth={2.2} />,
    },
    {
      id: 'together',
      label: 'Together',
      icon: <Users size={20} strokeWidth={2.2} />,
    },
    {
      id: 'insights',
      label: 'Insights',
      icon: <BarChart3 size={20} strokeWidth={2.2} />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={20} strokeWidth={2.2} />,
    },
  ];

  return (
    <nav className={`bottom-navigation-bar ${osMode}`} aria-label="Main Navigation">
      <div className="nav-inner">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`nav-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => {
                sound.selection();
                onTabChange(tab.id);
              }}
              aria-selected={isActive}
            >
              {osMode === 'android' ? (
                <div className="m3-indicator-pill-wrap">
                  <div className={`m3-indicator-pill ${isActive ? 'active' : ''}`}>
                    {tab.icon}
                  </div>
                  <span className="nav-tab-label font-bold">{tab.label}</span>
                </div>
              ) : (
                <div className="ios-tab-wrap">
                  <div className="ios-tab-icon">{tab.icon}</div>
                  <span className="nav-tab-label font-medium">{tab.label}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
