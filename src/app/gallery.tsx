import { useState } from 'react';
import { View } from 'react-native';

import { useSettingsStore } from '@/features/settings/store';
import {
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  KeyValueRow,
  ListRow,
  Screen,
  SearchInput,
  SegmentedControl,
  Skeleton,
  Text,
} from '@/ui/components';
import { useTheme } from '@/ui/theme';

/** Dev-only component gallery for verifying the design system in both schemes. */
export default function GalleryScreen() {
  const { space } = useTheme();
  const { themePreference, setThemePreference } = useSettingsStore();
  const [segment, setSegment] = useState<'pending' | 'resolved'>('pending');
  const [chipOn, setChipOn] = useState(false);

  return (
    <Screen>
      <View style={{ gap: space.xl, paddingTop: space.lg }}>
        <SegmentedControl
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={themePreference}
          onChange={setThemePreference}
        />

        <View style={{ gap: space.xs }}>
          <Text variant="display">Display 34</Text>
          <Text variant="title">Title 24</Text>
          <Text variant="headline">Headline 17</Text>
          <Text variant="body">Body 16 — the quick brown fox</Text>
          <Text variant="secondary" color="inkSecondary">
            Secondary 14
          </Text>
          <Text variant="caption" color="inkTertiary">
            Caption 12
          </Text>
          <Text variant="score">87</Text>
        </View>

        <View style={{ gap: space.md }}>
          <Button label="Primary" onPress={() => {}} haptic />
          <Button label="Secondary" onPress={() => {}} variant="secondary" />
          <Button label="Ghost" onPress={() => {}} variant="ghost" />
          <Button label="Destructive" onPress={() => {}} variant="destructive" />
        </View>

        <Card>
          <Text variant="headline">Card</Text>
          <KeyValueRow label="Accuracy" value="82%" />
          <KeyValueRow label="Claims" value="45" />
        </Card>

        <SegmentedControl
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'resolved', label: 'Resolved' },
          ]}
          value={segment}
          onChange={setSegment}
        />

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Chip label="Premier League" selected={chipOn} onPress={() => setChipOn(!chipOn)} />
          <Chip label="Serie A" />
        </View>

        <SearchInput placeholder="Search players…" />

        <Card style={{ padding: 0 }}>
          <ListRow title="Fabrizio Romano" subtitle="Sky Sport" trailing={<Text>91</Text>} />
          <Divider inset />
          <ListRow title="David Ornstein" subtitle="The Athletic" trailing={<Text>88</Text>} />
        </Card>

        <View style={{ gap: space.sm }}>
          <Skeleton width="60%" />
          <Skeleton width="90%" />
          <Skeleton width={48} height={48} rounded />
        </View>

        <EmptyState
          title="No claims yet"
          message="Log a journalist's transfer claim to start tracking their reliability."
          actionLabel="Add claim"
          onAction={() => {}}
        />
      </View>
    </Screen>
  );
}
