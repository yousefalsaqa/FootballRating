import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { lightTap } from '@/lib/haptics';
import { Text } from '@/ui/components/Text';
import { useTheme } from '@/ui/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Fire a light haptic tick on press (used for significant actions). */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  haptic,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const { colors, radii, space } = theme;
  const variantStyles: Record<ButtonVariant, { bg: string; ink: string; border?: string }> = {
    primary: { bg: colors.actionBg, ink: colors.actionInk },
    secondary: { bg: colors.surface, ink: colors.ink, border: colors.hairline },
    ghost: { bg: 'transparent', ink: colors.inkSecondary },
    destructive: { bg: colors.dangerBg, ink: colors.danger },
  };
  const v = variantStyles[variant];

  const handlePress = () => {
    if (haptic) {
      lightTap();
    }
    onPress();
  };

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={handlePress}
        onPressIn={() => {
          scale.set(withTiming(0.97, { duration: 80 }));
        }}
        onPressOut={() => {
          scale.set(withTiming(1, { duration: 120 }));
        }}
        style={{
          minHeight: 48,
          borderRadius: radii.md,
          backgroundColor: v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space.xl,
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <Text variant="headline" style={{ color: v.ink }}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
