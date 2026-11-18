import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { ThemeProvider, useThemePreference } from '@/hooks/theme-provider';
import { useTheme } from '@/hooks/use-theme';

if (Platform.OS !== 'web') {
  void SplashScreen.preventAutoHideAsync().catch((error: unknown) => {
    console.error('Unable to hold the splash screen while loading appearance.', error);
  });
}

function RootNavigator() {
  const { isReady, resolvedTheme } = useThemePreference();
  const colors = useTheme();

  useEffect(() => {
    if (isReady && Platform.OS !== 'web') {
      void SplashScreen.hideAsync().catch((error: unknown) => {
        console.error('Unable to hide the splash screen.', error);
      });
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}
