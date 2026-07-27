import { View } from 'react-native';

import { Button } from '@/ui/components/Button';
import { Text } from '@/ui/components/Text';
import { useTheme } from '@/ui/theme';

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Designed empty state — every list in the app renders one instead of a blank view. */
export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  const { space } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: space['3xl'],
        paddingHorizontal: space.xl,
        gap: space.sm,
      }}
    >
      <Text variant="headline">{title}</Text>
      <Text variant="secondary" color="inkSecondary" style={{ textAlign: 'center' }}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          style={{ marginTop: space.lg }}
        />
      ) : null}
    </View>
  );
}
