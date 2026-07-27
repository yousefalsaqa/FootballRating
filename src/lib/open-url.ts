import { Linking, Platform } from 'react-native';

/**
 * Opens an external link: a NEW browser tab on web (never navigating away
 * from the app), the system browser / owning app on native.
 */
export function openExternal(url: string): void {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    void Linking.openURL(url);
  }
}
