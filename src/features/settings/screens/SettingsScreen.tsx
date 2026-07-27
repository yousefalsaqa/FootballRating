import Constants from 'expo-constants';
import { View } from 'react-native';

import { useSettingsStore } from '@/features/settings/store';
import { Card, KeyValueRow, Screen, SegmentedControl, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

/** Settings tab: appearance and app info. Data controls arrive with export. */
export function SettingsScreen() {
  const { space } = useTheme();
  const { themePreference, setThemePreference } = useSettingsStore();

  return (
    <Screen>
      <View style={{ gap: space.xl, paddingTop: space.lg }}>
        <View style={{ gap: space.sm }}>
          <Text variant="caption" color="inkTertiary">
            Appearance
          </Text>
          <SegmentedControl
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={themePreference}
            onChange={setThemePreference}
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Text variant="caption" color="inkTertiary">
            About
          </Text>
          <Card>
            <KeyValueRow label="Version" value={Constants.expoConfig?.version ?? '—'} />
            <KeyValueRow label="Data" value="Stored only on this device" />
          </Card>
        </View>
      </View>
    </Screen>
  );
}
