import { View } from 'react-native';

import type { ClaimOutcome } from '@/db/schema';
import { Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

/** 'pending' renders the unresolved-story stamp. */
export type Verdict = ClaimOutcome | 'pending';

const LABELS: Record<Verdict, string> = {
  true: 'Verified true',
  partial: 'Partially confirmed',
  false: 'Report disproved',
  pending: 'Developing story',
};

/** Rectangular editorial ruling — heavy border, uppercase, zero radius. */
export function VerdictStamp({ verdict, size = 'sm' }: { verdict: Verdict; size?: 'sm' | 'lg' }) {
  const { colors, rules, space } = useTheme();
  const color = {
    true: colors.success,
    partial: colors.partial,
    false: colors.danger,
    pending: colors.developing,
  }[verdict];
  return (
    <View
      accessibilityLabel={`Verdict: ${LABELS[verdict]}`}
      style={{
        borderWidth: rules.medium,
        borderColor: color,
        paddingHorizontal: size === 'lg' ? space.md : space.sm,
        paddingVertical: size === 'lg' ? 5 : 3,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        variant="stamp"
        style={{ color, ...(size === 'lg' ? { fontSize: 13, lineHeight: 17 } : null) }}
      >
        {LABELS[verdict]}
      </Text>
    </View>
  );
}
