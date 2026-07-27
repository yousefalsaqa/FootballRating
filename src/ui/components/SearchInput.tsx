import { TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '@/ui/theme';

/** Flat editorial input — square, strong underline, no floating chrome. */
export function SearchInput(props: TextInputProps) {
  const { colors, radii, rules, space, type } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.inkTertiary}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      style={[
        {
          minHeight: 44,
          borderRadius: radii.sm,
          borderWidth: rules.thin,
          borderColor: colors.ruleMedium,
          borderBottomWidth: rules.medium,
          borderBottomColor: colors.ink,
          backgroundColor: colors.surface,
          color: colors.ink,
          paddingHorizontal: space.md,
          fontFamily: type.body.fontFamily,
          fontSize: 15,
        },
        props.style,
      ]}
    />
  );
}
