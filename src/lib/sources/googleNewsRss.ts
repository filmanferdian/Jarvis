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
    'pats pulpit',
    'steelers.com',
    'nba.com',
    'one mile at a time',
    'nhl.com',
    'golf channel',
    'defector',
    'racer', // matches "RACER" motorsports
    'tmz', // celebrity gossip, not current events
    'chapelboro', // hyper-local Chapel Hill NC, matches "Chapelboro.com"
    'dawgnation', // Georgia Bulldogs college-football fan site
    // --- added 2026-06-20: sports ---
    'espn',
    'yahoo sports',
    'cbs sports',
    'bleacher report',
    'opta analyst', // sports stats
    // --- added 2026-06-20: entertainment / lifestyle ---
    'variety', // entertainment trade, like Hollywood Reporter / Deadline
    'entertainment weekly',
    'billboard', // music industry
    'page six', // celebrity gossip, like TMZ
    'the cut', // NY Mag fashion/lifestyle
    'instyle.com', // fashion
    // --- added 2026-06-20: gaming ---
    'gamesindustry.biz',
    // --- added 2026-06-20: vendor newsroom / promotional ---
    'apple', // Apple newsroom press releases
    // --- added 2026-06-20: hyper-local US TV affiliates ---
    'abc7 los angeles',
    'abc7 new york',
    'nbc los angeles',
    // --- added 2026-06-20 (weekly review batch 2): gadget-review / rumor blogs ---
    '9to5mac',
    '9to5google',
    'macrumors',
    'gsmarena.com',
    'bgr.com',
    'notebookcheck',
    'wccftech',
    // --- added 2026-06-20 (weekly review batch 2): sports ---
    'sports illustrated',
    'mma fighting',
    'ufc.com',
    'covers.com', // sports betting/odds; domain form avoids matching "discovers"
    // --- added 2026-06-20 (weekly review batch 2): entertainment / lifestyle / fashion ---
    'e! news',
    'wwd', // Women's Wear Daily, fashion trade
    'marthastewart.com',
    'yourtango',
    'time out worldwide',
    'today.com', // morning-show lifestyle; domain form so it never matches "USA Today"
    'eater los angeles',
    'hollywoodreporter.com', // domain variant that slips past the spaced 'hollywood reporter'
    // --- added 2026-06-20 (weekly review batch 2): government / institutional PR ---
    'texas department of public safety',
    // NOTE: 'ign' (gaming) deliberately NOT added — bare substring would match
    // "Foreign Policy" etc. Needs a word-boundary match before it can be blocked.
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
    'detiksport',
    'haloindonesia.co.id',
    'detikhealth',
    'tribunwow.com',
    'radar tulungagung',
    'patrolmedia.co.id',
    'urbanvibes.id',
    'zonautara.com',
    'disway malang',
    'tribratanews polda jabar', // user wrote "Tribatranews"; correct spelling is "Tribratanews"
    'tribatranews polda jabar', // keep the as-written spelling too in case that variant ever appears
    'portal kabupaten banjar',
    'perhutani',
    'celebrity.okezone.com',
    'pontianak post',
    'antara news kalteng',
    'industry.co.id',
    'butota.id',
    'esports id', // matches "Esports ID" outlet
    'niaga.asia',
    'gadgetdiva',
    'indonesiadefense.com',
    'pdiperjuanganbali', // PDI-P Bali political party site, not a news outlet
    'gerbang indonesia', // low-credibility partisan site
    'gerbangindonesia', // no-space domain variant
    'gamereactor', // gaming news, matches "gamereactor.asia"
    // --- added 2026-06-20: detik non-current-events verticals ---
    'detikoto', // automotive
    'detikfood', // food/lifestyle
    'wolipop', // celebrity / women's lifestyle (detik network)
    // --- added 2026-06-20: gaming / gadget-review / UGC ---
    'gamebrott.com', // gaming
    'telset.id', // gadget-review clickbait
    'kompasiana.com', // user-generated blog farm (distinct from kompas.com)
    // --- added 2026-06-20: sports / automotive hobby ---
    'juara.net', // sports
    'otoplus-online', // automotive
    'ridertua.com', // motorcycle hobby
    // --- added 2026-06-20: health / corporate PR ---
    'prohealth.id', // health vertical
    'mayapada hospital', // hospital corporate PR
    'samsung', // vendor newsroom, promotional
    // --- added 2026-06-20: government / institutional PR ---
    'direktorat jenderal pemasyarakatan', // corrections-dept press releases
    'pemerintah provinsi gorontalo', // provincial govt PR
    'infopublik', // govt info portal
    'universitas airlangga', // matches "Universitas Airlangga Official Website"
    'uinjkt.ac.id',
    'umy', // Universitas Muhammadiyah Yogyakarta
    'universitas muhammadiyah surakarta',
    // --- added 2026-06-20: hyper-local / regional ---
    'pontianakpost', // no-space variant of blocked 'pontianak post'
    'sumbawanews',
    'kabar6.com',
    'rakyatpos.id',
    'baubaupost',
    'radar karawang',
    'antara news sulteng', // regional bureau, not the national ANTARA wire
    'gentra news',
    'jurnal borneo',
    'telstar1027fm.com', // local radio
    'tandaseru.id',
    'media alkhairaat',
    'news.schoolmedia.id',
    // --- added 2026-06-20 (weekly review batch 2): lifestyle / entertainment / vertical ---
    'detiktravel', // detik travel/lifestyle vertical
    'wowkeren', // celebrity / entertainment
    'sindonews lifestyle', // lifestyle vertical; full phrase so it never matches sindonews.com / nasional / ekbis
    'the lazy media', // pop-culture / gaming
    // --- added 2026-06-20 (weekly review batch 2): vendor / gadget ---
    'xiaomi-miui', // Xiaomi fan/vendor site (matches id.xiaomi-miui.gr)
    // --- added 2026-06-20 (weekly review batch 2): government / institutional PR ---
    'presiden ri', // Office-of-President press feed
    'bmkg', // weather/quake agency PR
    'badan riset dan inovasi nasional', // BRIN research-agency PR (long phrase, not bare 'brin')
    // --- added 2026-06-20 (weekly review batch 2): religious / community org ---
    'nu online', // Nahdlatul Ulama org outlet
    'suara muhammadiyah', // Muhammadiyah org outlet
    'sh terate madiun', // PSHT martial-arts org / hyper-local
    // --- added 2026-06-20 (weekly review batch 2): hyper-local / regional ---
    'batamnews',
    'sumeks', // Palembang (Sumatera Ekspres)
    'bantendaily',
    'kilasjatim.com', // East Java
    'radar bontang',
    'mnc trijaya kendari', // local radio
    'beritajatim.com', // East Java
    // --- added 2026-06-20 (weekly review batch 2): low-credibility / niche portals ---
    'carapandang',
    'langitselatan', // astronomy hobby blog
    'artik.id',
    'tebaran.com',
    'atnews.id',
    'merahputih.com', // lifestyle/general portal
    'realestat.id', // property vertical
    'ajaib', // investing-app content marketing
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
