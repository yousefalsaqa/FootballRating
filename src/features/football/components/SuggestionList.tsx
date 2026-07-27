import { Pressable, View } from 'react-native';

import type { ApiFailureReason } from '@/features/football/types';
import { Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export interface Suggestion {
  id: number;
  title: string;
  subtitle?: string;
}

interface SuggestionListProps {
  suggestions: Suggestion[];
  onSelect: (suggestion: Suggestion) => void;
  isFetching?: boolean;
  /** Set when the last lookup failed; budget failures show a calm note. */
  failure?: ApiFailureReason;
}

/** Autocomplete results rendered under a wizard input. Manual entry always works. */
export function SuggestionList({ suggestions, onSelect, isFetching, failure }: SuggestionListProps) {
  const { colors, radii, space } = useTheme();

  if (failure === 'budget') {
    return (
      <Text variant="secondary" color="inkTertiary">
        Daily lookup limit reached — keep typing manually.
      </Text>
    );
  }
  if (!suggestions.length) {
    return isFetching ? (
      <Text variant="secondary" color="inkTertiary">
        Searching…
      </Text>
    ) : null;
  }

  return (
    <View
      style={{
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.hairline,
        backgroundColor: colors.surface,
        overflow: 'hidden',
      }}
    >
      {suggestions.slice(0, 5).map((suggestion, index) => (
        <Pressable
          key={suggestion.id}
          accessibilityRole="button"
          onPress={() => onSelect(suggestion)}
          style={({ pressed }) => ({
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
            borderTopWidth: index > 0 ? 1 : 0,
            borderTopColor: colors.hairline,
          })}
        >
          <Text variant="body" numberOfLines={1}>
            {suggestion.title}
          </Text>
          {suggestion.subtitle ? (
            <Text variant="secondary" color="inkSecondary" numberOfLines={1}>
              {suggestion.subtitle}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
