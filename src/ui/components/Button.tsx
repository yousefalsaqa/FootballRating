import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

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

/** Rectangular editorial control: ink fill or ink border, uppercase label. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  haptic,
  style,
}: ButtonProps) {
  const { colors, radii, rules, space } = useTheme();

  const variantStyles: Record<
    ButtonVariant,
    { bg: string; ink: string; borderColor: string; borderWidth: number }
  > = {
    primary: { bg: colors.actionBg, ink: colors.actionInk, borderColor: colors.actionBg, borderWidth: rules.medium },
    secondary: { bg: 'transparent', ink: colors.ink, borderColor: colors.ink, borderWidth: rules.medium },
    ghost: { bg: 'transparent', ink: colors.inkSecondary, borderColor: 'transparent', borderWidth: rules.medium },
    destructive: { bg: 'transparent', ink: colors.danger, borderColor: colors.danger, borderWidth: rules.medium },
  };
  const v = variantStyles[variant];

  const handlePress = () => {
    if (haptic) {
      lightTap();
    }
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        {
          minHeight: 46,
          borderRadius: radii.md,
          backgroundColor: pressed && v.bg === 'transparent' ? colors.surfaceMuted : v.bg,
          borderWidth: v.borderWidth,
          borderColor: v.borderColor,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space.xl,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text variant="stamp" style={{ color: v.ink, fontSize: 12, lineHeight: 16 }}>
        {label}
      </Text>
    </Pressable>
  );
}
