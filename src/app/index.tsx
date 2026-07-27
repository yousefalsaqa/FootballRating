import { Link } from 'expo-router';

import { Screen, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

/** Temporary home — replaced by the tab navigator in Phase 4. */
export default function Placeholder() {
  const { space } = useTheme();
  return (
    <Screen>
      <Text variant="display" style={{ marginTop: space['2xl'] }}>
        Journalist Rater
      </Text>
      <Link href="/gallery" style={{ marginTop: space.xl }}>
        <Text color="inkSecondary">Open component gallery →</Text>
      </Link>
    </Screen>
  );
}
