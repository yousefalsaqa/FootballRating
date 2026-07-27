import journalists from '../../src/db/seed-journalists.json';

/**
 * Ingest worker: polls Google News for each tracked journalist, has Claude
 * Haiku extract structured transfer claims from the fresh headlines, and
 * serves them as JSON for the app's Incoming inbox.
 *
 * Storage (KV):
 *   seen:<link-hash>   — article already processed (TTL 7d)
 *   draft:<claim-key>  — extracted claim draft (TTL 72h)
 */

interface Env {
  INGEST_KV: KVNamespace;
  /** Free-tier Workers AI binding — the default extractor. */
  AI: { run(model: string, options: Record<string, unknown>): Promise<{ response?: string }> };
  /** Optional: switches extraction to Claude Haiku when set. */
  ANTHROPIC_API_KEY?: string;
}

interface FeedItem {
  journalistId: string;
  journalistName: string;
  title: string;
  link: string;
  pubDate: number;
}

export interface ClaimDraft {
  id: string;
  journalistId: string;
  headline: string;
  playerName: string;
  fromClubName: string | null;
  toClubName: string;
  league: string | null;
  confidence: 1 | 2 | 3;
  sourceUrl: string;
  reportedAt: number;
  /** Reader submission the bot couldn't fully vouch for — editor approves. */
  needsReview?: boolean;
  /** Set on reader submissions (with journalistName as a display fallback). */
  submitted?: boolean;
  journalistName?: string;
}

const MAX_ITEMS_PER_RUN = 8;
const MAX_PARSED_BLOCKS = 120;
const MAX_ARTICLE_AGE_MS = 48 * 60 * 60 * 1000;
const DRAFT_TTL_SECONDS = 72 * 60 * 60;
const SEEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'content-type': 'application/json',
};

/** Minimal RSS <item> parser — Workers have no DOMParser. */
function parseRssItems(xml: string): { title: string; link: string; pubDate: number }[] {
  const items: { title: string; link: string; pubDate: number }[] = [];
  // Cap parsing work — free-tier Workers have a tight CPU budget.
  const itemBlocks = (xml.match(/<item>[\s\S]*?<\/item>/g) ?? []).slice(0, MAX_PARSED_BLOCKS);
  for (const block of itemBlocks) {
    const title = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim();
    const pubDateRaw = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();
    const pubDate = pubDateRaw ? Date.parse(pubDateRaw) : NaN;
    if (title && link && !Number.isNaN(pubDate)) {
      items.push({
        title: decodeXmlEntities(title),
        link: unwrapBingLink(decodeXmlEntities(link)),
        pubDate,
      });
    }
  }
  return items;
}

/** Bing wraps article links in a redirect — unwrap to the real URL. */
function unwrapBingLink(link: string): string {
  // Bing sometimes double-encodes the query ampersands; an undecoded `&amp;`
  // turns the param key into "amp;url" and the unwrap silently fails.
  let candidate = link;
  while (candidate.includes('&amp;')) {
    candidate = candidate.replace(/&amp;/g, '&');
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.hostname.endsWith('bing.com')) {
      const real = parsed.searchParams.get('url');
      if (real) {
        return decodeURIComponent(real);
      }
    }
  } catch {
    // fall through with the original link
  }
  return candidate;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (whole, hex: string) => {
      const code = parseInt(hex, 16);
      return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    })
    .replace(/&#(\d+);/g, (whole, dec: string) => {
      const code = Number(dec);
      return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function sha1(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Bing News RSS — Google News 503s requests from Cloudflare's network. */
function feedUrlFor(name: string): string {
  return `https://www.bing.com/news/search?q=${encodeURIComponent(`"${name}" transfer`)}&format=rss`;
}

const FEED_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  accept: 'application/rss+xml, application/xml, text/xml',
};

/**
 * Collects fresh, unseen feed items for ONE journalist per run, rotating
 * through the roster via a KV cursor — the free tier's CPU budget cannot
 * sweep all fifteen feeds in a single invocation.
 */
async function collectFreshItems(env: Env, now: number): Promise<FeedItem[]> {
  const cursor = Number((await env.INGEST_KV.get('cursor')) ?? '0') % journalists.length;
  const journalist = journalists[cursor];
  await env.INGEST_KV.put('cursor', String(cursor + 1));
  if (!journalist) {
    return [];
  }
  const fresh: FeedItem[] = [];
  try {
    const response = await fetch(feedUrlFor(journalist.name), { headers: FEED_HEADERS });
    if (!response.ok) {
      console.error(`Feed ${response.status} for ${journalist.name}`);
      return [];
    }
    const xml = await response.text();
    for (const item of parseRssItems(xml)) {
      if (fresh.length >= MAX_ITEMS_PER_RUN || now - item.pubDate > MAX_ARTICLE_AGE_MS) {
        continue;
      }
      const seenKey = `seen:${await sha1(item.link)}`;
      if (await env.INGEST_KV.get(seenKey)) {
        continue;
      }
      await env.INGEST_KV.put(seenKey, '1', { expirationTtl: SEEN_TTL_SECONDS });
      fresh.push({
        journalistId: journalist.id,
        journalistName: journalist.name,
        ...item,
      });
    }
  } catch (error) {
    console.error(`Feed failed for ${journalist.name}`, error);
  }
  return fresh;
}

const EXTRACTION_PROMPT = `You extract football transfer claims from news headlines for a journalist-reliability tracker.

Input: a JSON array of {index, journalist, title} where title is a news headline mentioning that journalist.

For each item decide whether the HEADLINE reports a specific, attributable transfer claim MADE BY THAT JOURNALIST (a transfer/contract report they broke — not opinion pieces, rankings, quizzes, aggregator roundups, or claims attributed to someone else).

Reply with ONLY a JSON array (no prose). For each item that IS a claim, include:
{
  "index": number,
  "headline": string,        // concise claim restatement, max 90 chars
  "playerName": string,      // the player's ACTUAL NAME — if the headline only describes the player ("ex-Arsenal forward", "Brighton star"), OMIT the item entirely
  "fromClubName": string|null,
  "toClubName": string,      // for contract renewals/stays, the current club
  "league": string|null,     // league of the destination club
  "confidence": 1|2|3        // 1 speculative/interest, 2 advanced/agreed-terms, 3 confirmed/"here we go"/done
}
Omit items that are not claims. If unsure, omit.`;

/**
 * Descriptive phrases are not player identities — "ex-Arsenal and Man Utd
 * forward" filed as a player pollutes the record and duplicates the properly
 * named claim once it emerges.
 */
function isDescriptivePlayerName(name: string): boolean {
  return (
    /\b(forward|striker|winger|midfielder|defender|keeper|goalkeeper|full-?back|wing-?back|player|star|target|wonderkid|starlet|international|captain)\b/i.test(
      name,
    ) || /^ex[- ]/i.test(name.trim())
  );
}

/** Runs a prompt on Claude (if a key is set) or free Workers AI. */
async function runModelWith(env: Env, systemPrompt: string, userContent: string): Promise<string> {
  if (env.ANTHROPIC_API_KEY) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    if (!response.ok) {
      throw new Error(`Claude API error ${response.status}: ${await response.text()}`);
    }
    const body = (await response.json()) as { content: { type: string; text?: string }[] };
    return body.content.find((c) => c.type === 'text')?.text ?? '[]';
  }
  const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    max_tokens: 2000,
  });
  // Some models return the payload as an already-parsed object.
  return typeof result.response === 'string' ? result.response : JSON.stringify(result.response ?? []);
}

/** Asks the model to turn raw headlines into structured claim drafts. */
async function extractClaims(env: Env, items: FeedItem[]): Promise<ClaimDraft[]> {
  if (!items.length) {
    return [];
  }
  const payload = items.map((item, index) => ({
    index,
    journalist: item.journalistName,
    title: item.title,
  }));
  let text: string;
  try {
    text = await runModelWith(env, EXTRACTION_PROMPT, JSON.stringify(payload));
  } catch (error) {
    console.error('Extraction model failed', error);
    return [];
  }
  // Models sometimes wrap JSON in prose/fences — grab the array.
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  text = arrayMatch ? arrayMatch[0] : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^```json?\s*|\s*```$/g, ''));
  } catch {
    console.error('Unparseable extraction output', text.slice(0, 300));
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const drafts: ClaimDraft[] = [];
  for (const entry of parsed as Record<string, unknown>[]) {
    const index = Number(entry.index);
    const source = items[index];
    if (
      !source ||
      typeof entry.headline !== 'string' ||
      typeof entry.playerName !== 'string' ||
      typeof entry.toClubName !== 'string' ||
      ![1, 2, 3].includes(Number(entry.confidence)) ||
      isDescriptivePlayerName(entry.playerName)
    ) {
      continue;
    }
    drafts.push({
      id: `${source.journalistId}:${slugify(`${entry.playerName}-${entry.toClubName}`)}`,
      journalistId: source.journalistId,
      headline: entry.headline.slice(0, 120),
      playerName: entry.playerName,
      fromClubName: typeof entry.fromClubName === 'string' ? entry.fromClubName : null,
      toClubName: entry.toClubName,
      league: typeof entry.league === 'string' ? entry.league : null,
      confidence: Number(entry.confidence) as 1 | 2 | 3,
      sourceUrl: source.link,
      reportedAt: source.pubDate,
    });
  }
  return drafts;
}

interface ResolveRequestClaim {
  id: string;
  headline: string;
  playerName: string;
  toClubName: string;
  fromClubName?: string | null;
  claimedAt?: number;
}

const RESOLUTION_PROMPT = `You judge the outcomes of football transfer claims for a reliability tracker.

Input: a JSON array of claims, each with {id, claim, reportedDaysAgo, evidence} where evidence is news headlines about that player, each with daysAgo (its age). RECENT evidence outweighs old evidence — judge from the newest reliable items; an old rumour contradicted by newer coverage is decided by the newer coverage.

For each claim decide the outcome from the balance of the evidence (evidence items are numbered):
- "true": the evidence indicates the reported move/agreement happened — official announcement, "here we go", unveiled, medical, "signs"/"joins"/"completes", or coverage now treats the player as being at the claimed club.
- "false": the evidence indicates it did not happen — the deal collapsed or was called off, the player joined a DIFFERENT club instead, or the story is weeks old and coverage clearly moved on to other destinations with no sign of the claimed move.
- "partial": the essentials happened but materially different (loan instead of permanent, different terms, delayed to a later window).
- "unknown": no meaningful evidence either way, or the story is clearly still live and developing right now.

READ THE CLAIM CAREFULLY — some claims are NEGATIVE or hedged ("move unlikely", "not finalized", "staying", "rejected", "no talks"). A negative claim is "true" when the move indeed did NOT materialise (the player went elsewhere or stayed), and "false" when the move DID happen. Judge what the journalist actually asserted, not whether a transfer occurred.

Prefer a definitive verdict when the evidence leans one way — this tracker depends on claims actually getting graded. Reserve "unknown" for genuinely open, still-developing stories or empty evidence.

Reply with ONLY a JSON array:
[{"id": string, "outcome": "true"|"partial"|"false"|"unknown", "reason": string, "evidenceIndex": number|null}]
where "reason" is ONE plain-language sentence explaining the verdict (empty string for unknown) and "evidenceIndex" is the number of the single evidence item that best supports it (null if none).`;

const MAX_RESOLVE_CLAIMS = 5;
const RESOLVE_EVIDENCE_TITLES = 18;

/** Gathers headline evidence and asks the model to rule on pending claims. */
interface ResolveVerdict {
  id: string;
  outcome: string;
  reason: string | null;
  evidenceTitle: string | null;
  evidenceUrl: string | null;
}

async function resolveClaims(env: Env, requested: ResolveRequestClaim[]): Promise<ResolveVerdict[]> {
  const batch = requested.slice(0, MAX_RESOLVE_CLAIMS);
  const now = Date.now();
  const evidenceByClaim = new Map<string, { title: string; link: string; pubDate: number }[]>();
  const payload: {
    id: string;
    claim: string;
    reportedDaysAgo: number | null;
    evidence: { index: number; title: string; daysAgo: number }[];
  }[] = [];
  for (const claim of batch) {
    // Two angles: the claimed destination, and the player alone — the latter
    // surfaces where they ACTUALLY ended up, which is what "false" needs.
    const queries = [`"${claim.playerName}" ${claim.toClubName}`, `"${claim.playerName}" transfer`];
    const evidence: { title: string; link: string; pubDate: number }[] = [];
    for (const query of queries) {
      try {
        const response = await fetch(
          `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`,
          { headers: FEED_HEADERS },
        );
        if (response.ok) {
          const xml = await response.text();
          for (const item of parseRssItems(xml)) {
            if (!evidence.some((e) => e.title === item.title)) {
              evidence.push({ title: item.title, link: item.link, pubDate: item.pubDate });
            }
          }
        }
      } catch (error) {
        console.error(`Evidence fetch failed for ${claim.playerName}`, error);
      }
    }
    // Newest first, so the cap keeps the freshest coverage.
    const capped = evidence.sort((a, b) => b.pubDate - a.pubDate).slice(0, RESOLVE_EVIDENCE_TITLES);
    evidenceByClaim.set(claim.id, capped);
    payload.push({
      id: claim.id,
      claim: claim.headline,
      reportedDaysAgo: claim.claimedAt ? Math.round((now - claim.claimedAt) / 86_400_000) : null,
      evidence: capped.map((e, index) => ({
        index,
        title: e.title,
        daysAgo: Math.max(0, Math.round((now - e.pubDate) / 86_400_000)),
      })),
    });
  }
  let text: string;
  try {
    text = await runModelWith(env, RESOLUTION_PROMPT, JSON.stringify(payload));
  } catch (error) {
    console.error('Resolution model failed', error);
    return [];
  }
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  try {
    const parsed = JSON.parse(arrayMatch ? arrayMatch[0] : text) as {
      id?: string;
      outcome?: string;
      reason?: string;
      evidenceIndex?: number | null;
    }[];
    return parsed
      .filter((v) => typeof v.id === 'string' && ['true', 'partial', 'false', 'unknown'].includes(v.outcome ?? ''))
      .map((v) => {
        const cited = typeof v.evidenceIndex === 'number'
          ? evidenceByClaim.get(v.id as string)?.[v.evidenceIndex]
          : undefined;
        return {
          id: v.id as string,
          outcome: v.outcome as string,
          reason: typeof v.reason === 'string' && v.reason.trim() ? v.reason.trim().slice(0, 300) : null,
          evidenceTitle: cited?.title ?? null,
          evidenceUrl: cited?.link ?? null,
        };
      });
  } catch {
    console.error('Unparseable resolution output', text.slice(0, 200));
    return [];
  }
}

const AUTHOR_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

interface PostLookup {
  username: string | null;
  name: string | null;
  postedAt: number | null;
  /** Structured claim extracted from the post caption, when it reports one. */
  claim: Omit<ClaimDraft, 'id' | 'journalistId'> | null;
}

const EMPTY_LOOKUP: PostLookup = { username: null, name: null, postedAt: null, claim: null };

/**
 * Reads a pasted Instagram post/reel link — post URLs don't name their
 * author, so the app can't match them to a journalist on its own. The
 * crawler-facing og: meta tags carry author, date AND caption; the caption is
 * run through the same claim extractor as the news wire so a "here we go"
 * post comes back as a fileable claim.
 */
async function lookupInstagramPost(env: Env, postUrl: string): Promise<PostLookup> {
  const match = postUrl.match(/instagram\.com\/(?:[^/?#]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  if (!match) {
    return EMPTY_LOOKUP;
  }
  const shortcode = match[1];
  const cacheKey = `author2:${shortcode}`;
  const cached = await env.INGEST_KV.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as PostLookup;
  }
  let username: string | null = null;
  let name: string | null = null;
  let caption: string | null = null;
  let postedAt: number | null = null;
  try {
    const response = await fetch(`https://www.instagram.com/p/${shortcode}/`, {
      headers: { 'user-agent': 'facebookexternalhit/1.1' },
    });
    if (response.ok) {
      const html = await response.text();
      // og:description: '3M likes, 33K comments - fabriziorom on July 26, 2026: "caption…"'
      // Captions often use ᴜɴɪᴄᴏᴅᴇ display letters — NFKC folds them to ASCII.
      const description = decodeXmlEntities(
        html.match(/property="og:description" content="([^"]*)"/)?.[1] ?? '',
      ).normalize('NFKC');
      username = description.match(/ - ([A-Za-z0-9_.]+) on [A-Z]/)?.[1] ?? null;
      const dateRaw = description.match(/ on ([A-Z][a-z]+ \d{1,2}, \d{4})/)?.[1];
      postedAt = dateRaw ? Date.parse(dateRaw) || null : null;
      caption = description.match(/\d{4}: "([\s\S]+)/)?.[1]?.replace(/"$/, '').trim() ?? null;
      const title = html.match(/property="og:title" content="([^"]+?) on Instagram/)?.[1];
      name = title ? decodeXmlEntities(title).normalize('NFKC') : null;
    }
  } catch (error) {
    console.error('IG page fetch failed', error);
  }
  if (!username) {
    // The public embed page names the author even when og: tags are withheld.
    try {
      const response = await fetch(`https://www.instagram.com/p/${shortcode}/embed/`, {
        headers: FEED_HEADERS,
      });
      if (response.ok) {
        const html = await response.text();
        username =
          html.match(/class="UsernameText"[^>]*>([A-Za-z0-9_.]+)</)?.[1] ??
          html.match(/"username"\s*:\s*"([A-Za-z0-9_.]+)"/)?.[1] ??
          null;
      }
    } catch (error) {
      console.error('IG embed fetch failed', error);
    }
  }
  let claim: PostLookup['claim'] = null;
  if (caption && (name ?? username)) {
    const drafts = await extractClaims(env, [
      {
        journalistId: 'post-lookup',
        journalistName: name ?? (username as string),
        title: caption.slice(0, 400),
        link: postUrl,
        pubDate: postedAt ?? Date.now(),
      },
    ]);
    if (drafts[0]) {
      const { id: _id, journalistId: _journalistId, ...rest } = drafts[0];
      claim = rest;
    }
  }
  const result: PostLookup = { username: username?.toLowerCase() ?? null, name, postedAt, claim };
  if (result.username || result.name) {
    await env.INGEST_KV.put(cacheKey, JSON.stringify(result), {
      expirationTtl: AUTHOR_CACHE_TTL_SECONDS,
    });
  }
  return result;
}

async function runIngest(env: Env): Promise<void> {
  const now = Date.now();
  const items = await collectFreshItems(env, now);
  const drafts = await extractClaims(env, items);
  for (const draft of drafts) {
    // Keyed by journalist+player+destination: repeat coverage overwrites, not duplicates.
    await env.INGEST_KV.put(`draft:${draft.id}`, JSON.stringify(draft), {
      expirationTtl: DRAFT_TTL_SECONDS,
    });
  }
  console.log(`Ingest run: ${items.length} fresh items → ${drafts.length} drafts`);
}

async function listDrafts(env: Env): Promise<ClaimDraft[]> {
  const list = await env.INGEST_KV.list({ prefix: 'draft:' });
  const drafts: ClaimDraft[] = [];
  for (const key of list.keys) {
    const value = await env.INGEST_KV.get(key.name);
    if (value) {
      drafts.push(JSON.parse(value) as ClaimDraft);
    }
  }
  return drafts.sort((a, b) => b.reportedAt - a.reportedAt);
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runIngest(env));
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: { ...CORS_HEADERS, 'Access-Control-Allow-Headers': 'content-type, x-ledger-key' },
      });
    }
    // Shared ledger: THE record. Reading is public (the site is a newspaper);
    // writing requires the editor passcode — the first passcode to write
    // claims the ledger, and every later write must match it. A GET that
    // includes a key validates it (the app's staff sign-in check).
    if (url.pathname === '/ledger') {
      const key = request.headers.get('x-ledger-key')?.trim() ?? '';
      const keyHash = key ? await sha1(`ledger-key:${key}`) : null;
      const claimedHash = await env.INGEST_KV.get('ledger:keyhash');
      if (keyHash && claimedHash && claimedHash !== keyHash) {
        return new Response(JSON.stringify({ error: 'wrong key' }), {
          status: 403,
          headers: CORS_HEADERS,
        });
      }
      if (request.method === 'GET') {
        const data = claimedHash ? await env.INGEST_KV.get('ledger:data') : null;
        return new Response(JSON.stringify({ snapshot: data ? JSON.parse(data) : null }), {
          headers: CORS_HEADERS,
        });
      }
      if (request.method === 'PUT') {
        if (!keyHash) {
          return new Response(JSON.stringify({ error: 'missing key' }), {
            status: 401,
            headers: CORS_HEADERS,
          });
        }
        const body = await request.text();
        if (body.length > 4 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: 'too large' }), {
            status: 413,
            headers: CORS_HEADERS,
          });
        }
        try {
          JSON.parse(body);
        } catch {
          return new Response(JSON.stringify({ error: 'not json' }), {
            status: 400,
            headers: CORS_HEADERS,
          });
        }
        if (!claimedHash) {
          await env.INGEST_KV.put('ledger:keyhash', keyHash);
        }
        await env.INGEST_KV.put('ledger:data', body);
        return new Response(JSON.stringify({ ok: true }), { headers: CORS_HEADERS });
      }
    }
    // Outcome check for pending claims (max 5 per call).
    if (url.pathname === '/resolve' && request.method === 'POST') {
      let body: { claims?: ResolveRequestClaim[] };
      try {
        body = (await request.json()) as { claims?: ResolveRequestClaim[] };
      } catch {
        return new Response(JSON.stringify({ verdicts: [] }), { headers: CORS_HEADERS });
      }
      const verdicts = await resolveClaims(env, body.claims ?? []);
      return new Response(JSON.stringify({ verdicts }), { headers: CORS_HEADERS });
    }
    // Author + claim lookup for pasted Instagram post links.
    if (url.pathname === '/author') {
      const postUrl = url.searchParams.get('url') ?? '';
      const lookup = await lookupInstagramPost(env, postUrl);
      return new Response(JSON.stringify(lookup), { headers: CORS_HEADERS });
    }
    // Reader-submitted report: the bot (extraction model) vets it. Clean
    // submissions flow onto the wire like any other draft; ones the bot
    // can't vouch for are flagged for the editor's approval.
    if (url.pathname === '/submit' && request.method === 'POST') {
      let body: Record<string, unknown>;
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        return new Response(JSON.stringify({ error: 'not json' }), { status: 400, headers: CORS_HEADERS });
      }
      const str = (v: unknown, max = 120): string =>
        typeof v === 'string' ? v.trim().slice(0, max) : '';
      const journalistName = str(body.journalistName);
      const playerName = str(body.playerName);
      const toClubName = str(body.toClubName);
      if (!journalistName || !playerName || !toClubName) {
        return new Response(JSON.stringify({ error: 'journalistName, playerName and toClubName are required' }), {
          status: 400,
          headers: CORS_HEADERS,
        });
      }
      const fromClubName = str(body.fromClubName) || null;
      const sourceUrl = str(body.sourceUrl, 500);
      const roster = journalists.find((j) => j.name.toLowerCase() === journalistName.toLowerCase());
      const headline =
        str(body.headline) ||
        `${playerName}${fromClubName ? ` from ${fromClubName}` : ''} to ${toClubName}`;
      const extracted = (
        await extractClaims(env, [
          {
            journalistId: roster?.id ?? '',
            journalistName,
            title: `${journalistName}: ${headline}`,
            link: sourceUrl,
            pubDate: Date.now(),
          },
        ])
      )[0];
      const vetted = Boolean(extracted && roster);
      const draft: ClaimDraft = {
        ...(extracted ?? {
          id: `${roster?.id ?? slugify(journalistName)}:${slugify(`${playerName}-${toClubName}`)}`,
          journalistId: roster?.id ?? '',
          headline: headline.slice(0, 120),
          playerName,
          fromClubName,
          toClubName,
          league: str(body.league) || null,
          confidence: 1 as const,
          sourceUrl,
          reportedAt: Date.now(),
        }),
        journalistId: roster?.id ?? '',
        needsReview: !vetted,
        submitted: true,
        journalistName,
      };
      await env.INGEST_KV.put(`draft:${draft.id}`, JSON.stringify(draft), {
        expirationTtl: DRAFT_TTL_SECONDS,
      });
      return new Response(JSON.stringify({ accepted: true, needsReview: draft.needsReview }), {
        headers: CORS_HEADERS,
      });
    }
    if (url.pathname === '/claims') {
      return new Response(JSON.stringify({ claims: await listDrafts(env) }), {
        headers: CORS_HEADERS,
      });
    }
    // Manual trigger: fire-and-forget (a full cycle outlives request timeouts).
    if (url.pathname === '/run') {
      ctx.waitUntil(runIngest(env));
      return new Response(JSON.stringify({ started: true }), { headers: CORS_HEADERS });
    }
    // Diagnostics: fetch one feed and run a trivial AI prompt, report results.
    if (url.pathname === '/debug') {
      const debug: Record<string, unknown> = {};
      try {
        const first = journalists[0];
        const response = await fetch(feedUrlFor(first?.name ?? 'football'), { headers: FEED_HEADERS });
        debug.feedStatus = response.status;
        const xml = await response.text();
        const items = parseRssItems(xml);
        debug.itemsParsed = items.length;
        debug.firstTitles = items.slice(0, 3).map((i) => i.title);
      } catch (error) {
        debug.feedError = String(error);
      }
      try {
        const ai = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
          max_tokens: 10,
        });
        debug.aiResponse = ai.response;
      } catch (error) {
        debug.aiError = String(error);
      }
      const drafts = await env.INGEST_KV.list({ prefix: 'draft:' });
      const seen = await env.INGEST_KV.list({ prefix: 'seen:' });
      debug.draftCount = drafts.keys.length;
      debug.seenCount = seen.keys.length;
      return new Response(JSON.stringify(debug, null, 2), { headers: CORS_HEADERS });
    }
    return new Response('journalist-rater-ingest', { headers: { 'content-type': 'text/plain' } });
  },
};
