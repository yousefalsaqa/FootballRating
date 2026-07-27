import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Haptic feedback helpers — no-ops on web where the API is unavailable. */

export function lightTap(): void {
  if (Platform.OS !== 'web') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export function successTick(): void {
  if (Platform.OS !== 'web') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}
