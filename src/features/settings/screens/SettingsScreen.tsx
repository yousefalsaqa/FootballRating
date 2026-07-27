import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { DAILY_BUDGET } from '@/features/football/cache';
import { useApiUsage } from '@/features/football/hooks';
import { exportDataToFile, importDataFromFile } from '@/features/settings/data-export';
import { useSettingsStore } from '@/features/settings/store';
import { lastSyncedAt, syncLedger } from '@/features/settings/sync';
import { formatDate } from '@/lib/format';
import { Button, Card, KeyValueRow, Screen, SearchInput, SegmentedControl, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

/** Settings tab: appearance and app info. Data controls arrive with export. */
export function SettingsScreen() {
  const { space } = useTheme();
  const {
    themePreference,
    setThemePreference,
    autoFileIncoming,
    setAutoFileIncoming,
    autoResolve,
    setAutoResolve,
    syncKey,
    setSyncKey,
  } = useSettingsStore();
  const usageQuery = useApiUsage();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [passcodeDraft, setPasscodeDraft] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<number | null>(() => lastSyncedAt());

  const runSync = async () => {
    setSyncBusy(true);
    setSyncMessage(null);
    try {
      const outcome = await syncLedger(Date.now());
      if (outcome.status === 'synced') {
        const { journalists, claims, resolutions } = outcome.pulled;
        const pulledTotal = journalists + claims + resolutions;
        if (pulledTotal > 0) {
          void queryClient.invalidateQueries();
        }
        setSyncedAt(outcome.at);
        setSyncMessage(
          pulledTotal > 0
            ? `Synced — pulled ${claims} claims, ${resolutions} verdicts, ${journalists} journalists.`
            : outcome.pushed
              ? 'Synced — this device’s record is now the shared ledger.'
              : 'Synced — everything already matches.',
        );
      } else if (outcome.status === 'wrong-key') {
        setSyncMessage('That passcode doesn’t match the ledger. Use the same passcode on every device.');
      } else {
        setSyncMessage('Could not reach the sync service — try again in a minute.');
      }
    } finally {
      setSyncBusy(false);
    }
  };

  const enableSync = () => {
    const key = passcodeDraft.trim();
    if (key.length < 4) {
      setSyncMessage('Pick a passcode of at least 4 characters.');
      return;
    }
    setSyncKey(key);
    setPasscodeDraft('');
    void runSync();
  };

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
            The wire
          </Text>
          <SegmentedControl
            options={[
              { value: 'auto', label: 'Auto-file reports' },
              { value: 'review', label: 'Review first' },
            ]}
            value={autoFileIncoming ? 'auto' : 'review'}
            onChange={(value) => setAutoFileIncoming(value === 'auto')}
          />
          <Text variant="secondary" color="inkTertiary">
            Auto-file adds every incoming wire report to the record as a developing story. Review
            first holds them in the Incoming tab; unreviewed reports expire after 72 hours.
          </Text>
          <SegmentedControl
            options={[
              { value: 'auto', label: 'Auto-resolve outcomes' },
              { value: 'manual', label: 'Resolve manually' },
            ]}
            value={autoResolve ? 'auto' : 'manual'}
            onChange={(value) => setAutoResolve(value === 'auto')}
          />
          <Text variant="secondary" color="inkTertiary">
            Auto-resolve checks press coverage of developing stories twice a day and records a
            verdict only when the evidence is conclusive. Unclear stories stay open, and you can
            always overrule a verdict from the report page.
          </Text>
        </View>

        <View style={{ gap: space.sm }}>
          <Text variant="caption" color="inkTertiary">
            Sync across devices
          </Text>
          {syncKey ? (
            <View style={{ gap: space.sm }}>
              <Card>
                <KeyValueRow label="Status" value="On" />
                <KeyValueRow label="Last synced" value={syncedAt ? formatDate(syncedAt) : '—'} />
              </Card>
              <Button
                label={syncBusy ? 'Syncing…' : 'Sync now'}
                variant="secondary"
                onPress={() => void runSync()}
                disabled={syncBusy}
              />
              <Button
                label="Turn off sync"
                variant="secondary"
                onPress={() => {
                  setSyncKey(null);
                  setSyncMessage('Sync is off. Your record stays on this device.');
                }}
                disabled={syncBusy}
              />
            </View>
          ) : (
            <View style={{ gap: space.sm }}>
              <Text variant="secondary" color="inkTertiary">
                One shared record for all your devices. Pick a passcode here, then enter the same
                passcode on your other device — claims, verdicts, and journalists merge both ways
                every few minutes.
              </Text>
              <SearchInput
                placeholder="Choose a sync passcode…"
                value={passcodeDraft}
                onChangeText={setPasscodeDraft}
                accessibilityLabel="Sync passcode"
              />
              <Button
                label="Turn on sync"
                variant="secondary"
                onPress={enableSync}
                disabled={syncBusy || passcodeDraft.trim().length === 0}
              />
            </View>
          )}
          {syncMessage ? (
            <Text variant="secondary" color="inkSecondary">
              {syncMessage}
            </Text>
          ) : null}
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

        {Platform.OS !== 'web' ? (
          <View style={{ gap: space.sm }}>
            <Text variant="caption" color="inkTertiary">
              Data
            </Text>
            <Button label="Export data" variant="secondary" onPress={() => void runExport()} disabled={busy} />
            <Button label="Import data" variant="secondary" onPress={() => void runImport()} disabled={busy} />
          </View>
        ) : null}

        <View style={{ gap: space.sm }}>
          <Text variant="caption" color="inkTertiary">
            About
          </Text>
          <Card>
            <KeyValueRow label="Version" value={Constants.expoConfig?.version ?? '—'} />
            <KeyValueRow
              label="Data"
              value={syncKey ? 'On this device · synced ledger' : 'Stored only on this device'}
            />
          </Card>
        </View>
      </View>
    </Screen>
  );
}
