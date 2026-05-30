// Investment watchlist universe and grouping.
//
// Source of truth for the table on /investments: exchange -> industry -> company.
// Live prices come from Yahoo (joined by yahoo symbol); valuation memos come live
// from Notion (joined by ticker).

export interface WatchlistCompany {
  ticker: string;
  name: string;
  // Yahoo Finance symbol when it differs from `ticker`. Omit to derive from exchange.
  yahoo?: string;
}

export interface WatchlistIndustry {
  industry: string;
  companies: WatchlistCompany[];
}

export interface WatchlistExchange {
  exchange: string;
  label: string;
  industries: WatchlistIndustry[];
}

export const WATCHLIST: WatchlistExchange[] = [
  {
    exchange: 'IDX',
    label: 'Indonesia (IDX)',
    industries: [
      {
        industry: 'Banks',
        companies: [
          { ticker: 'BBCA', name: 'Bank Central Asia' },
          { ticker: 'BBRI', name: 'Bank Rakyat Indonesia' },
          { ticker: 'BMRI', name: 'Bank Mandiri' },
          { ticker: 'BBNI', name: 'Bank Negara Indonesia' },
          { ticker: 'BBTN', name: 'Bank Tabungan Negara' },
        ],
      },
      {
        industry: 'Digital banks',
        companies: [
          { ticker: 'ARTO', name: 'Bank Jago' },
          { ticker: 'BBYB', name: 'Bank Neo Commerce' },
          { ticker: 'SUPA', name: 'Super Bank Indonesia' },
        ],
      },
      {
        industry: 'Telecom',
        companies: [{ ticker: 'TLKM', name: 'Telkom Indonesia' }],
      },
      {
        industry: 'Super-app & fintech',
        companies: [{ ticker: 'GOTO', name: 'GoTo Gojek Tokopedia' }],
      },
      {
        industry: 'Media & entertainment',
        companies: [
          { ticker: 'EMTK', name: 'Elang Mahkota Teknologi' },
          { ticker: 'SCMA', name: 'Surya Citra Media' },
          { ticker: 'MNCN', name: 'Media Nusantara Citra' },
        ],
      },
      {
        industry: 'Transport & infrastructure',
        companies: [
          { ticker: 'BIRD', name: 'Blue Bird' },
          { ticker: 'ASSA', name: 'Adi Sarana Armada' },
          { ticker: 'JSMR', name: 'Jasa Marga' },
        ],
      },
    ],
  },
  {
    exchange: 'US',
    label: 'United States',
    industries: [
      {
        industry: 'Digital banking & lending',
        companies: [
          { ticker: 'NU', name: 'Nu Holdings' },
          { ticker: 'SOFI', name: 'SoFi Technologies' },
          { ticker: 'AFRM', name: 'Affirm' },
          { ticker: 'UPST', name: 'Upstart' },
        ],
      },
      {
        industry: 'SEA super-apps',
        companies: [
          { ticker: 'GRAB', name: 'Grab Holdings' },
          { ticker: 'SE', name: 'Sea Limited' },
        ],
      },
      {
        industry: 'Semiconductors',
        companies: [
          { ticker: 'NVDA', name: 'Nvidia' },
          { ticker: 'AVGO', name: 'Broadcom' },
          { ticker: 'TSM', name: 'TSMC' },
        ],
      },
      {
        industry: 'Platforms & big tech',
        companies: [
          { ticker: 'MSFT', name: 'Microsoft' },
          { ticker: 'GOOGL', name: 'Alphabet' },
          { ticker: 'META', name: 'Meta Platforms' },
          { ticker: 'AMZN', name: 'Amazon' },
          { ticker: 'AAPL', name: 'Apple' },
        ],
      },
      {
        industry: 'Software & dev infra',
        companies: [
          { ticker: 'NET', name: 'Cloudflare' },
          { ticker: 'DDOG', name: 'Datadog' },
          { ticker: 'GTLB', name: 'GitLab' },
        ],
      },
      {
        industry: 'Streaming & entertainment',
        companies: [
          { ticker: 'NFLX', name: 'Netflix' },
          { ticker: 'DIS', name: 'Walt Disney' },
          { ticker: 'SPOT', name: 'Spotify' },
          { ticker: 'WBD', name: 'Warner Bros. Discovery' },
        ],
      },
      {
        industry: 'Sports apparel & wearables',
        companies: [
          { ticker: 'NKE', name: 'Nike' },
          { ticker: 'ADDYY', name: 'Adidas' },
          { ticker: 'UAA', name: 'Under Armour' },
          { ticker: 'LULU', name: 'Lululemon' },
          { ticker: 'ONON', name: 'On Holding' },
          { ticker: 'DECK', name: 'Deckers' },
          { ticker: 'GRMN', name: 'Garmin' },
        ],
      },
    ],
  },
  {
    exchange: 'SGX',
    label: 'Singapore (SGX)',
    industries: [
      {
        industry: 'Banks',
        companies: [
          { ticker: 'DBS', name: 'DBS Group', yahoo: 'D05.SI' },
          { ticker: 'OCBC', name: 'OCBC', yahoo: 'O39.SI' },
          { ticker: 'UOB', name: 'United Overseas Bank', yahoo: 'U11.SI' },
        ],
      },
    ],
  },
];

export function companyName(ticker: string): string | null {
  for (const ex of WATCHLIST) {
    for (const ind of ex.industries) {
      const hit = ind.companies.find((c) => c.ticker === ticker);
      if (hit) return hit.name;
    }
  }
  return null;
}

/** Yahoo Finance symbol for a company: explicit `yahoo`, else derived by exchange. */
export function yahooSymbol(exchange: string, c: WatchlistCompany): string {
  if (c.yahoo) return c.yahoo;
  if (exchange === 'IDX') return `${c.ticker}.JK`;
  return c.ticker;
}

export interface FlatCompany extends WatchlistCompany {
  exchange: string;
  symbol: string;
}

/** Flat list of every company with its exchange and resolved Yahoo symbol. */
export function flatCompanies(): FlatCompany[] {
  const out: FlatCompany[] = [];
  for (const ex of WATCHLIST) {
    for (const ind of ex.industries) {
      for (const c of ind.companies) {
        out.push({ ...c, exchange: ex.exchange, symbol: yahooSymbol(ex.exchange, c) });
      }
    }
  }
  return out;
}
