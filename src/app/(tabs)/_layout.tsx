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
        headerTitleStyle: { fontFamily: type.headline.fontFamily },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.hairline },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkTertiary,
        tabBarLabelStyle: { fontFamily: type.caption.fontFamily },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Rankings',
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
