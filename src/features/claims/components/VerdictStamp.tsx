import { View } from 'react-native';

import type { ClaimOutcome } from '@/db/schema';
import { Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

const LABELS: Record<ClaimOutcome, string> = {
  true: 'True',
  partial: 'Partial',
  false: 'False',
};

/** Editorial verdict stamp — heavy border, condensed caps, no fill. */
export function VerdictStamp({ outcome, size = 'sm' }: { outcome: ClaimOutcome; size?: 'sm' | 'lg' }) {
  const { colors, space } = useTheme();
  const color = { true: colors.success, partial: colors.partial, false: colors.danger }[outcome];
  return (
    <View
      accessibilityLabel={`Verdict: ${LABELS[outcome]}`}
      style={{
        borderWidth: 2,
        borderColor: color,
        borderRadius: 4,
        paddingHorizontal: size === 'lg' ? space.md : space.sm,
        paddingVertical: size === 'lg' ? 4 : 2,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        variant="stamp"
        style={{ color, fontSize: size === 'lg' ? 20 : 15, lineHeight: size === 'lg' ? 24 : 18 }}
      >
        {LABELS[outcome]}
      </Text>
    </View>
  );
}
