// Google News RSS fetcher + pre-ranker.
// Returns items sorted by outletScore (how many outlets cover the same story)
// so downstream synthesis can prioritise multi-source corroboration.

export type NewsLocale = 'ID' | 'WORLD';

export interface NewsItem {
  title: string;
  source: string;
  pubDate: string;
  relatedOutlets: string[];
  relatedTitles: string[];
  outletScore: number;
}

const FEED_URLS: Record<NewsLocale, string> = {
  ID: 'https://news.google.com/rss?hl=id&gl=ID&ceid=ID:id',
  WORLD: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
};

// Outlets to drop entirely from synthesis. Matched case-insensitively and as
// substring against the normalised outlet name, so small spelling variants
// ("NBC Sport" vs "NBC Sports", "Bolasport" vs "Bolasports") still catch.
// If an item's primary source matches, the item is dropped. If a related outlet
// matches, it is scrubbed from `relatedOutlets` and does not count toward the
// outletScore.
const BLOCKED_OUTLETS: Record<NewsLocale, string[]> = {
  WORLD: [
    'fox sports',
    'cleveland browns',
    'bleeding green nation',
    'nbc sport', // matches "NBC Sport" and "NBC Sports"
    'phys.org',
    'pff', // Pro Football Focus
    'pro football reference',
    'hollywood reporter', // matches "The Hollywood Reporter"
    'raiders.com',
    'minnesota vikings',
    'deadline',
  ],
  ID: [
    'lentera.co', // user wrote "Lenterea.co"; actual outlet name is "Lentera.co"
    'lenterea.co', // keep the as-written spelling too in case that variant ever appears
    'qoo media',
    'monitorday',
    'detikhot',
    'bolasport', // matches "Bolasport.com" and "Bolasports.com"
    'asatunews.co.id',
    'haibunda',
    'fajar',
    'gizmologi.id',
    'mongabay.co.id',
    'goal.com',
  ],
};

function normalizeOutlet(s: string): string {
  return (s || '').toLowerCase().trim();
}

function isBlockedOutlet(outlet: string, locale: NewsLocale): boolean {
  const n = normalizeOutlet(outlet);
  if (!n) return false;
  return BLOCKED_OUTLETS[locale].some((b) => n === b || n.includes(b));
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripOutletSuffix(title: string): string {
  // "Headline - Outlet Name" → "Headline"
  return title.replace(/\s+-\s+[^-]+$/, '').trim();
}

export async function fetchGoogleNewsRss(
  locale: NewsLocale,
  maxItems = 40,
): Promise<NewsItem[]> {
  const res = await fetch(FEED_URLS[locale], {
    headers: { 'User-Agent': 'Mozilla/5.0 (Jarvis Newsreader)' },
  });
  if (!res.ok) throw new Error(`Google News RSS ${locale}: ${res.status}`);
  const xml = await res.text();

  const rawItems = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);

  // Parse first, then filter blocked primaries, then scrub blocked related outlets.
  // We parse more than maxItems to keep a healthy pool after dropping blocked primaries.
  const parsed: NewsItem[] = rawItems.map((it) => {
    const title = decodeEntities(
      stripOutletSuffix((it.match(/<title>([\s\S]*?)<\/title>/) || ['', ''])[1] || ''),
    );
    const pubDate = (it.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || ['', ''])[1] || '';
    const source = decodeEntities(
      (it.match(/<source[^>]*>([\s\S]*?)<\/source>/) || ['', ''])[1] || '',
    );
    const desc = (it.match(/<description>([\s\S]*?)<\/description>/) || ['', ''])[1] || '';
    const outlets = [
      ...desc.matchAll(/<font color="#6f6f6f">([^<]+)<\/font>/g),
    ].map((m) => decodeEntities(m[1]));
    const titles = [...desc.matchAll(/target="_blank">([^<]+)<\/a>/g)].map((m) =>
      decodeEntities(m[1]),
    );
    const relatedOutlets = [...new Set(outlets)];
    const relatedTitles = titles.slice(1);
    return {
      title,
      source,
      pubDate,
      relatedOutlets,
      relatedTitles,
      outletScore: 1 + relatedOutlets.filter((o) => o !== source).length,
    };
  });

  const filtered = parsed
    // Drop items whose primary outlet is blocked.
    .filter((it) => !isBlockedOutlet(it.source, locale))
    // Scrub blocked outlets out of the related-outlets list and recompute outletScore.
    .map((it) => {
      const cleanedRelated = it.relatedOutlets.filter((o) => !isBlockedOutlet(o, locale));
      return {
        ...it,
        relatedOutlets: cleanedRelated,
        outletScore: 1 + cleanedRelated.filter((o) => o !== it.source).length,
      };
    })
    .slice(0, maxItems);

  filtered.sort((a, b) => {
    if (b.outletScore !== a.outletScore) return b.outletScore - a.outletScore;
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
  });

  return filtered;
}
