import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { themeColors } from './tokens';

export const THEME_PREFERENCES = {
  system: 'system',
  light: 'light',
  dark: 'dark',
};

const THEME_STORAGE_KEY = 'lunentra.appearance';
const VALID_PREFERENCES = new Set(Object.values(THEME_PREFERENCES));
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState(THEME_PREFERENCES.system);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then(storedPreference => {
        if (active && VALID_PREFERENCES.has(storedPreference)) {
          setPreference(storedPreference);
        }
      })
      .catch(error => {
        console.error('No se pudo cargar la apariencia:', error);
      })
      .finally(() => {
        if (active) setIsReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    Appearance.setColorScheme(
      preference === THEME_PREFERENCES.system ? null : preference
    );
  }, [preference]);

  const resolvedScheme = preference === THEME_PREFERENCES.system
    ? systemScheme === 'dark' ? 'dark' : 'light'
    : preference;

  const setThemePreference = useCallback(nextPreference => {
    if (!VALID_PREFERENCES.has(nextPreference)) return;

    setPreference(nextPreference);
    AsyncStorage.setItem(THEME_STORAGE_KEY, nextPreference).catch(error => {
      console.error('No se pudo guardar la apariencia:', error);
    });
  }, []);

  const value = useMemo(() => ({
    colors: themeColors[resolvedScheme],
    isDark: resolvedScheme === 'dark',
    isReady,
    preference,
    resolvedScheme,
    setThemePreference,
  }), [isReady, preference, resolvedScheme, setThemePreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useAppTheme debe usarse dentro de ThemeProvider.');
  }
  return value;
}

export function useThemeStyles(createStyles) {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors, createStyles]);
}
