import * as Linking from 'expo-linking';
import { View } from 'react-native';

import { ConfidenceDots } from '@/features/claims/components';
import type { IncomingClaim } from '@/features/inbox/api';
import { formatDate } from '@/lib/format';
import { Button, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

interface IncomingRowProps {
  draft: IncomingClaim;
  journalistName?: string;
  onAccept: () => void;
  onDismiss: () => void;
}

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
}

/** A wire report awaiting review — full facts, source link, file or dismiss. */
export function IncomingRow({ draft, journalistName, onAccept, onDismiss }: IncomingRowProps) {
  const { space, gutter } = useTheme();

  return (
    <View style={{ paddingHorizontal: gutter, paddingVertical: space.md, gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="kicker" color="developing">
          {journalistName ?? 'Unknown reporter'}
        </Text>
        <Text variant="caption" color="inkTertiary">
          {formatDate(draft.reportedAt)}
        </Text>
      </View>
      <Text variant="headline" numberOfLines={2}>
        {draft.headline}
      </Text>
      <Text variant="secondary" color="inkSecondary" numberOfLines={1}>
        {draft.playerName}
        {draft.fromClubName ? ` · ${draft.fromClubName} → ${draft.toClubName}` : ` → ${draft.toClubName}`}
        {draft.league ? ` · ${draft.league}` : ''}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: 2 }}>
        <ConfidenceDots confidence={draft.confidence} showLabel />
        <Text
          variant="caption"
          color="ink"
          accessibilityRole="link"
          accessibilityLabel={`View source at ${sourceHost(draft.sourceUrl)}`}
          onPress={() => void Linking.openURL(draft.sourceUrl)}
          style={{ textDecorationLine: 'underline' }}
        >
          {sourceHost(draft.sourceUrl)} →
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.sm }}>
        <Button label="File report" onPress={onAccept} haptic style={{ flex: 1 }} />
        <Button label="Dismiss" variant="ghost" onPress={onDismiss} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
