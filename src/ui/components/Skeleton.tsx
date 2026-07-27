import { useEffect } from 'react';
import type { DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/ui/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  rounded?: boolean;
}

/** Pulsing placeholder shown while content loads — used instead of spinners. */
export function Skeleton({ width = '100%', height = 16, rounded }: SkeletonProps) {
  const { colors, radii } = useTheme();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.set(withRepeat(withTiming(1, { duration: 700 }), -1, true));
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: rounded ? radii.full : radii.sm,
          backgroundColor: colors.surfaceMuted,
        },
        style,
      ]}
    />
  );
}
