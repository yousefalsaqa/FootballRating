import { Link } from 'expo-router';

import { EmptyState, Screen } from '@/ui/components';

export default function NotFoundScreen() {
  return (
    <Screen>
      <EmptyState title="Screen not found" message="This page doesn’t exist." />
      <Link href="/" style={{ alignSelf: 'center' }}>
        Go home
      </Link>
    </Screen>
  );
}
