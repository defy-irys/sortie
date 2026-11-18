import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextType = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => Promise<void>;
  resolvedTheme: 'light' | 'dark';
  isReady: boolean;
};

const STORAGE_KEY = 'sortie:theme-preference';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] =
    useState<ThemePreference>('system');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const restorePreference = async () => {
      try {
        const savedPreference = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedPreference !== null) {
          if (isThemePreference(savedPreference)) {
            if (mounted) {
              setPreferenceState(savedPreference);
            }
          } else {
            console.warn('Ignoring an invalid saved appearance preference.');
          }
        }
      } catch (error) {
        console.error('Unable to restore the saved appearance preference.', error);
      } finally {
        if (mounted) {
          setIsReady(true);
        }
      }
    };

    void restorePreference();
    return () => {
      mounted = false;
    };
  }, []);

  const resolvedTheme =
    preference === 'system'
      ? systemScheme === 'dark' ? 'dark' : 'light'
      : preference;

  useEffect(() => {
    if (isReady && Platform.OS !== 'web') {
      Appearance.setColorScheme(
        preference === 'system' ? 'auto' : preference
      );
    }
  }, [isReady, preference]);

  const setPreference = async (value: ThemePreference) => {
    setPreferenceState(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      console.error('Unable to save the appearance preference.', error);
      throw error;
    }
  };

  return (
    <ThemeContext.Provider
      value={{ preference, setPreference, resolvedTheme, isReady }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemePreference() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      'useThemePreference must be used inside ThemeProvider'
    );
  }

  return context;
}
