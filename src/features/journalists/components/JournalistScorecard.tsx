import { View } from 'react-native';

import type { Scorecard } from '@/features/scoring/engine';
import { Card, Divider, KeyValueRow, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

function ratio(correct: number, total: number): string {
  if (total === 0) {
    return '—';
  }
  const rounded = Math.round(correct * 10) / 10;
  const pct = Math.round((correct / total) * 100);
  return `${rounded} of ${total} (${pct}%)`;
}

/** The "why" behind a score: verifiable counts, no magic. Partial = ½ credit. */
export function JournalistScorecard({ scorecard }: { scorecard: Scorecard }) {
  const { space } = useTheme();

  if (scorecard.total === 0) {
    return null;
  }

  return (
    <View style={{ gap: space.sm }}>
      <Text variant="caption" color="inkTertiary">
        Why this score
      </Text>
      <Card>
        <KeyValueRow label="Claims correct" value={ratio(scorecard.correct, scorecard.total)} />
        <KeyValueRow
          label="Outcomes"
          value={`${scorecard.trueCount} true · ${scorecard.partialCount} partial · ${scorecard.falseCount} false`}
        />
        <KeyValueRow
          label="Last 12 months"
          value={ratio(scorecard.recent.correct, scorecard.recent.total)}
        />
        <Divider />
        <KeyValueRow
          label="“Here we go” (confirmed)"
          value={ratio(scorecard.byConfidence[3].correct, scorecard.byConfidence[3].total)}
        />
        <KeyValueRow
          label="Advanced talks"
          value={ratio(scorecard.byConfidence[2].correct, scorecard.byConfidence[2].total)}
        />
        <KeyValueRow
          label="Speculative links"
          value={ratio(scorecard.byConfidence[1].correct, scorecard.byConfidence[1].total)}
        />
      </Card>
      <Text variant="secondary" color="inkTertiary">
        Partially-true claims count as half. The headline score also weights recent claims and
        “here we go”s more heavily.
      </Text>
    </View>
  );
}
