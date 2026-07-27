import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/ui/theme';

export default function TabsLayout() {
  const { colors, type } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: type.title.fontFamily, fontSize: 22 },
        headerShadowVisible: false,
        // Scoreboard footer: deep navy with the lime accent on the active tab.
        tabBarStyle: { backgroundColor: colors.navy, borderTopColor: colors.navyHairline },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.navyInkSecondary,
        tabBarLabelStyle: { fontFamily: type.caption.fontFamily },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Table',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="podium-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="claims"
        options={{
          title: 'Claims',
          tabBarIcon: ({ color, size }) => <Ionicons name="documents-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
