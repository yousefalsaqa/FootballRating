import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { CONFIDENCE_LABELS } from '@/features/claims/components';
import { useCreateClaim } from '@/features/claims/hooks';
import { useClaimDraftStore } from '@/features/claims/store';
import { JournalistAvatar } from '@/features/journalists/components/JournalistAvatar';
import { useJournalists } from '@/features/journalists/hooks';
import { CONFIDENCE_LEVELS } from '@/db/schema';
import { upcomingWindows, windowLabel, type TransferWindow } from '@/lib/dates';
import {
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  KeyValueRow,
  ListRow,
  Screen,
  SearchInput,
  SegmentedControl,
  Text,
} from '@/ui/components';
import { useTheme } from '@/ui/theme';

const STEPS = ['Journalist', 'Transfer', 'Details', 'Review'] as const;

function FieldLabel({ children }: { children: string }) {
  return (
    <Text variant="caption" color="inkTertiary">
      {children}
    </Text>
  );
}

/** 4-step modal wizard for logging a claim. Draft lives in the claims store. */
export function AddClaimWizard() {
  const router = useRouter();
  const { space } = useTheme();
  const [step, setStep] = useState(0);
  const { draft, patchDraft, resetDraft } = useClaimDraftStore();
  const journalistsQuery = useJournalists();
  const createMutation = useCreateClaim();
  const [journalistFilter, setJournalistFilter] = useState('');
  const [tagsText, setTagsText] = useState(draft.tagNames.join(', '));

  // A fresh wizard starts from a clean draft (e.g. after a cancelled run).
  useEffect(() => resetDraft(), [resetDraft]);

  // Window options are stamped once on mount via the lazy initializer.
  const [windows] = useState<TransferWindow[]>(() => upcomingWindows(Date.now()));

  const journalists = useMemo(() => {
    const list = journalistsQuery.data ?? [];
    const filter = journalistFilter.trim().toLowerCase();
    return filter ? list.filter((j) => j.name.toLowerCase().includes(filter)) : list;
  }, [journalistsQuery.data, journalistFilter]);

  const selectedJournalist = (journalistsQuery.data ?? []).find(
    (j) => j.id === draft.journalistId,
  );

  const transferLine = draft.fromClubName
    ? `${draft.playerName}: ${draft.fromClubName} → ${draft.toClubName}`
    : `${draft.playerName} → ${draft.toClubName}`;

  const canContinue = [
    draft.journalistId !== null,
    draft.playerName.trim().length > 1 && draft.toClubName.trim().length > 1,
    true,
    true,
  ][step] as boolean;

  const save = () => {
    if (!draft.journalistId) {
      return;
    }
    const headline = draft.headline.trim() || transferLine;
    const tagNames = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    createMutation.mutate(
      {
        input: {
          journalistId: draft.journalistId,
          headline,
          playerName: draft.playerName.trim(),
          playerApiId: draft.playerApiId,
          fromClubName: draft.fromClubName.trim() || null,
          fromClubApiId: draft.fromClubApiId,
          toClubName: draft.toClubName.trim(),
          toClubApiId: draft.toClubApiId,
          league: draft.league.trim() || null,
          confidence: draft.confidence,
          transferWindow: draft.transferWindow,
          sourceUrl: draft.sourceUrl.trim() || null,
          notes: draft.notes.trim() || null,
          claimedAt: Date.now(),
        },
        tagNames,
      },
      {
        onSuccess: () => {
          resetDraft();
          router.back();
        },
      },
    );
  };

  return (
    <Screen>
      <View style={{ gap: space.xl, paddingTop: space.lg }}>
        <View style={{ gap: space.xs }}>
          <Text variant="caption" color="inkTertiary">
            Step {step + 1} of {STEPS.length}
          </Text>
          <Text variant="title">{STEPS[step]}</Text>
        </View>

        {step === 0 ? (
          <View style={{ gap: space.md }}>
            <SearchInput
              placeholder="Filter journalists…"
              value={journalistFilter}
              onChangeText={setJournalistFilter}
            />
            <Button
              label="New journalist"
              variant="secondary"
              onPress={() => router.push('/journalist/new')}
            />
            {journalists.length === 0 ? (
              <EmptyState
                title="No journalists"
                message="Add a journalist first — seeded names appear after first launch."
              />
            ) : (
              <Card style={{ padding: 0 }}>
                {journalists.map((journalist, index) => (
                  <View key={journalist.id}>
                    {index > 0 ? <Divider inset /> : null}
                    <ListRow
                      title={journalist.name}
                      subtitle={journalist.outlet ?? undefined}
                      leading={
                        <JournalistAvatar name={journalist.name} color={journalist.avatarColor} />
                      }
                      trailing={
                        draft.journalistId === journalist.id ? (
                          <Text variant="headline">✓</Text>
                        ) : undefined
                      }
                      onPress={() => patchDraft({ journalistId: journalist.id })}
                    />
                  </View>
                ))}
              </Card>
            )}
          </View>
        ) : null}

        {step === 1 ? (
          <View style={{ gap: space.lg }}>
            <View style={{ gap: space.sm }}>
              <FieldLabel>Player</FieldLabel>
              <SearchInput
                placeholder="e.g. Florian Wirtz"
                value={draft.playerName}
                onChangeText={(playerName) => patchDraft({ playerName, playerApiId: null })}
                autoCapitalize="words"
              />
            </View>
            <View style={{ gap: space.sm }}>
              <FieldLabel>From club (optional)</FieldLabel>
              <SearchInput
                placeholder="e.g. Bayer Leverkusen"
                value={draft.fromClubName}
                onChangeText={(fromClubName) => patchDraft({ fromClubName, fromClubApiId: null })}
                autoCapitalize="words"
              />
            </View>
            <View style={{ gap: space.sm }}>
              <FieldLabel>To club</FieldLabel>
              <SearchInput
                placeholder="e.g. Liverpool"
                value={draft.toClubName}
                onChangeText={(toClubName) => patchDraft({ toClubName, toClubApiId: null })}
                autoCapitalize="words"
              />
            </View>
            <View style={{ gap: space.sm }}>
              <FieldLabel>League (optional)</FieldLabel>
              <SearchInput
                placeholder="e.g. Premier League"
                value={draft.league}
                onChangeText={(league) => patchDraft({ league })}
                autoCapitalize="words"
              />
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ gap: space.lg }}>
            <View style={{ gap: space.sm }}>
              <FieldLabel>Confidence</FieldLabel>
              <SegmentedControl
                options={CONFIDENCE_LEVELS.map((level) => ({
                  value: String(level),
                  label: CONFIDENCE_LABELS[level],
                }))}
                value={String(draft.confidence)}
                onChange={(value) =>
                  patchDraft({ confidence: Number(value) as typeof draft.confidence })
                }
              />
            </View>
            <View style={{ gap: space.sm }}>
              <FieldLabel>Transfer window</FieldLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {windows.map((window) => (
                  <Chip
                    key={window}
                    label={windowLabel(window)}
                    selected={draft.transferWindow === window}
                    onPress={() =>
                      patchDraft({
                        transferWindow: draft.transferWindow === window ? null : window,
                      })
                    }
                  />
                ))}
              </View>
            </View>
            <View style={{ gap: space.sm }}>
              <FieldLabel>Headline (optional — auto-filled from transfer)</FieldLabel>
              <SearchInput
                placeholder={transferLine}
                value={draft.headline}
                onChangeText={(headline) => patchDraft({ headline })}
              />
            </View>
            <View style={{ gap: space.sm }}>
              <FieldLabel>Tags (comma separated)</FieldLabel>
              <SearchInput
                placeholder="e.g. premier league, done deal"
                value={tagsText}
                onChangeText={setTagsText}
              />
            </View>
            <View style={{ gap: space.sm }}>
              <FieldLabel>Source URL (optional)</FieldLabel>
              <SearchInput
                placeholder="https://…"
                value={draft.sourceUrl}
                onChangeText={(sourceUrl) => patchDraft({ sourceUrl })}
                keyboardType="url"
              />
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <Card>
            <KeyValueRow label="Journalist" value={selectedJournalist?.name ?? '—'} />
            <KeyValueRow label="Headline" value={draft.headline.trim() || transferLine} />
            <KeyValueRow label="Transfer" value={transferLine} />
            <KeyValueRow label="Confidence" value={CONFIDENCE_LABELS[draft.confidence]} />
            <KeyValueRow
              label="Window"
              value={draft.transferWindow ? windowLabel(draft.transferWindow) : '—'}
            />
            <KeyValueRow label="Tags" value={tagsText.trim() || '—'} />
          </Card>
        ) : null}

        <View style={{ gap: space.md }}>
          {step < STEPS.length - 1 ? (
            <Button
              label="Continue"
              onPress={() => setStep(step + 1)}
              disabled={!canContinue}
            />
          ) : (
            <Button label="Save claim" onPress={save} haptic disabled={createMutation.isPending} />
          )}
          {step > 0 ? (
            <Button label="Back" variant="ghost" onPress={() => setStep(step - 1)} />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
