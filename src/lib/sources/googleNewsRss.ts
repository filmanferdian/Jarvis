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

  const items: NewsItem[] = rawItems.slice(0, maxItems).map((it) => {
    const title = decodeEntities(
      stripOutletSuffix((it.match(/<title>([\s\S]*?)<\/title>/) || ['', ''])[1] || ''),
    );
    const pubDate = (it.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || ['', ''])[1] || '';
    const source = decodeEntities(
      (it.match(/<source[^>]*>([\s\S]*?)<\/source>/) || ['', ''])[1] || '',
    );
    const desc = (it.match(/<description>([\s\S]*?)<\/description>/) || ['', ''])[1] || '';
    // Google News wraps related outlets in <font color="#6f6f6f">Outlet</font>
    const outlets = [
      ...desc.matchAll(/<font color="#6f6f6f">([^<]+)<\/font>/g),
    ].map((m) => decodeEntities(m[1]));
    // And related headlines in <a ... target="_blank">Title</a>
    const titles = [...desc.matchAll(/target="_blank">([^<]+)<\/a>/g)].map((m) =>
      decodeEntities(m[1]),
    );
    const relatedOutlets = [...new Set(outlets)];
    const relatedTitles = titles.slice(1); // first anchor duplicates the main title
    return {
      title,
      source,
      pubDate,
      relatedOutlets,
      relatedTitles,
      outletScore: 1 + relatedOutlets.filter((o) => o !== source).length,
    };
  });

  items.sort((a, b) => {
    if (b.outletScore !== a.outletScore) return b.outletScore - a.outletScore;
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
  });

  return items;
}
