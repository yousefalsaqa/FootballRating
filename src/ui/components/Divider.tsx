import { View } from 'react-native';

import { useTheme } from '@/ui/theme';

/** Hairline separator. `inset` aligns with ListRow content past the leading slot. */
export function Divider({ inset = false }: { inset?: boolean }) {
  const { colors, gutter } = useTheme();
  return (
    <View
      style={{
        height: 1,
        backgroundColor: colors.hairline,
        marginLeft: inset ? gutter + 48 : 0,
      }}
    />
  );
}
