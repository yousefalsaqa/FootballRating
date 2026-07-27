import { View } from 'react-native';

import { useTheme } from '@/ui/theme';

interface DividerProps {
  /** Newspaper rule weight: thin row rule, medium section rule, strong editorial rule. */
  weight?: 'thin' | 'medium' | 'strong';
  /** Indents past a leading column (e.g. rank numbers). */
  inset?: boolean;
}

/** Editorial rule. */
export function Divider({ weight = 'thin', inset = false }: DividerProps) {
  const { colors, rules, gutter } = useTheme();
  const color = weight === 'thin' ? colors.hairline : weight === 'medium' ? colors.ruleMedium : colors.ruleStrong;
  return (
    <View
      style={{
        height: rules[weight],
        backgroundColor: color,
        marginLeft: inset ? gutter + 48 : 0,
      }}
    />
  );
}
