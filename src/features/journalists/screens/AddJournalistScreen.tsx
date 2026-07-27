import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useCreateJournalist } from '@/features/journalists/hooks';
import { findJournalistByName } from '@/features/journalists/repository';
import { Button, Screen, SearchInput, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

/** Modal form for adding a journalist. */
export function AddJournalistScreen() {
  const router = useRouter();
  const { space } = useTheme();
  const createMutation = useCreateJournalist();
  const [name, setName] = useState('');
  const [outlet, setOutlet] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Enter the journalist’s name.');
      return;
    }
    if (await findJournalistByName(trimmed)) {
      setError('That journalist already exists.');
      return;
    }
    createMutation.mutate(
      { name: trimmed, outlet: outlet.trim() || undefined },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Screen>
      <View style={{ gap: space.lg, paddingTop: space.xl }}>
        <View style={{ gap: space.sm }}>
          <Text variant="caption" color="inkTertiary">
            Name
          </Text>
          <SearchInput
            placeholder="e.g. Fabrizio Romano"
            value={name}
            onChangeText={(value) => {
              setName(value);
              setError(null);
            }}
            autoFocus
            autoCapitalize="words"
          />
        </View>
        <View style={{ gap: space.sm }}>
          <Text variant="caption" color="inkTertiary">
            Outlet (optional)
          </Text>
          <SearchInput
            placeholder="e.g. The Athletic"
            value={outlet}
            onChangeText={setOutlet}
            autoCapitalize="words"
          />
        </View>
        {error ? (
          <Text variant="secondary" color="danger">
            {error}
          </Text>
        ) : null}
        <Button label="Add journalist" onPress={() => void save()} haptic />
      </View>
    </Screen>
  );
}
