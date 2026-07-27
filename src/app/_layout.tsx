import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { useDatabaseReady } from '@/db/migrate';
import { seedIfNeeded } from '@/db/seed';
import { useSettingsStore } from '@/features/settings/store';
import { queryClient } from '@/lib/query-client';
import { Text } from '@/ui/components';
import { ThemeProvider, useTheme } from '@/ui/theme';

SplashScreen.preventAutoHideAsync();

/**
 * Blocks rendering until migrations + first-run seed settle.
 * `onSettled` fires on BOTH success and failure — the splash must always lift
 * so the error screen is reachable.
 */
function DatabaseGate({ children, onSettled }: { children: ReactNode; onSettled: () => void }) {
  const { success, error } = useDatabaseReady();
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (error) {
      onSettled();
      return;
    }
    if (success) {
      seedIfNeeded()
        .catch((e) => console.error('Seed failed', e))
        .finally(() => {
          setSeeded(true);
          onSettled();
        });
    }
  }, [success, error, onSettled]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text variant="headline">Something went wrong</Text>
        <Text variant="secondary" color="inkSecondary" style={{ textAlign: 'center' }}>
          The database could not be prepared. Please reinstall the app.
        </Text>
      </View>
    );
  }
  if (!success || !seeded) {
    return null; // splash stays visible
  }
  return <>{children}</>;
}

function ThemedApp({ onDbSettled }: { onDbSettled: () => void }) {
  const theme = useTheme();

  useEffect(() => {
    // Keeps the native root view in sync with the theme (no white flash in dark mode).
    void SystemUI.setBackgroundColorAsync(theme.colors.bg);
  }, [theme]);

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <DatabaseGate onSettled={onDbSettled}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.bg },
            headerTintColor: theme.colors.ink,
            headerTitleStyle: { fontFamily: theme.type.headline.fontFamily },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: theme.colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="journalist/[id]" options={{ title: 'Journalist' }} />
          <Stack.Screen
            name="journalist/new"
            options={{ title: 'New journalist', presentation: 'modal' }}
          />
          <Stack.Screen name="claim/[id]" options={{ title: 'Claim' }} />
          <Stack.Screen name="claim/new" options={{ title: 'New claim', presentation: 'modal' }} />
          <Stack.Screen name="gallery" options={{ title: 'Gallery' }} />
        </Stack>
      </DatabaseGate>
    </>
  );
}

export default function RootLayout() {
  const themePreference = useSettingsStore((s) => s.themePreference);
  const [dbSettled, setDbSettled] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    BarlowCondensed_700Bold,
  });
  // A font failure must not deadlock the splash — render with fallback fonts.
  const fontsSettled = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (fontsSettled && dbSettled) {
      void SplashScreen.hideAsync();
    }
  }, [fontsSettled, dbSettled]);

  if (!fontsSettled) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider preference={themePreference}>
        <ThemedApp onDbSettled={() => setDbSettled(true)} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
