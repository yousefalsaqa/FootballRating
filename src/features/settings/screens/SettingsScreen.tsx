import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { DAILY_BUDGET } from '@/features/football/cache';
import { useApiUsage } from '@/features/football/hooks';
import { exportDataToFile, importDataFromFile } from '@/features/settings/data-export';
import { useSettingsStore } from '@/features/settings/store';
import { Button, Card, KeyValueRow, Screen, SegmentedControl, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

/** Settings tab: appearance and app info. Data controls arrive with export. */
export function SettingsScreen() {
  const { space } = useTheme();
  const { themePreference, setThemePreference } = useSettingsStore();
  const usageQuery = useApiUsage();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const runExport = async () => {
    setBusy(true);
    try {
      await exportDataToFile(Date.now());
    } catch {
      Alert.alert('Export failed', 'Could not create the export file.');
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    setBusy(true);
    try {
      const outcome = await importDataFromFile();
      if (outcome.status === 'invalid') {
        Alert.alert('Import failed', 'That file is not a valid Journalist Rater export.');
      } else if (outcome.status === 'imported') {
        void queryClient.invalidateQueries();
        Alert.alert(
          'Import complete',
          `Added ${outcome.result.journalists} journalists and ${outcome.result.claims} claims.`,
        );
      }
    } catch {
      Alert.alert('Import failed', 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  };

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
            Football data
          </Text>
          <Card>
            <KeyValueRow
              label="API lookups today"
              value={`${usageQuery.data ?? 0} / ${DAILY_BUDGET}`}
            />
            <KeyValueRow label="Provider" value="api-sports.io" />
          </Card>
        </View>

        <View style={{ gap: space.sm }}>
          <Text variant="caption" color="inkTertiary">
            Data
          </Text>
          <Button label="Export data" variant="secondary" onPress={() => void runExport()} disabled={busy} />
          <Button label="Import data" variant="secondary" onPress={() => void runImport()} disabled={busy} />
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
