import React from 'react';
import { useAppTheme } from '@/Contexts/ThemeContext';
import SettingRow from '@/Components/SettingRow/SettingRow';

// The light or dark look of the app, as one line of a settings group.
const ThemeSwitch = () => {
  const { isDark, toggleTheme } = useAppTheme();

  return (
    <SettingRow
      icon={isDark ? 'weather-night' : 'white-balance-sunny'}
      title="Dark mode"
      value={isDark}
      onToggle={toggleTheme}
    />
  );
};

export default ThemeSwitch;
