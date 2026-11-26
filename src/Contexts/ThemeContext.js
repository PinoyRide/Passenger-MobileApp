import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, LightTheme } from '@/Theme';

// The light or the dark look (Settings > Dark mode, ThemeSwitch). Until the
// person chooses, the app follows the phone's own setting, also when that
// changes while the app is open; their choice is kept on the phone. Nothing is
// drawn until the kept choice is read (a few milliseconds, under the loading
// screen), so the app never opens in one look and turns into the other.
// The same file in both apps (sharedUi.test.mjs).

const KEPT_AS = 'theme';
// when the phone's storage does not answer, the app opens anyway
const READ_AT_MOST_MS = 1000;

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const phone = useColorScheme();
  // undefined: not read yet; null: never chosen; 'light' or 'dark'
  const [chosen, setChosen] = useState(undefined);

  useEffect(() => {
    let reading = true;
    const settle = value => {
      if (reading) {
        reading = false;
        setChosen(value === 'light' || value === 'dark' ? value : null);
      }
    };
    const timer = setTimeout(() => settle(null), READ_AT_MOST_MS);
    AsyncStorage.getItem(KEPT_AS)
      .then(settle)
      .catch(() => settle(null));
    return () => {
      reading = false;
      clearTimeout(timer);
    };
  }, []);

  const isDark = chosen ? chosen === 'dark' : phone === 'dark';

  const toggleTheme = useCallback(() => {
    const next = isDark ? 'light' : 'dark';
    setChosen(next);
    AsyncStorage.setItem(KEPT_AS, next).catch(() => {
      // kept until the app closes
    });
  }, [isDark]);

  const value = useMemo(
    () => ({ theme: isDark ? DarkTheme : LightTheme, isDark, toggleTheme }),
    [isDark, toggleTheme],
  );

  if (chosen === undefined) {
    return null;
  }
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return context;
};
