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

/** A wire item awaiting editorial review — accept into the table or dismiss. */
export function IncomingRow({ draft, journalistName, onAccept, onDismiss }: IncomingRowProps) {
  const { space, gutter } = useTheme();
  const transferLine = [
    draft.playerName,
    draft.fromClubName ? `${draft.fromClubName} → ${draft.toClubName}` : `→ ${draft.toClubName}`,
    draft.league ?? undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={{ paddingHorizontal: gutter, paddingVertical: space.md, gap: 3 }}>
      <Text variant="caption" color="inkTertiary">
        {journalistName ? `${journalistName}  ·  ` : ''}
        {formatDate(draft.reportedAt)}
      </Text>
      <Text variant="headline" numberOfLines={2}>
        {draft.headline}
      </Text>
      <Text variant="secondary" color="inkSecondary" numberOfLines={1}>
        {transferLine}
      </Text>
      <View style={{ marginTop: 2 }}>
        <ConfidenceDots confidence={draft.confidence} showLabel />
      </View>
      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.sm }}>
        <Button label="Accept" onPress={onAccept} haptic style={{ flex: 1 }} />
        <Button label="Dismiss" variant="ghost" onPress={onDismiss} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
