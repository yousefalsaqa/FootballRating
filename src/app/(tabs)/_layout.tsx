import { Tabs } from 'expo-router';

import { useDedupeClaims } from '@/features/claims/hooks';
import { useAutoFileIncoming, useAutoResolve } from '@/features/inbox/hooks';
import { useLedgerSync } from '@/features/settings/hooks';
import { useTheme } from '@/ui/theme';

export default function TabsLayout() {
  const { colors, rules, type } = useTheme();
  // Collapses any duplicate filings first, then files fresh wire reports,
  // records conclusive outcomes, and syncs the shared ledger (all managed
  // from Desk).
  useDedupeClaims();
  useAutoFileIncoming();
  useAutoResolve();
  useLedgerSync();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: type.title.fontFamily, fontSize: 21, textTransform: 'uppercase' },
        headerShadowVisible: false,
        // Flat publication strip: paper, strong top rule, text-first labels.
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopWidth: rules.medium,
          borderTopColor: colors.ruleStrong,
          height: 58,
        },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkTertiary,
        tabBarIconStyle: { display: 'none' },
        tabBarItemStyle: { justifyContent: 'center' },
        tabBarLabelStyle: {
          fontFamily: type.stamp.fontFamily,
          fontSize: 11,
          letterSpacing: 1.1,
          textTransform: 'uppercase',
          lineHeight: 40,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Rankings', headerShown: false }} />
      <Tabs.Screen name="claims" options={{ title: 'Reports', headerShown: false }} />
      <Tabs.Screen name="settings" options={{ title: 'Desk' }} />
    </Tabs>
  );
}
