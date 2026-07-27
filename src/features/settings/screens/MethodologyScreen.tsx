import { View } from 'react-native';

import { Divider, Screen, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

function Section({ title, children }: { title: string; children: string }) {
  const { space } = useTheme();
  return (
    <View style={{ gap: space.sm, paddingVertical: space.md }}>
      <Text variant="title" style={{ fontSize: 18, lineHeight: 21 }}>
        {title}
      </Text>
      <Text variant="body" color="inkSecondary">
        {children}
      </Text>
    </View>
  );
}

/** Editorial standards page — how the reliability index actually works. */
export function MethodologyScreen() {
  const { space } = useTheme();
  return (
    <Screen>
      <View style={{ paddingVertical: space.lg }}>
        <Text variant="kicker" color="danger">
          Editorial standards
        </Text>
        <Text variant="display" style={{ fontSize: 32, lineHeight: 33, marginTop: space.xs }}>
          How the reliability{'\n'}index works
        </Text>
        <Text variant="body" color="inkSecondary" style={{ marginTop: space.sm }}>
          The Transfer Ledger evaluates reporting records, not popularity.
        </Text>
      </View>
      <Divider weight="strong" />

      <Section title="What counts as a claim">
        A claim is a specific, attributable transfer report: a named player, a destination, and a
        stated level of certainty, filed with its source. Opinion pieces, aggregations, and vague
        links are not claims.
      </Section>
      <Divider />
      <Section title="Confidence levels">
        Every claim is filed at one of three confidence levels: 1 — speculative interest, 2 —
        advanced talks or agreed terms, 3 — confirmed (“here we go”, done deal). A journalist
        stakes more credibility the higher they go: level-3 claims carry three times the weight of
        level-1 claims, in both directions.
      </Section>
      <Divider />
      <Section title="Verdicts">
        Verified true: the transfer or contract event happened materially as reported. Partially
        confirmed: the essentials held but significant details did not — worth half credit. Report
        disproved: the claim did not survive contact with reality. Developing stories carry no
        weight until resolved.
      </Section>
      <Divider />
      <Section title="Sample size">
        Scores are pulled toward the neutral 50 by a fixed prior, so a lucky two-for-two record
        cannot outrank a proven forty-five-for-fifty one. A journalist enters the ranked table
        after three resolved claims.
      </Section>
      <Divider />
      <Section title="Recency">
        Old form fades. Every claim’s weight halves every eighteen months — roughly three transfer
        windows — so the index reflects who is reliable now, while never fully erasing history.
      </Section>
      <Divider />
      <Section title="Tiers">
        Tiers are score bands: S from 85, A from 75, B from 60, C from 45, D below. They are
        classifications, not prizes; the continuous score is the primary measure.
      </Section>
      <Divider />
      <Section title="Movement">
        The trend arrow shows how many points a journalist’s rating moved due to claims resolved
        in the last thirty days.
      </Section>
      <Divider />
      <Section title="Limitations">
        The index measures recorded claims and available evidence only. It cannot see reports that
        were never filed, and a rating should not be read as an absolute judgment of any
        journalist’s character or career.
      </Section>
      <Divider weight="medium" />
    </Screen>
  );
}
