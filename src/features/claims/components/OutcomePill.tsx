import { View } from 'react-native';

import type { ClaimOutcome } from '@/db/schema';
import { Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

const LABELS: Record<ClaimOutcome, string> = {
  true: 'Came true',
  partial: 'Partially',
  false: 'False',
};

/** Colored outcome label — one of the few uses of semantic color in the app. */
export function OutcomePill({ outcome }: { outcome: ClaimOutcome }) {
  const { colors, radii, space } = useTheme();
  const palette = {
    true: { bg: colors.successBg, ink: colors.success },
    partial: { bg: colors.partialBg, ink: colors.partial },
    false: { bg: colors.dangerBg, ink: colors.danger },
  }[outcome];
  return (
    <View
      style={{
        borderRadius: radii.full,
        backgroundColor: palette.bg,
        paddingHorizontal: space.md,
        paddingVertical: 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text variant="secondary" style={{ color: palette.ink }}>
        {LABELS[outcome]}
      </Text>
    </View>
  );
}
