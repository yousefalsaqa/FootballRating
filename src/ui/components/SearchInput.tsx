import { TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '@/ui/theme';

/** Themed text input used for search fields and forms. */
export function SearchInput(props: TextInputProps) {
  const { colors, radii, space, type } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.inkTertiary}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      style={[
        {
          minHeight: 48,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.hairline,
          backgroundColor: colors.surface,
          color: colors.ink,
          paddingHorizontal: space.lg,
          fontFamily: type.body.fontFamily,
          fontSize: type.body.fontSize,
        },
        props.style,
      ]}
    />
  );
}
