import { View } from 'react-native';

import { CONFIDENCE_LEVELS, type Confidence } from '@/db/schema';
import { Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  1: 'Speculative',
  2: 'Advanced',
  3: 'Confirmed',
};

/** Three-dot confidence indicator with label. */
export function ConfidenceDots({ confidence, showLabel }: { confidence: Confidence; showLabel?: boolean }) {
  const { colors, space } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
      accessibilityLabel={`Confidence: ${CONFIDENCE_LABELS[confidence]}`}
    >
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {CONFIDENCE_LEVELS.map((level) => (
          <View
            key={level}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: level <= confidence ? colors.ink : colors.hairline,
            }}
          />
        ))}
      </View>
      {showLabel ? (
        <Text variant="secondary" color="inkSecondary">
          {CONFIDENCE_LABELS[confidence]}
        </Text>
      ) : null}
    </View>
  );
}
