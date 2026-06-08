# Bank Central Asia (BBCA): Equity DCF

As of 2026-05-29 | billions IDR | Method: McKinsey equity DCF for financial institutions (midyear convention)

## Verdict

Intrinsic value of about **IDR 5,782 per share** against a market price of **IDR 5,700**. On a disciplined equity DCF, BBCA looks **roughly fairly valued** (about 1.4% upside). After a roughly 38% drop from its 52-week high of 9,175, the market has repriced BBCA from a premium franchise multiple to a level a conservative model can broadly support. The whole plausible value range (about 4,900 to 7,300 across cost-of-equity and growth bounds) brackets today's price, so this is a fairly-valued call, not a deep-value or clear-overvalued one.

## Why equity DCF (not enterprise DCF)

BBCA is a bank, so operating and financing decisions are inseparable: interest income and expense are the raw material of the business, and the size and structure of deposits and equity are tied directly to operations. The book is explicit that the standard enterprise DCF fails here. We therefore value equity directly: discount equity cash flow (net income less the increase in book equity needed to support growth) at the cost of equity, and drive the model off ROE and growth rather than ROIC and WACC.

## Thesis

BBCA is an elite-ROE franchise: about IDR 57.5T of FY2025 net income on roughly IDR 282T of equity, a return on equity near 21% against an estimated cost of equity of about 12.2%. That ~9-point spread means growth genuinely creates value. The question is price, not quality: even crediting a high sustainable ROE and a long reinvestment runway in a growing economy, the discounted value lands close to the current quote. The premium the market paid a year ago (price-to-book above 4x) has compressed to about 2.5x, which is roughly what the fundamentals justify.

## Key drivers (what the value hinges on)

- **Cost of equity ~12.18%.** Local-currency CAPM: Indonesia 10-year government bond 6.68% (which already embeds sovereign and inflation risk) plus an equity risk premium of 5.5% at a beta of 1.0. Using the local risk-free rate avoids double-counting country risk in both the rate and a separate premium, per the emerging-markets guidance.
- **ROE and reinvestment.** ROE held near 20% in the explicit period (a slight haircut from the reported ~21%), with retention set to g/ROE so book equity grows in step with earnings and capital adequacy is preserved. Return on new equity (RONE) of 18% in the continuing period.
- **Growth path.** Net income grows about 7% near term, tapering to a 5.5% terminal rate, below Indonesia's ~8 to 9% nominal GDP growth, reflecting a large incumbent maturing rather than a high-growth challenger.

## Valuation bridge

- PV of explicit equity cash flow: 320.5T
- PV of continuing value: 390.1T
- Equity value: 710.5T
- Shares outstanding: 122.88B
- Value per share: 5,782

(For a bank the equity DCF yields equity value directly; there is no enterprise-to-equity net-debt bridge.)

## Continuing value reliance

CV is 54.9% of total equity value, within a healthy range and well below the 75% stress threshold. The conclusion does not rest disproportionately on the terminal assumption.

## Sensitivity (value per share, cost of equity by terminal growth)

The plausible value range runs from about IDR 4,928 (cost of equity 13.18%, g 4.5%) to about IDR 7,259 (cost of equity 11.18%, g 6.5%). The current price of 5,700 sits near the middle of this grid. Unlike a clear mispricing, BBCA's value is bracketed by reasonable assumptions: the call is sensitive to the cost of equity and terminal growth, which is exactly where an analyst should focus the debate.

## Stress test (driver-based, 2026-06-08 update)

A fuller follow-up rebuilds this valuation from real bank drivers (NIM, cost of credit, loan growth, efficiency, capital) and stress-tests the assumptions three ways: a tornado, a reverse DCF, and a 10,000-run Monte Carlo. See `BBCA_stress.md` and `BBCA_stress.xlsx`.

- Driver-based base value: about IDR 6,049 per share, mildly above this memo's 5,782, because the explicit forecast now carries the under-banked, above-GDP growth runway (loan growth peaking near 10.5%) and uses a normalized 6.5% risk-free rate. Continuing value is about 62% of total.
- Most important assumptions (tornado, ranked by swing): cost of equity first by a wide margin, then cost of credit, explicit growth, cost-to-income, and NIM. The macro/discount rate and asset quality drive most of the uncertainty. NIM ranks below credit cost because its plausible range is narrow.
- What the 5,700 price implies (reverse DCF): the market prices BBCA modestly more conservatively than the base on every axis (cost of equity about 12.4%, terminal growth about 4.2%, NIM about 5.2% for an implied ROE near 18.9%, cost of credit about 0.83%, RONE about 14.9%).
- Distribution (Monte Carlo, cycle factor co-moving rates, NIM, credit cost and growth): median about 6,000, likely band P25 to P75 about 5,200 to 6,900, full range P10 to P90 about 4,600 to 7,950, and about a 60% probability the value exceeds today's price.

Revised plausible range: about IDR 4,600 to 7,950 (P10 to P90), point estimate about 6,049, price near the lower-middle. The conclusion holds: fairly to modestly undervalued, with the cost of equity and the credit cycle as the swing factors.

## Cross-checks

- **Implied market multiple.** At 5,700 with FY2025 equity of ~282T, BBCA trades at about 2.5x book and roughly 12x trailing earnings (net income ~57.5T, market cap ~700T). A Gordon decomposition at ROE 21% and cost of equity 12.2% implies a market terminal growth near 6.3%, modestly above our 5.5% base, which is why the model lands just above the quote.
- **Economic profit.** Equity x (ROE − cost of equity) is strongly positive (about 282T x (21% − 12.2%) ≈ 25T per year of value creation), confirming the franchise earns well above its cost of capital. The valuation question is how long and how fast that spread compounds, not whether it exists.

## Risks and what would change the call

- **Cost of equity / country risk.** The single biggest swing factor. A sustained rise in Indonesian government yields or a wider risk premium pushes value toward the low-5,000s; easing rates push it well above 6,000. The book's preferred emerging-market treatment would model this through probability-weighted macro scenarios rather than a single discount rate.
- **ROE durability.** BBCA's edge is its low-cost CASA deposit franchise. Erosion of that funding advantage, tighter net interest margins, or higher credit costs would compress ROE toward the cost of equity and remove the value-creation spread.
- **Growth.** Slower loan growth (Indonesian banks saw tight liquidity and softer growth in 2025; FY2025 net income rose only ~4.9%) would pull the explicit path below the 7% assumed here.
- **Currency and accounting.** This is a local-currency (IDR) valuation. A foreign investor bears rupiah translation risk not captured in the per-share figure. Bank balance sheets are also harder to read from outside (asset-liability mismatch, true loan quality); required risk capital is assumed equal to book equity.

## Inputs, sources, and caveats

- FY2025 (ended December 2025): net income about IDR 57.54T (up ~4.9% YoY from ~54.84T); total equity about IDR 281.7T (FY2024 ~262.8T); total assets about IDR 1,587T; implied ROE ~21%. Dividend payout about 54% (forecast ~66%). Shares outstanding about 122.88B. Price IDR 5,700 as of 2026-05-29 (52-week range 5,700 to 9,175; market cap ~700T). Indonesia 10-year government bond yield 6.68% as of 2026-05-29. Sources: stockanalysis.com, Investing.com, TradingEconomics, company FY2025 release.
- Beta set to 1.0 by judgment: the screen-reported 0.01 is an illiquidity/data artifact (BBCA is the most heavily weighted, most liquid IDX large cap). The book recommends not lever-adjusting bank betas and smoothing toward 1.0.
- The equity cash flow path uses simplified driver assumptions (ROE, RONE, growth, retention = g/ROE) calibrated to recent results, suitable as a library entry and meant to be refined with a full income-statement and balance-sheet forecast that sizes equity against risk-weighted assets and the Tier 1 ratio.
- Emerging-market caveat: country risk is reflected in the discount rate (via the local risk-free rate), a secondary/triangulation approach. The book prefers building at least two probability-weighted macro scenarios and keeping the discount rate free of an added country premium. A fuller version should do that and triangulate against global bank peer multiples.
- This is a methodology-grounded estimate, not investment advice.
