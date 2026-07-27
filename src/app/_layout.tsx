import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { seedIfNeeded } from '@/db/seed';
import { useSettingsStore } from '@/features/settings/store';
import { queryClient } from '@/lib/query-client';
import { Text } from '@/ui/components';
import { ThemeProvider, useTheme } from '@/ui/theme';

SplashScreen.preventAutoHideAsync();

/** Blocks rendering until migrations + first-run seed complete. */
function DatabaseGate({ children, onReady }: { children: ReactNode; onReady: () => void }) {
  const { success, error } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (success) {
      seedIfNeeded()
        .catch((e) => console.error('Seed failed', e))
        .finally(() => {
          setSeeded(true);
          onReady();
        });
    }
  }, [success, onReady]);

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

function ThemedApp({ onDbReady }: { onDbReady: () => void }) {
  const theme = useTheme();

  useEffect(() => {
    // Keeps the native root view in sync with the theme (no white flash in dark mode).
    void SystemUI.setBackgroundColorAsync(theme.colors.bg);
  }, [theme]);

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <DatabaseGate onReady={onDbReady}>
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
  const [dbReady, setDbReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded && dbReady) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, dbReady]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider preference={themePreference}>
        <ThemedApp onDbReady={() => setDbReady(true)} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
