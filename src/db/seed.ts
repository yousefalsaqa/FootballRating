import { and, eq, inArray, isNull, like } from 'drizzle-orm';

import { db } from '@/db/client';
import { appMeta, claims, journalists, type ClaimOutcome, type Confidence } from '@/db/schema';
import seedJournalists from '@/db/seed-journalists.json';
import { avatarColorFor } from '@/lib/constants';
import { newId } from '@/lib/id';

const HANDLE_BACKFILL_FLAG = 'seeded.handles.v2';
const DEMO_CLAIMS_V2_FLAG = 'seeded.demo-claims.v2';
const DEMO_CLAIMS_V3_FLAG = 'seeded.demo-claims.v3';
const DEMO_CLAIMS_V4_FLAG = 'seeded.demo-claims.v4';

/**
 * Seed ids are FIXED strings (not per-install UUIDs) so exports from one
 * device merge cleanly into another instead of duplicating the seeded rows.
 * Seeding is idempotent by id: new entries added here reach existing installs.
 * The roster lives in seed-journalists.json — shared with the ingest worker.
 */
const SEED_JOURNALISTS: { id: string; name: string; outlet: string; handle: string }[] =
  seedJournalists;

interface SeedClaim {
  journalistId: string;
  headline: string;
  playerName: string;
  fromClubName?: string;
  toClubName: string;
  league?: string;
  confidence: Confidence;
  sourceUrl?: string;
  /** Days ago the claim was made; 0 = today. */
  claimedDaysAgo: number;
  /** Present = resolved that many days ago. */
  resolved?: { outcome: ClaimOutcome; daysAgo: number };
}

/**
 * Real, publicly-reported claims from the 2026 summer window (as of 27 Jul
 * 2026), with sources attached. Nothing invented — pending items resolve as
 * the window plays out.
 */
const SEED_CLAIMS_V2: SeedClaim[] = [
  {
    journalistId: 'seed-fabrizio-romano',
    headline: 'Yan Diomande to Real Madrid, here we go — fee in excess of €100m',
    playerName: 'Yan Diomande',
    fromClubName: 'RB Leipzig',
    toClubName: 'Real Madrid',
    league: 'La Liga',
    confidence: 3,
    sourceUrl: 'https://x.com/FabrizioRomano/status/2081453698962592146',
    claimedDaysAgo: 1,
  },
  {
    journalistId: 'seed-florian-plettenberg',
    headline: 'Diomande–Madrid not finalized: negotiations still ongoing',
    playerName: 'Yan Diomande',
    fromClubName: 'RB Leipzig',
    toClubName: 'Real Madrid',
    league: 'La Liga',
    confidence: 2,
    sourceUrl: 'https://www.bavarianfootballworks.com/off-the-crossbar/236021/media-wars-florian-plettenberg-and-fabrizio-romano-go-toe-to-toe-over-accusations-of-fake-news',
    claimedDaysAgo: 1,
  },
  {
    journalistId: 'seed-david-ornstein',
    headline: 'Summerville to Al-Hilal in €70m+ deal, medical completed',
    playerName: 'Crysencio Summerville',
    fromClubName: 'Liverpool',
    toClubName: 'Al-Hilal',
    league: 'Saudi Pro League',
    confidence: 3,
    sourceUrl: 'https://www.empireofthekop.com/2026/07/23/liverpool-target-agrees-four-year-deal-as-ornstein-confirms-medical-done-on-tuesday/',
    claimedDaysAgo: 6,
    resolved: { outcome: 'true', daysAgo: 4 },
  },
  {
    journalistId: 'seed-david-ornstein',
    headline: 'Newcastle’s £46m Bergvall offer rejected by Tottenham',
    playerName: 'Lucas Bergvall',
    fromClubName: 'Tottenham',
    toClubName: 'Newcastle',
    league: 'Premier League',
    confidence: 2,
    sourceUrl: 'https://sports.yahoo.com/articles/david-ornstein-just-confirmed-tottenham-060001397.html',
    claimedDaysAgo: 3,
  },
  {
    journalistId: 'seed-david-ornstein',
    headline: 'Real Madrid operating on basis Rodri arrives this summer',
    playerName: 'Rodri',
    fromClubName: 'Manchester City',
    toClubName: 'Real Madrid',
    league: 'La Liga',
    confidence: 2,
    sourceUrl: 'https://www.footballtransfers.com/en/transfer-news/uk-premier-league/2026/07/real-madrid-rodri-david-ornstein',
    claimedDaysAgo: 7,
  },
  {
    journalistId: 'seed-david-ornstein',
    headline: 'Arsenal exploring sensational Vinícius Jr move — no talks yet',
    playerName: 'Vinícius Júnior',
    fromClubName: 'Real Madrid',
    toClubName: 'Arsenal',
    league: 'Premier League',
    confidence: 1,
    sourceUrl: 'https://www.footballtransfers.com/en/transfer-news/uk-premier-league/2026/07/arsenal-transfer-news-vinicius-jr-david-ornstein',
    claimedDaysAgo: 5,
  },
  {
    journalistId: 'seed-florian-plettenberg',
    headline: 'Bayern and Nathaniel Brown reach full verbal agreement',
    playerName: 'Nathaniel Brown',
    fromClubName: 'Eintracht Frankfurt',
    toClubName: 'Bayern München',
    league: 'Bundesliga',
    confidence: 3,
    sourceUrl: 'https://www.bavarianfootballworks.com/bayern-munich-transfer-news-rumors/233743/bayern-munich-keeping-eyes-ears-open-in-transfer-market-but-are-pleased-with-current-squad',
    claimedDaysAgo: 14,
    resolved: { outcome: 'true', daysAgo: 7 },
  },
  {
    journalistId: 'seed-florian-plettenberg',
    headline: 'Musiala–Galatasaray links are nonsense: 100% staying at Bayern',
    playerName: 'Jamal Musiala',
    toClubName: 'Bayern München',
    league: 'Bundesliga',
    confidence: 3,
    sourceUrl: 'https://www.sportsmole.co.uk/people/florian-plettenberg/',
    claimedDaysAgo: 6,
  },
  {
    journalistId: 'seed-gianluca-di-marzio',
    headline: 'Como third bid for Chalobah accepted — ready to close',
    playerName: 'Trevoh Chalobah',
    fromClubName: 'Chelsea',
    toClubName: 'Como',
    league: 'Serie A',
    confidence: 2,
    sourceUrl: 'https://www.talkchelsea.net/transfers/jacobs-contradicts-di-marzio-defenders-future/',
    claimedDaysAgo: 2,
  },
  {
    journalistId: 'seed-ben-jacobs',
    headline: 'Chalobah bids rejected — no agreement with Como',
    playerName: 'Trevoh Chalobah',
    fromClubName: 'Chelsea',
    toClubName: 'Como',
    league: 'Serie A',
    confidence: 2,
    sourceUrl: 'https://www.talkchelsea.net/transfers/jacobs-contradicts-di-marzio-defenders-future/',
    claimedDaysAgo: 2,
  },
];

/** Later-verified additions (real, sourced) — applied on top of the v2 wire. */
const SEED_CLAIMS_V3: SeedClaim[] = [
  {
    journalistId: 'seed-fabrizio-romano',
    headline: 'Tonali chooses Tottenham — £92.5m deal agreed with Newcastle',
    playerName: 'Sandro Tonali',
    fromClubName: 'Newcastle',
    toClubName: 'Tottenham',
    league: 'Premier League',
    confidence: 3,
    sourceUrl: 'https://www.caughtoffside.com/2026/07/01/sandro-tonali-tottenham-fabrizio-romano/',
    claimedDaysAgo: 42,
    resolved: { outcome: 'true', daysAgo: 26 },
  },
  {
    journalistId: 'seed-gianluca-di-marzio',
    headline: 'Bournemouth trigger buy option for Álex Jiménez',
    playerName: 'Álex Jiménez',
    fromClubName: 'AC Milan',
    toClubName: 'Bournemouth',
    league: 'Premier League',
    confidence: 2,
    sourceUrl: 'https://www.caughtoffside.com/2026/07/23/premier-league-transfers-done-deals-2026/',
    claimedDaysAgo: 10,
    resolved: { outcome: 'true', daysAgo: 4 },
  },
];

/** Headlines of the retired v1 fake demo set — deleted from seeded installs. */
/**
 * Two-week backfill (curated 27 Jul 2026 from live news coverage): real,
 * attributable reports per journalist with coverage links. Resolved only
 * where completion was explicit in the coverage.
 */
const SEED_CLAIMS_V4: SeedClaim[] = [
  {
    journalistId: 'seed-fabrizio-romano',
    headline: 'Barcelona exploring Julián Álvarez move; Man City also keen',
    playerName: 'Julián Álvarez',
    fromClubName: 'Atlético Madrid',
    toClubName: 'Barcelona',
    league: 'La Liga',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMisAFBVV95cUxQMDZSb0V0ODY4UlYySWFHOFZEVngtRFNuU1ZPYmhYVDZqZEZMTl9EN3BIbm5wQ0pIRFRKdjMwQlpRRlN5ZllRM1Flak9mdlJJY0owR1hYVlc2RzEwQmpJMTNxSldlM0w1NUpuUTg5dDM5Z1o1UU5UVFIyQTUwVHdSczdFSl9GY3BSVzlaNGM0UlRxMkFqcDJybENPZjBhRktENC10UFpzYXV2U2w0NlBLNg?oc=5',
    claimedDaysAgo: 0,
  },
  {
    journalistId: 'seed-fabrizio-romano',
    headline: 'Ajax agree loan move for Tolu Arokodare',
    playerName: 'Tolu Arokodare',
    fromClubName: 'Wolves',
    toClubName: 'Ajax',
    league: 'Eredivisie',
    confidence: 2,
    sourceUrl: 'https://news.google.com/rss/articles/CBMidEFVX3lxTE1yMUxpQ09hRVBFdzRPWFc1OWI1eTd1M3VOZjBicWlfTzVNVnNyZzFTQTEyVzBTdnVyZUdwV0RRdE5MT21pUmYzbm5jRzRtNlBiaFcxeTJ3SERjRkVQRW1RdlFnWTZtT2R6alJvQjctZl9jeG02?oc=5',
    claimedDaysAgo: 0,
  },
  {
    journalistId: 'seed-david-ornstein',
    headline: 'Chelsea exploring surprise Danny Welbeck move',
    playerName: 'Danny Welbeck',
    fromClubName: 'Brighton',
    toClubName: 'Chelsea',
    league: 'Premier League',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMilwFBVV95cUxQUkJGUWFMT0xQdWZwRHp4Qm4zbjM1c0pWa2F6OWhIbEdFRzRTa05OV2ZJUXFJTFQ1QlJFZlpqcXNmME9pVm1PMmM4cXZJc01pOC1LYk5TUVJBVVUzYm1nLThIYk5YMGZndy1IeURVeHNWak1lNy1sRGN0QTdfa2RBZjY4dDk0anYycEN1cURhMTFFcktiblpj?oc=5',
    claimedDaysAgo: 0,
  },
  {
    journalistId: 'seed-david-ornstein',
    headline: 'Man Utd in advanced talks to sign Youri Tielemans',
    playerName: 'Youri Tielemans',
    fromClubName: 'Aston Villa',
    toClubName: 'Manchester United',
    league: 'Premier League',
    confidence: 2,
    sourceUrl: 'https://news.google.com/rss/articles/CBMiywFBVV95cUxPWnVVdjFRVk1TOG5rRnlQOThqeEdTVjdPcUluZ1Brb3Bic1pWaXpIbXFyY3hZNDNGRGp2T28xQ3d4akhXMUF2R2U5YXFxUHJuQmFPT193aWZMZF8xblk2QS04WVluVWNESDRVcUFXNGJFaW9XdF95bWg5RXd2LTAtT0N2MW1HdTk3amhOVFFpWmFFVl9uS013bXFseGQza1JkWEIyZURhazVDcFFkczYtaHgya1p2Vk5OaEh1S2JMcUlNdG43NUczeGhVbw?oc=5',
    claimedDaysAgo: 14,
    resolved: { outcome: 'true', daysAgo: 13 },
  },
  {
    journalistId: 'seed-gianluca-di-marzio',
    headline: 'PSG make contact for Parma goalkeeper Zion Suzuki',
    playerName: 'Zion Suzuki',
    fromClubName: 'Parma',
    toClubName: 'PSG',
    league: 'Ligue 1',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMiqAFBVV95cUxNRjUtNDZqMERUOHV0cE1ZSnZUZGNOTU5LNFNIeUxCM25weTJCUU92YW1LYmotTVJVNTdYVk5WYkVMd25pNk15VjB2OWs1aE5DbjR0U29zdlREX052T3VueDdzY2txQzRsNjVKYjBSUWhpVGNLNm1xMEVxdVN1TVBna1JGdnRCNWZXWUlBajVOVExCUG1sZkx5M3pFc0RPd09USTdSLUlIZTTSAagBQVVfeXFMTUY1LTQ2ajBEVDh1dHBNWUp2VGRjTk1OSzRTSHlMQjNucHkyQlFPdmFtS2JqLU1SVTU3WFZOVmJFTHduaTZNeVYwdjlrNWhOQ240dFNvc3ZURF9Odk91bng3c2NrcUM0bDY1SmIwUlFoaVRjSzZtcTBFcXVTdU1QZ2tSRnZ0QjVmV1lJQWo1TlRMQlBtbGZMeTN6RXNET3dPVEk3Ui1JSGU0?oc=5',
    claimedDaysAgo: 0,
  },
  {
    journalistId: 'seed-gianluca-di-marzio',
    headline: 'Roma reach €35m agreement with Bologna for Santiago Castro',
    playerName: 'Santiago Castro',
    fromClubName: 'Bologna',
    toClubName: 'Roma',
    league: 'Serie A',
    confidence: 2,
    sourceUrl: 'https://news.google.com/rss/articles/CBMieEFVX3lxTFAyWjM4Uk9jUE9VZDBWRnNhbXE3Um8wSm1NQjlOandLakNyeVhsTGNVczNhS2l4bTA2dVJ5Q3ZPaUJZTFVfRVRCZVFNbGl1bVpTTGkwVVppSm0za1hONjF5T2o1c2hSTml1SnVPaUZHbXVBNW80MldKdtIBfkFVX3lxTFBYd3ZXTllydm5IeUFFcXRVSUlXV2hzM2VvTHhhanFrQ3lEZ1V1SnFTQWtIaWRZLXZXZ0xreXhMMkNoRlBIV09hczc1cXZXOTZESmJPNHlTZEM4QTNZMmFIaFdOdHk3RF9MMjhtRGlPeWlaVy1EU3RNVnBldUsyZw?oc=5',
    claimedDaysAgo: 0,
  },
  {
    journalistId: 'seed-gianluca-di-marzio',
    headline: 'Milan working to complete Sankhoun Diawara signing from Troyes',
    playerName: 'Sankhoun Diawara',
    fromClubName: 'Troyes',
    toClubName: 'AC Milan',
    league: 'Serie A',
    confidence: 2,
    sourceUrl: 'https://news.google.com/rss/articles/CBMifEFVX3lxTE83SEoxMFhSU0JsNVNibVJlbGVhQVpSSjl5bkhFMU1BYXEzUHlKZUt2THdSRlA1U3FSVl9wdmk3R3liVmo3eTBkdGVCeGtkcUZ4bEVsTTUtRFBSM0Vxc2U4SDNKTWVPSHJtT3FlQVl2NDB4MWVTNm1DdVhQa1A?oc=5',
    claimedDaysAgo: 4,
  },
  {
    journalistId: 'seed-christian-falk',
    headline: 'Barcola on Bayern shortlist, but summer move unlikely',
    playerName: 'Bradley Barcola',
    fromClubName: 'PSG',
    toClubName: 'Bayern Munich',
    league: 'Bundesliga',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMiuwFBVV95cUxNRkZ6V0diaVNxQm9Bd2hscm9fTjlqWGpoUWowYTZnVVU1Tjh4MEFMX3lyejlQalpNQjlLQWVmRzZHbE9Iek5jbDgxdG8wYkFsMDR1V3AtOGpGSEFsNC1xZk9hYTc4S1dmX3JTaFpjc1I0UUFJcnBLZ3RfLTlMXzNPX1lxNEw3MVlfLUVrQmQxYTJ3dHJNbW5Ybld3R1FZWDVCbVI1ZFRwMWpiLUhIMVRGQU52NWFvZ254eXJZ0gHAAUFVX3lxTE1SV2JleGVyRzAyc0I1TTlIb0trSTdoMG0wT2JodW1xR0g1dlpDMmZaXzN0LTJ5YWo3NW9fejZGcDNPTDZlajhGSy1PMU94NV9qcWk2SU1MY0FpQjJRMHNGRER2MVdzNlZScmJLRnBfd3NUT2tIeTJ3dXF5Vm94cVpCd1ZsYWdXUm1OUWJPVzQ1WXdHdC1UYTFDNGMwRGRFczN5dWhteEMyalZ0YU9EMmFuWUVsRlUta2hBd1gzWFlSUw?oc=5',
    claimedDaysAgo: 3,
  },
  {
    journalistId: 'seed-christian-falk',
    headline: 'Michael Olise wants Real Madrid move',
    playerName: 'Michael Olise',
    fromClubName: 'Bayern Munich',
    toClubName: 'Real Madrid',
    league: 'La Liga',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMi1gFBVV95cUxPbXhMT0N3aW1McDEwYXRocHRiWVdELXI0dWUwTm1Ndy1RbmFyb0x2SU90MVJTMGQ4T1hwZGRaaFQxV0wxdEVCRExoVjhpTlpvZmEwZGRfdFVyekV4OGZ0NnQ1MUk5ckRoTDZrNy1VQ3pZTGp0Z0F2ZG8zaDBWM2dOeDdGSDdrNHltTWtXUEhqR21nRXk0NV9hQWx3Y00yOGlhdS1uQTdESDROTkdCRmRYMHZER2IxUXp5RmZZM1VKbkl5bEgxUXNnb2JLX1ZJMTFWeFF4akp3?oc=5',
    claimedDaysAgo: 3,
  },
  {
    journalistId: 'seed-matteo-moretto',
    headline: 'Rodri agrees personal terms with Real Madrid',
    playerName: 'Rodri',
    fromClubName: 'Manchester City',
    toClubName: 'Real Madrid',
    league: 'La Liga',
    confidence: 2,
    sourceUrl: 'https://news.google.com/rss/articles/CBMiyAFBVV95cUxNb3pES3BUZjZBby0xakt3cHlVcGJkMWM3dE9KU2ZqaDkyWFdnR0ZNM3BZMVJfNkswY0x3VWVBRGFaUDdNNE5BX0Y5RlRwWVRUbFpwckh4aVBGUS1QLXQxLTl3aDNUZVRRZm5MUHRCY2JaSkp3c01UUWZyWjliTHFUMS16RkFSZU5idnA1RzB5WHpaYllPMTZIUUNTNzlGNkpTaHhlcF9LNUoyQWJsS1VXNTA5YVoxVGlDSGI5X2VPcXNGME1vLWlpT9IBzgFBVV95cUxPWW1CS1ZURjdmYTNvQU5jOW9TTzVZRk5CZjB2RVpQOFJVa29oQUM0VThQb1R2QTM0dTRQYk9NdTlNTU94ZGp3U0plcVVIS01MMGhvMXNjcExVRlFOS3RRb2VkTzVzcXlxVmNYSWhXLTVBUWc4WUVMQ3ZGcVppdGhoZURLTlBhdEwwS2FEYVVNQXdDT3poNDl5NHM5S3dmdUdLMzlWa3R4aVg3VmFMbXBKMFB4a0M3c0FaeTZtNTZyYjEyZmRFVVJnc1BuenlzUQ?oc=5',
    claimedDaysAgo: 2,
  },
  {
    journalistId: 'seed-matteo-moretto',
    headline: 'Summerville wants Roma after Gasperini contact',
    playerName: 'Crysencio Summerville',
    fromClubName: 'West Ham',
    toClubName: 'Roma',
    league: 'Serie A',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMihwFBVV95cUxOZnMyTFBEdW5tV1ZsRldTdzA2VmtYOWtmZTlPc2l2M3hlOGppRnkwTkNYTjRsS2lRSlpJQy1fZnRoQmtlbnpKb3BreUM1WWctVlFVakRqT2ppSXRUM255cUtDRm5ILTAybjBvdVZ3RUtBNW5vMXhpRXFQdWtGUmdmQkwyRWxYZkU?oc=5',
    claimedDaysAgo: 5,
  },
  {
    journalistId: 'seed-ben-jacobs',
    headline: 'Man Utd make £26m offer for Manu Koné',
    playerName: 'Manu Koné',
    fromClubName: 'Roma',
    toClubName: 'Manchester United',
    league: 'Premier League',
    confidence: 2,
    sourceUrl: 'https://news.google.com/rss/articles/CBMihgFBVV95cUxNdUJTbHg5MTRIdEdudWdMQ1B3MG91REhsTXV0c2g4OUl4OG9jdlN6dS1yOHZORkZvOU9PN1E4RmY2c24yNVdGN3k3ejRtN3pJRnNIRFBiX0ZldVhvMjZOeGZlWTlxUzNKdzdSQk5JUXNoS2JsZ2VyMWlrUmw2b2swZUpmMzBtQQ?oc=5',
    claimedDaysAgo: 1,
  },
  {
    journalistId: 'seed-ben-jacobs',
    headline: 'Tottenham in talks with Man City for Savinho',
    playerName: 'Savinho',
    fromClubName: 'Manchester City',
    toClubName: 'Tottenham',
    league: 'Premier League',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMijwFBVV95cUxQeGprcjZoRUlZZ0hlaWlybkthbUNOV1pyRFNNSlJITHduSGFjTUd1WFl4VGFDTUVlNURTa1E4Njg1TUxoZ1NFWTNYWDlSa09oUFJPS1RuQ185VDRjcW9rVHI5TzdvZUFyc2VSMmZaZ2J6ZkJaNEVXWmg4Tmw3SFNhb2trZ2RBSGNXYWZZMEdrcw?oc=5',
    claimedDaysAgo: 2,
  },
  {
    journalistId: 'seed-alfredo-pedulla',
    headline: 'Roma open talks with Bologna over Santiago Castro',
    playerName: 'Santiago Castro',
    fromClubName: 'Bologna',
    toClubName: 'Roma',
    league: 'Serie A',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMipAFBVV95cUxOak10NkoxVEdyVlJEQ0hLd0hIcXJ4MHR3VlF3ZDdldWluZjBqci1mQ0d3ZGtCb1N4dlBJd0U5ZzVxc0FyNlVYLU5CeWx2eGd2R2RpNy1Ub3dQRUk4al9rOXNKQ2c5NzRjenBjbEdNUVdtMjc5RHBJMXZZajVsaGlBWDBoVUhXX1BaYWJ2VFhfZWpQV1pJUlJGMERMUWk5QW01U25oX9IBpAFBVV95cUxOak10NkoxVEdyVlJEQ0hLd0hIcXJ4MHR3VlF3ZDdldWluZjBqci1mQ0d3ZGtCb1N4dlBJd0U5ZzVxc0FyNlVYLU5CeWx2eGd2R2RpNy1Ub3dQRUk4al9rOXNKQ2c5NzRjenBjbEdNUVdtMjc5RHBJMXZZajVsaGlBWDBoVUhXX1BaYWJ2VFhfZWpQV1pJUlJGMERMUWk5QW01U25oXw?oc=5',
    claimedDaysAgo: 2,
  },
  {
    journalistId: 'seed-alfredo-pedulla',
    headline: 'Inter in full discussions for Cristian Romero',
    playerName: 'Cristian Romero',
    fromClubName: 'Tottenham',
    toClubName: 'Inter',
    league: 'Serie A',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMirgFBVV95cUxPVGdjaGE5T04xQ0xMYUN6VHdBRll0aDVwOEV3dXN5bUVvcExVMzBodlRXM0lrd251NnNrSmYyVHdnMmw2bjcwQVJ5RnRsSm5CSXlTeXE4SlBLakJoNkotY01OQWF0WGowZFVxSFVYOEdZdzJpYmtwRWw1eEltUVZvUjRwVkxEWVFsbmotdm1mOHptdXl1VV9hNEttOElxbzFVQWM4M1BGQnhoQWZMakE?oc=5',
    claimedDaysAgo: 3,
  },
  {
    journalistId: 'seed-nicolo-schira',
    headline: 'Liverpool agree six-year personal terms with Barcola',
    playerName: 'Bradley Barcola',
    fromClubName: 'PSG',
    toClubName: 'Liverpool',
    league: 'Premier League',
    confidence: 2,
    sourceUrl: 'https://news.google.com/rss/articles/CBMizgFBVV95cUxQTnd6MktqbUhxWFVwZjR5eGF1VmR0QjE0YVpKcDE0cXc2eGFzNDlzR2ZCaUh3ZW5yTUdLYlBIU2lWb0cyNVE1Z0tsUlNvVEdzTnpUWFBqcjQ1cFk2NEVJTU1ZbDlfUFFrQUFsMGZuYXRKRVllSTYwbTg4ckRWWlhWUmMwMVZOLUZuZ2E1VXQ1MnY4QWUxYUdCYjk1Q0dBNHAtX3NCX25lWFh1bE16VkFfR0tYemFkelNEel91MXp6Tnlvb09tM0FjNU9TRnRBZ9IBzgFBVV95cUxQTnd6MktqbUhxWFVwZjR5eGF1VmR0QjE0YVpKcDE0cXc2eGFzNDlzR2ZCaUh3ZW5yTUdLYlBIU2lWb0cyNVE1Z0tsUlNvVEdzTnpUWFBqcjQ1cFk2NEVJTU1ZbDlfUFFrQUFsMGZuYXRKRVllSTYwbTg4ckRWWlhWUmMwMVZOLUZuZ2E1VXQ1MnY4QWUxYUdCYjk1Q0dBNHAtX3NCX25lWFh1bE16VkFfR0tYemFkelNEel91MXp6Tnlvb09tM0FjNU9TRnRBZw?oc=5',
    claimedDaysAgo: 0,
  },
  {
    journalistId: 'seed-nicolo-schira',
    headline: 'Antonio Vergara signs Napoli extension to 2031',
    playerName: 'Antonio Vergara',
    toClubName: 'Napoli',
    league: 'Serie A',
    confidence: 3,
    sourceUrl: 'https://news.google.com/rss/articles/CBMisgFBVV95cUxQTjFXbHdkMjZyeUUxYXJ4d3N3M19VdWRNSHItVlFHamRLUXIydDlBdF84SFRkMEFXd3g1b2U3bkcwQmZLbnlvMThlNG5iZ1VTakgzaWs5NF95MlRrUWtkOUNFUmVVMjZDdE91VFFuUnY5NWR6TXc4Y0lCczJvU0hCOVZEQWtfYnJhVWMxY29scmJvYlEyd0g2WGtyUGx6cjVldXFjVWwxekhlWG9MbkNaRU5n0gG3AUFVX3lxTE5HYWdzbjYtMGtqdmdrT0RiUGtVNnc1NkJSSUVfRXNIVEhKVWp2dzNZempXaXJNdlpUZHRlajhZSDl1am42YTl6VTVaWXhweklQLU84TzQwMGVCM1lEODhvbFhGZE5FbUgwcnFNS3VFLVNHN25lcGNlcWxOLU5qVkw3OEJILXdyOFFZVDhIMFFSalFyclFQb0RrLVhpTEtfNGVwLTJMZmZ4eVhoUnhDRzFhMklocFVWWQ?oc=5',
    claimedDaysAgo: 2,
    resolved: { outcome: 'true', daysAgo: 2 },
  },
  {
    journalistId: 'seed-nicolo-schira',
    headline: 'Salah agrees personal terms with Besiktas',
    playerName: 'Mohamed Salah',
    fromClubName: 'Liverpool',
    toClubName: 'Besiktas',
    league: 'Süper Lig',
    confidence: 2,
    sourceUrl: 'https://news.google.com/rss/articles/CBMitAFBVV95cUxNX0tTX05zaGFDNUN2UGhmcWNibnVfNjB1OHM4aTdwVWJMTXdKZVRlek9QUjlaZ3lGMXVIbHpIeld4ZVhwbVdIakpnQ19wQUk0eXM2WnRrZUFfUGpnYVlXcnFDbGNndy1qZW1VN1FhTlE0YldQZGc1R2c4bjFpU1lSWjcyT1M0Z0pCSXN2TFJOQzZ4LS1YcUZjZDQtczdaUWpMc1dNei1vZEdESU1PT3h5cFd0TnI?oc=5',
    claimedDaysAgo: 2,
  },
  {
    journalistId: 'seed-dharmesh-sheth',
    headline: 'Arsenal retain interest in Barcola after Rogers miss',
    playerName: 'Bradley Barcola',
    fromClubName: 'PSG',
    toClubName: 'Arsenal',
    league: 'Premier League',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMihAJBVV95cUxOanpVTkN0TXpmMG9CQ2Yxbk0xTjQyTktST19hLU1VVVRNS0JhdlJkMTl3OHVNblo4RDYtdndiV0JYLU1PLTEyT1FTTVdncGhkUTRTNlU1VnJQWkhHbVVXQk5sOTNXQy12NnBmVHpwM1dELVJheFJlLVZTTDZVMVZOdTNGbmFkUEcwaURBR0NfRXU1WWFvcjBuN01PbDlDek03ZFN6TklFWHNROVdLbDg3b0trd1ZIenVZeUVIYldsakdDZXhtYkR6VWUtSlRjajk4ZzNYUnh6Ym4tdEJqUVoxajJRM2RNOENBZ3JZejV4UXFvaE0tZVowNmlOalZUVTVKTVlScw?oc=5',
    claimedDaysAgo: 5,
  },
  {
    journalistId: 'seed-dharmesh-sheth',
    headline: 'Arsenal still keen on Julián Álvarez despite Barcelona preference',
    playerName: 'Julián Álvarez',
    fromClubName: 'Atlético Madrid',
    toClubName: 'Arsenal',
    league: 'Premier League',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMi-gFBVV95cUxQdE1rY1QzSm1FMkM1ajNPbmlSSUhIaHBIUldydUc1b09YeGctQjFwTXFVeWtqMV8zRUd3cE1NNFo4LU5tYWNvYWJXVy1IRDNIWTVIMHF5bkZ4VGptQkF2RlRfdEJzZUUzanp5Vjc1Qk9mRC1OV1lUdFBvczRsQzAwTlZVbDhVVmRrRnZrYjBHdkloejBLUkljaFBPaE45dG93Tm5XSVc1QkdyUDZFTFFkek4yTEVrUzBXMVhwbWZaNzdwX2ZyUDBhRGRJZVQ3a3k4eUdNMW1COG41bWtSN1Z2YldDMzJ3V2Nsc1BPMThHMFNZRVpreTFWdzZ3?oc=5',
    claimedDaysAgo: 10,
  },
  {
    journalistId: 'seed-santi-aouna',
    headline: 'Akliouche picks PSG over Liverpool interest',
    playerName: 'Maghnes Akliouche',
    fromClubName: 'Monaco',
    toClubName: 'PSG',
    league: 'Ligue 1',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMingFBVV95cUxOdWtud3lBTFJFek9mUVNHMGRaZHhjZjktSUxIMllsdlRURVAyYWpra2tWMnpMTFJWOWliME1qbkljdlRqWDlDU0l3aGgxS0FQMi1CM1pCZTBXVlFDSkRBWDY0WkhoWEV6d3M0ZWxoZkJwRW9Td3B4WVpuODVSYmo5SlJ2TVV4V010WllwSFFLcWIxWV9qVjJ6WTV1eHp1QQ?oc=5',
    claimedDaysAgo: 1,
  },
  {
    journalistId: 'seed-santi-aouna',
    headline: 'Idrissa Gueye set for Al-Diriyah on one-year deal',
    playerName: 'Idrissa Gueye',
    fromClubName: 'Everton',
    toClubName: 'Al-Diriyah',
    league: 'Saudi Pro League',
    confidence: 2,
    sourceUrl: 'https://news.google.com/rss/articles/CBMimgFBVV95cUxOc0R4anB5TGQtSDBRUFFjeFlKeGJhQ01pNFp1bFltWUVzeVNxTWt3WllCdFc2b3BMWmtCc2d3aUduQkNzeTdLSkxKTDlaRnhXS2lGOEtCV0U4Q04ta29oTnZxR3phdVRaY2RuTFVmSXdJbUFfbjJGU1NFMkkySFk2Q19BdVVhYWFlakZmcXlHRUNMaUpoTnhiaU9R?oc=5',
    claimedDaysAgo: 3,
  },
  {
    journalistId: 'seed-sacha-tavolieri',
    headline: 'Dortmund close in on Karetsas as decisive Genk talks begin',
    playerName: 'Konstantinos Karetsas',
    fromClubName: 'Genk',
    toClubName: 'Borussia Dortmund',
    league: 'Bundesliga',
    confidence: 2,
    sourceUrl: 'https://news.google.com/rss/articles/CBMiwgFBVV95cUxNMWFVWTdaNTZ6anVHdzU1M3pKdHhXTENreHo2M3BHX0tyZUZXTV90bGJ1UFpnREg4Z2JsRjlLNVBZZVNvaTRkZUhzUF9FV21venlWN2tEWV9TelFBc0hMWXdEeVpLX3NPSnVKaGJvSy02clBLQWd0VWU2Z05sM0Q3X0RJdi16TTVjdnlBMkZGbEsxcTIySFpiNFUtY2dNSHRzdVRJZnVaSmV6MDVpSVd2ZThkcU42bXlnaTFOU29jY1p6Z9IBwgFBVV95cUxNMWFVWTdaNTZ6anVHdzU1M3pKdHhXTENreHo2M3BHX0tyZUZXTV90bGJ1UFpnREg4Z2JsRjlLNVBZZVNvaTRkZUhzUF9FV21venlWN2tEWV9TelFBc0hMWXdEeVpLX3NPSnVKaGJvSy02clBLQWd0VWU2Z05sM0Q3X0RJdi16TTVjdnlBMkZGbEsxcTIySFpiNFUtY2dNSHRzdVRJZnVaSmV6MDVpSVd2ZThkcU42bXlnaTFOU29jY1p6Zw?oc=5',
    claimedDaysAgo: 0,
  },
  {
    journalistId: 'seed-sacha-tavolieri',
    headline: 'Darwin Núñez closing on Besiktas loan',
    playerName: 'Darwin Núñez',
    toClubName: 'Besiktas',
    league: 'Süper Lig',
    confidence: 2,
    sourceUrl: 'https://news.google.com/rss/articles/CBMingFBVV95cUxQcVlBN3BocEVIY1BIRE9Qcjc5aDRvZjJLU3M4N0cxODR5WVhYT0dXcXUzc1VYWXY2NzhlRHJia0pYWjlwWTdscVA4anRDZGJDc3R0bjNSXzhGMkRGc3RaNHZRdVBzYkRiRWxRem55empJSlRfcTZhNmhna2pfVGM5bS13aXJBTEJVVkE2cjIzNGJwZlBMTnFEaVV0R1dyd9IBngFBVV95cUxQcVlBN3BocEVIY1BIRE9Qcjc5aDRvZjJLU3M4N0cxODR5WVhYT0dXcXUzc1VYWXY2NzhlRHJia0pYWjlwWTdscVA4anRDZGJDc3R0bjNSXzhGMkRGc3RaNHZRdVBzYkRiRWxRem55empJSlRfcTZhNmhna2pfVGM5bS13aXJBTEJVVkE2cjIzNGJwZlBMTnFEaVV0R1dydw?oc=5',
    claimedDaysAgo: 2,
  },
  {
    journalistId: 'seed-mike-mcgrath',
    headline: 'Wrexham closing on £5m Danny Imray deal',
    playerName: 'Danny Imray',
    fromClubName: 'Crystal Palace',
    toClubName: 'Wrexham',
    league: 'Championship',
    confidence: 2,
    sourceUrl: 'https://news.google.com/rss/articles/CBMiwAFBVV95cUxQX3c2NlR5OEluQm5vUldYRjJVeWlScUczVzNxTW83dndQeDNUOXdZa05IbjBHbDEwblhuNmxlaWIxVGRkSVN4VUJzeFhwOEpjUlhtTmIxSzVfVjVKLU5ZdEpGX0ZwMjI0V25iZDJtYm5ZajFVZ3pzOW9QMUVnNGtyc01vREdnclYwNWtpQTdoQTZZTHRuVjd1aFNhNnlkeDZTNUlqb1drOTI2eWxoRnA2NnlMWkl4SHRyTG1sREc3YVE?oc=5',
    claimedDaysAgo: 0,
  },
  {
    journalistId: 'seed-mike-mcgrath',
    headline: 'Ipswich negotiating Abdul Fatawu transfer',
    playerName: 'Abdul Fatawu',
    fromClubName: 'Leicester',
    toClubName: 'Ipswich Town',
    confidence: 2,
    sourceUrl: 'https://news.google.com/rss/articles/CBMivgFBVV95cUxOQXdfQ3lCNG9KY2huYVRzYldwLTg2aTJxRllKdllLc3BaMmx1b2JXR210WlcySjRNX2JZd1d4ODUxejFVM0phNFp5R0hEU2dKenUzX0ZaRFEwa0ZiT0JTeTR4UlNsOWVBUFJVcUprSFhzS3FiWnM2WlBuZEU0UW9CbS01dzlQUnM1RTB3dVdmU2NEOFBURHBlX19uNXhlSEdSWWp3LUlocEVaWkZ5SVIxSlpTMzVwVW1RMmxfcnpB?oc=5',
    claimedDaysAgo: 8,
  },
  {
    journalistId: 'seed-simon-stone',
    headline: 'Man Utd complete Andrey Santos deal',
    playerName: 'Andrey Santos',
    fromClubName: 'Chelsea',
    toClubName: 'Manchester United',
    league: 'Premier League',
    confidence: 3,
    sourceUrl: 'https://news.google.com/rss/articles/CBMiZ0FVX3lxTE5XeFE4elp5XzFMZkFpS21XM0dQdzJBNHJ3dXpreGpSdTAxeXgxaHFUdHFIM3hESGlrbkRDc2REUjdGSVdHTVRQT0tiTmhsNGRwQ0lha0VCVFR0Qkg2LURvd3l3M2ZENjg?oc=5',
    claimedDaysAgo: 14,
    resolved: { outcome: 'true', daysAgo: 14 },
  },
  {
    journalistId: 'seed-simon-stone',
    headline: 'Positivity around Man Utd move for Tchouaméni',
    playerName: 'Aurélien Tchouaméni',
    fromClubName: 'Real Madrid',
    toClubName: 'Manchester United',
    league: 'Premier League',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMixgFBVV95cUxNSEpDTVFQMnA0RzJKVnFDd25BalBRbkJDR0RPSVRBTTFlUDVTNldNRVAxemx6Z3JoS01SczY4SkpnWDRxb0o3WE9sdnF2aC1JYVBzS0k4OVFyeHhGc3MtWFA5bWllU0Qzb2xwUzZFZXoyd1dUSVlROVZXU05JUnh5UjMyZTVqZzFuQnNQQ21BbkxLRkVISnpoLUFWSDc1UlRrWUVVamdHaUg0Y1dxWktTTG5IbTVmSl96VFJDZDZ3MUQ1bkdlVlE?oc=5',
    claimedDaysAgo: 3,
  },
  {
    journalistId: 'seed-guillem-balague',
    headline: 'Barcelona to step up Álvarez pursuit after World Cup',
    playerName: 'Julián Álvarez',
    fromClubName: 'Atlético Madrid',
    toClubName: 'Barcelona',
    league: 'La Liga',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMiyAFBVV95cUxPLTVjbDRrQ0VRNmlLMnRITDJZeThzSl9Ydk8zN3pUVERjOURyVkliazlFYzFOd2pDX0VIY3hOQnBVd2lOYkFoeDE3N28tOG9mMDItbTdwVkxTYWZGaG83dVVPZ2FjekQ1bnFYU3lQem1Gam8tc2lzQWJEUUlkaGpUSjJyckU2a3ZqRUNLM0REbXFpSzN0akQzTk1jLTY5dENyWnlkNDlDcHBtTmlOUEQtOV8xaFRhNHBYWXloRUxpY1lwdl9URi1zRdIBzgFBVV95cUxNWll3ZS16T1JrQ0J6WEt2VzkzSGlvVUhWMmxTQk85THRHUnFkWG1PeE5wZFg0RzJoNy1iLUMwUWlsb0ItWWNoM3hjSWg4dThoNmdaQTd3c1pfTU92c2ZkY2ttOWV3Nk5qZXNwczJkMGhVWVBGWHYwRDVobHBYZnlYaTB5RXZvYlBlaHpjZlZ6QjZUeXljcVd1c2N6V2QzYUdYN0RaVUw0RTlkOG53OFNNeGsyV0RzSXItdnpzdmcwVXZvZTdnQ3dOOXJ6eXZVUQ?oc=5',
    claimedDaysAgo: 6,
  },
  {
    journalistId: 'seed-ekrem-konur',
    headline: 'Man Utd monitoring Ollie Watkins',
    playerName: 'Ollie Watkins',
    fromClubName: 'Aston Villa',
    toClubName: 'Manchester United',
    league: 'Premier League',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMilAFBVV95cUxORnlpRnhidHNiWGJMTXJWS3ZSYVpGVFQtUXhaSENJV0tpM2ZSMmgxRTUzclJ1Nzk2VkdlWTlUcThzbVFQamY2QnhCTnZrUzZYTWl3amVEUGx1UmJMYkVZQVQ2Y01ES0dFQ19MRFFKcWV5ekFsZHYyb1I4c2VPRjBmbzlmMkdaTFBySmZiUldvV0ZsWGhN?oc=5',
    claimedDaysAgo: 3,
  },
  {
    journalistId: 'seed-ekrem-konur',
    headline: 'Jamie Vardy considering Sevilla move',
    playerName: 'Jamie Vardy',
    toClubName: 'Sevilla',
    league: 'La Liga',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMihgFBVV95cUxPdlprQ182ZjBGZ3hBS3g4VXNsUTJqWGo0c0ppaEtVU3pjSkpGNS1nbmp5X1daZ0liTTBUbFZrUDJMZUxVUmRYS3lTSEZCbG1wREJHM29yVEZkWmRjSTMzMFh5T0h4OXNGZXZvbUkxVFU0YVZpNGJwSzNCN3hNcTBtQVNBbG00QQ?oc=5',
    claimedDaysAgo: 5,
  },
  {
    journalistId: 'seed-gianluigi-longari',
    headline: 'Al-Hilal eye Bayern’s Luis Díaz',
    playerName: 'Luis Díaz',
    fromClubName: 'Bayern Munich',
    toClubName: 'Al-Hilal',
    league: 'Saudi Pro League',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMipwFBVV95cUxNd0RpbWMwMUZCZEdvUzFMcllJRFZfcWhlNE5ob2ZPd3h2bS10VERpWHdTaC1IS0xCV19BTFZFNTVzZHhkN1BQbVg4cGJISEVEbmxzYlR3SElVY3dPQmltM1YtUTVNZUk4TzRxRmpneU03WGlMMUdHVm5UMWVMVHA2VDU2TDlBQXhNdVg3ckhMUmNaZWJoY2o2ams4d3pjQmdGSkFjWHdNd9IBrAFBVV95cUxPWDM0R242aDFOdExwUHBodnlqSllhVmVTV2U4d3h1ZVRuZGVXNGZOTlpHU0tDVDE5dkozZW9rN3pyb1BFQmtaUFh6bVpRTWJxeTJmLUVqdzdwbG55bm1LWUthNkpZcW9NX05VQTlzWFJHcDhlM3l1VGN5dGVlRVBaOEJZcG1qT19fVW1XS0hvRmhqeHN3Wmh6bmkyZzZjZVNVLXdld0dkMm8xcU5U?oc=5',
    claimedDaysAgo: 2,
  },
  {
    journalistId: 'seed-gianluigi-longari',
    headline: 'Pedro Neto offered to Al-Hilal',
    playerName: 'Pedro Neto',
    fromClubName: 'Chelsea',
    toClubName: 'Al-Hilal',
    league: 'Saudi Pro League',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMiSEFVX3lxTFBKZjFOaXcwQmU2Mnc4OWx1cVVQR3A3YmVrSGpRRnFIc1VQU28tQ1Exak9vTUNXMHl0ZkxuSU1XTURPZkh2SzdTSA?oc=5',
    claimedDaysAgo: 2,
  },
  {
    journalistId: 'seed-daniele-longo',
    headline: 'Intermediaries working on Leão–Galatasaray move',
    playerName: 'Rafael Leão',
    fromClubName: 'AC Milan',
    toClubName: 'Galatasaray',
    league: 'Süper Lig',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMisgFBVV95cUxQUjZuMkp4YzZack1MTkpWemV4M1FSdU85UTN0TWF6V1AtTjdhQnJMa182cXhSVEdJcU0tMFptdHFyVFVaZEh5LXJlcGxYc2NaOFdiV0hScjZ5VjkwM2hMaDI0SlpuNk5kMVI1Z21VUGtwUU1IVXVWUkhrTmZyRjMxS2NJaTRqc2cwV3VSeXpWOWk3aUNxcXh0VUxyemN6Tks2RXFTektRcjFscVpUYWJPN1l3?oc=5',
    claimedDaysAgo: 5,
  },
  {
    journalistId: 'seed-daniele-longo',
    headline: 'AC Milan plot move for Mazraoui',
    playerName: 'Noussair Mazraoui',
    fromClubName: 'Manchester United',
    toClubName: 'AC Milan',
    league: 'Serie A',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMie0FVX3lxTE1Sbl9hYUlLNEtpMnVqejFzcV9jYVNmMjgzWWRqb01MWHlRWkh3NWItSTVXU01pQnR0ckJEYm1aSS1rU0VhWU5WdTZkTVltZl9YcGItNDNORWJ3U3hXMU1QaTNSQ2QzLXVKRndRNFVhdnNZeEgzOHFwWUZiNA?oc=5',
    claimedDaysAgo: 11,
  },
  {
    journalistId: 'seed-loic-tanzi',
    headline: 'PSG confident of completing Diomande deal',
    playerName: 'Yan Diomande',
    fromClubName: 'RB Leipzig',
    toClubName: 'PSG',
    league: 'Ligue 1',
    confidence: 2,
    sourceUrl: 'https://news.google.com/rss/articles/CBMimwFBVV95cUxQeUxHV2pCdVQzbTBqSkJWLVJockRFT0VLdkxySWlDOFFwRUc4WXdTQjJ0MkJvWG5wTjkxbXNaZUVDMVEzazhQem5oOEFYWm1yQnRvUTktSThJekdfamR5RlJiNlFjN2dOWmRPeHd2UXpxVldxdTJGY0JjS2JmU0JudkdRRnpsYUNaYWJ0NldpdW1xdV9TTU1jQVFkb9IBoAFBVV95cUxOQk9YUUpNZXJNLUZaZUFSQ21FNHBmM1Jhd2dkZXlpU2hiZmxQM1VjcUZpeWpvaEdvN3JJSmF4YWE3a0V3UFRmN2ZGTU5scVd0QlJkbkk5bjYzTXAwWkhGSWxyMUlmNE9ZVkhnT3FmdDFPcW1EckozdDBNYmRPSGFTU2J0S2Jyd2FFVEFnTEFyeG1oZkpwTlE2ZjlSYjlKdDZk?oc=5',
    claimedDaysAgo: 7,
  },
  {
    journalistId: 'seed-loic-tanzi',
    headline: 'Liverpool interested in Ferran Torres',
    playerName: 'Ferran Torres',
    fromClubName: 'Barcelona',
    toClubName: 'Liverpool',
    league: 'Premier League',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMiqAFBVV95cUxPWWFnd1JTT2Q3MWpNdTZra1pUeWpZa1l3bTZUOXM2cTQ1LWtJalJURlM0NzUxcDJUU2FWQVBVenpRZjBhZVpMQ1gwYjlnTDM0SWtPS083SU9WZlZjQkRYLXZ3QmQybFk0UUNlRllKQnVia3dGMVc5QWtDek1fc01XeFVJNG5EWnUzWHltY3dPV3JLbnFySWdoWmNIVnVMaHlPUEhtbzJFcHc?oc=5',
    claimedDaysAgo: 6,
  },
  {
    journalistId: 'seed-cesar-luis-merlo',
    headline: 'Felipe Mora signs for Atlético San Luis',
    playerName: 'Felipe Mora',
    fromClubName: 'Portland Timbers',
    toClubName: 'Atlético San Luis',
    league: 'Liga MX',
    confidence: 3,
    sourceUrl: 'https://news.google.com/rss/articles/CBMib0FVX3lxTE1YbHRNWld1N1lLM3RYM2dFTFFVb1djdWhYeUYwZmo4WjBRU2lmN196MFhhN2xuVnBPYVlOREkyQjR6SDczNlNTR1BGQnE4U2hwQTVJM0ZnYld3dkRBVWhwMEhWWUdZZkhkSDdZa21rSQ?oc=5',
    claimedDaysAgo: 2,
    resolved: { outcome: 'true', daysAgo: 2 },
  },
  {
    journalistId: 'seed-achraf-ben-ayad',
    headline: 'Barcelona in decisive phase of Álvarez pursuit',
    playerName: 'Julián Álvarez',
    fromClubName: 'Atlético Madrid',
    toClubName: 'Barcelona',
    league: 'La Liga',
    confidence: 1,
    sourceUrl: 'https://news.google.com/rss/articles/CBMixAFBVV95cUxNXzMwdkI4ZDB6Zi1ndmU0aldTaTEwVXBYcHpxZGZVbGJVaDdyTDRwRkhoVGpoR3VFSUEzSEdWbmV0Y3ZhdFZ2cmRhcFc4NlI4MmtzRnl4aUh1M2xXYjAtRTk0b2pETy1NQVR4aC04SFBYcXcyRFVTNW13T09CY1MwMHF2LXNQY1lBX1ltSktCZW9BOGp6ZGV3bXRKM2Z2UlkycG1OS3RrU1M0bGtLM1NCZWNjZWFiSlhhNU5WaC1kSzVMOG050gHKAUFVX3lxTE9yV2xvVUNLMkhhMzllUmJfU0pBNVVQVDR5amw3OGZEZXUyWXdobXJaSlduTE5sTTNOOEFNUldBdWdicFc1RE9iM0xrQVM5NE5Cd2N0aWpoWE93RDN3aWF4dmdkZFdyakdvbTVUS19PUXp3YnZ0RnlLRGpNSmR2WGVUaDRpa01PdlFOVnFZWnZtSFQxWE16V0gtUVdVSDlCcG9EZlhrT1czTUp1SnVDdV85WEVEZjhHWmdzdGNlQ3ZGcXA3cVRHNGF0RkE?oc=5',
    claimedDaysAgo: 3,
  },
  {
    journalistId: 'seed-john-percy',
    headline: 'Aston Villa agree £35m deal for João Gomes',
    playerName: 'João Gomes',
    fromClubName: 'Wolves',
    toClubName: 'Aston Villa',
    league: 'Premier League',
    confidence: 2,
    sourceUrl: 'https://news.google.com/rss/articles/CBMipAFBVV95cUxQOVA2a3F6UzBRQ1FuV2QxMFdIWDdMbjI4VHktSWg4M1pydXFBSTBVUjRTNEVlZWtxbTJhSFltZmhBWWNsbmJab21LRUNFYllXaF9aMGZGZW8yUXJxMmZkbjE1aGhzcFl2LXRkRFpJa1l5S0xqV3NLYllSRHR3Z05LelNsQmNzZ0g1bWZzUFM0TzRqWkJuS0VmZ0xpY3E0ZkNCSTZ2eA?oc=5',
    claimedDaysAgo: 11,
  },
  {
    journalistId: 'seed-john-percy',
    headline: 'Chaplin to Leicester close, medical booked',
    playerName: 'Conor Chaplin',
    fromClubName: 'Ipswich Town',
    toClubName: 'Leicester',
    league: 'Championship',
    confidence: 2,
    sourceUrl: 'https://news.google.com/rss/articles/CBMirgFBVV95cUxPbmZ1aklzT1BtWUtOejJDb01BbUY2TEg4TFh2OXZyMkJNeTZwalNLZWtRdTdrNk9qOEFUVk9VSmJaa1ltX1FWaU9IX252RFJyT1padmttaTg5dEx5dGVvZmNFZDd1c0tSN3pxSkRBSEo2VTJndk1kNWlYYXRkN1I0akdQX1VLdzVrUEx5VG93UER6RTczOUc2SUZHUGdyT25HWGJMT2xSRVlVdGRCZ1E?oc=5',
    claimedDaysAgo: 14,
  },
];

const V1_FAKE_HEADLINES = [
  'Haaland agreement with Real Madrid at advanced stage',
  'Nico Williams to Bayern, here we go',
  'Osimhen to Juventus, done deal — here we go',
  'Kudus set for Newcastle medical',
  'Arsenal agree £70m package for Rodrygo',
  'Saka signs new long-term Arsenal contract',
  'Liverpool exploring Zubimendi release clause',
  'Woltemade to Chelsea at advanced stage',
  'Bayern medical booked for Wirtz',
  'Leverkusen close to Sesko deal',
  'Leão–PSG talks opened via intermediaries',
  'Inter agree terms with Gudmundsson',
  'Kimmich agrees Bayern extension to 2029',
  'City agree Musiala release-clause package',
  'Chelsea preparing €60m bid for Fermín',
  'Vinícius renewal stalled amid Saudi push',
  'Atlético close on Sørloth replacement Gyökeres',
  'Garnacho-to-Chelsea talks revived',
  'Toney agrees Premier League return',
];

const DAY_MS = 86_400_000;

/** Inserts seed claims whose headlines aren't already present. */
async function insertClaimsIfMissing(batch: SeedClaim[], now: number): Promise<void> {
  const existingHeadlines = new Set(
    (await db.select({ headline: claims.headline }).from(claims)).map((r) => r.headline),
  );
  const fresh = batch.filter((c) => !existingHeadlines.has(c.headline));
  if (fresh.length) {
    await db.insert(claims).values(
      fresh.map((c) => ({
        id: newId(),
        journalistId: c.journalistId,
        headline: c.headline,
        playerName: c.playerName,
        fromClubName: c.fromClubName ?? null,
        toClubName: c.toClubName,
        league: c.league ?? null,
        confidence: c.confidence,
        transferWindow: '2026-summer',
        sourceUrl: c.sourceUrl ?? null,
        claimedAt: now - c.claimedDaysAgo * DAY_MS,
        status: c.resolved ? ('resolved' as const) : ('pending' as const),
        outcome: c.resolved?.outcome ?? null,
        resolvedAt: c.resolved ? now - c.resolved.daysAgo * DAY_MS : null,
        createdAt: now,
      })),
    );
  }
}

/** Replaces the retired fake wire with real, sourced claims. Each batch runs once. */
async function seedRealClaimsIfNeeded(now: number): Promise<void> {
  if (!(await hasFlag(DEMO_CLAIMS_V2_FLAG))) {
    // Purge the v1 invented claims (only from seeded journalists, by exact headline).
    await db
      .delete(claims)
      .where(and(like(claims.journalistId, 'seed-%'), inArray(claims.headline, V1_FAKE_HEADLINES)));
    await insertClaimsIfMissing(SEED_CLAIMS_V2, now);
    await db.insert(appMeta).values({ key: DEMO_CLAIMS_V2_FLAG, value: new Date(now).toISOString() });
  }
  if (!(await hasFlag(DEMO_CLAIMS_V3_FLAG))) {
    await insertClaimsIfMissing(SEED_CLAIMS_V3, now);
    await db.insert(appMeta).values({ key: DEMO_CLAIMS_V3_FLAG, value: new Date(now).toISOString() });
  }
  if (!(await hasFlag(DEMO_CLAIMS_V4_FLAG))) {
    await insertClaimsIfMissing(SEED_CLAIMS_V4, now);
    await db.insert(appMeta).values({ key: DEMO_CLAIMS_V4_FLAG, value: new Date(now).toISOString() });
  }
}

/**
 * True when the app_meta flag row exists. Uses select().limit(1) rather than
 * db.query.findFirst — the sql-js driver returns a truthy husk object for
 * findFirst on an empty table, which silently skipped seeding on web.
 */
async function hasFlag(key: string): Promise<boolean> {
  const rows = await db.select().from(appMeta).where(eq(appMeta.key, key)).limit(1);
  return rows.length > 0;
}

/** Seeds journalists (insert-missing by fixed id) and the real-claims wire. */
export async function seedIfNeeded(): Promise<void> {
  const now = Date.now();
  const existingIds = new Set(
    (await db.select({ id: journalists.id }).from(journalists)).map((r) => r.id),
  );
  const missing = SEED_JOURNALISTS.filter((j) => !existingIds.has(j.id));
  if (missing.length) {
    await db.insert(journalists).values(
      missing.map((j) => ({
        ...j,
        avatarColor: avatarColorFor(j.name),
        isSeeded: true,
        createdAt: now,
      })),
    );
  }
  await backfillHandlesIfNeeded(now);
  await seedRealClaimsIfNeeded(now);
}

/** Databases seeded before the handle column existed get handles by name. */
async function backfillHandlesIfNeeded(now: number): Promise<void> {
  if (await hasFlag(HANDLE_BACKFILL_FLAG)) {
    return;
  }
  for (const seed of SEED_JOURNALISTS) {
    try {
      await db
        .update(journalists)
        .set({ handle: seed.handle })
        .where(and(eq(journalists.name, seed.name), isNull(journalists.handle)));
    } catch {
      // Handle already taken by a user-created journalist — leave theirs.
    }
  }
  await db.insert(appMeta).values({ key: HANDLE_BACKFILL_FLAG, value: new Date(now).toISOString() });
}
