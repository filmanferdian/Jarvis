# Bank Central Asia (BBCA): Equity DCF (driver-based)

As of 2026-06-08 | billions IDR | Method: McKinsey equity DCF for banks, built from fundamental drivers (NIM, cost of credit, loan growth, efficiency, capital). Companion files: `BBCA_drivers.json`, `BBCA_stress.json`, `BBCA_stress.xlsx`, `BBCA_stress.md`.

## Verdict

Fair value about **IDR 6,049 per share** against a market price of **IDR 5,700**, roughly 6% upside. BBCA looks **fairly valued with a modest undervaluation tilt**: the base case sits a little above the quote, and a 10,000-run Monte Carlo puts about a **60% probability** that the shares are worth more than today's price. The plausible range is wide and brackets the price (about 4,600 to 7,950 from the 10th to the 90th percentile), so this is a fair-to-slightly-cheap call, not a deep-value one. Two things decide it: the cost of equity (the rate cycle) and the cost of credit (the asset-quality cycle).

## Why equity DCF (not enterprise DCF)

BBCA is a bank, so operating and financing decisions are inseparable: interest income and expense are the raw material of the business, and the size and structure of deposits and equity are tied directly to operations. We value equity directly: discount equity cash flow (net income less the increase in book equity needed to support growth) at the cost of equity, and drive the model off ROE and growth rather than ROIC and WACC.

## How the model is built

This is a driver-based forecast (`driver_bank.py`), not a hand-built cash-flow line. Earning-asset growth, net interest margin, fee income, cost-to-income, cost of credit, tax, and capital intensity drive net income; equity cash flow is net income minus the increase in book equity required to fund growth at a steady capital ratio. ROE is an **output** of these drivers (about 20% near term, settling near 19.8%), not an assumption. The base year is calibrated to FY2025 actuals: net income about 57.6T, equity about 282T, ROE about 20%.

## Handling the cycle

We are in a tight part of the cycle: rates are high (the 10-year is near 6.9% and Bank Indonesia may hike), loan growth has slowed to 7.7%, and the margin is compressing. The model does not extrapolate that trough. Each driver follows a path from today's stressed level to a normalized through-cycle level, anchored on BBCA's own 15-year history, which spans the 2015 to 2016 slowdown and the 2020 COVID provision spike. The continuing value, about 62% of total value, runs off the normalized end state, not the trough. For BBCA the recovery shows up mainly as a lower discount rate as rates ease and a loan-growth recovery, not as a higher margin.

## Key assumptions

| Assumption | Base |
|---|---|
| Cost of equity | 12.0% (risk-free 6.5, ERP 5.5, beta 1.0) |
| Terminal growth | 5.5% |
| NIM | 5.5% |
| Cost of credit | 0.50% |
| Explicit loan growth | peaks near 10.5%, about 8.5% average, then fades |
| RONE (return on new equity) | 18% |
| Cost-to-income | 31% |
| Capital (equity to assets) | 18% |
| Effective tax | 20% |
| Fee income | grows with the bank |

The cost of equity uses a normalized 6.5% local risk-free rate rather than the 6.9% spot, to stay consistent with assuming the cycle improves, plus a mature-market equity premium (not a full country-risk premium on top of the local rate, which would double-count). Beta is set to 1.0 by judgment; the screen-reported near-zero is an illiquidity artifact, and the book recommends not lever-adjusting bank betas.

## Valuation bridge

- PV of explicit equity cash flow: about 279T
- PV of continuing value: about 464T (62% of value)
- Equity value: about 743T
- Shares outstanding: 122.88B
- Value per share: about 6,049

For a bank the equity DCF yields equity value directly; there is no enterprise-to-equity net-debt bridge.

## Thesis

BBCA is an elite-ROE franchise: about 57.6T of FY2025 net income on about 282T of equity, a return on equity near 20% against a cost of equity near 12%. That roughly 8-point spread means growth genuinely creates value. The engine is the funding base: a CASA ratio of 84.6%, the cheapest deposit franchise in the system, which keeps the margin above peers through the cycle. The question is price, not quality. Even crediting the moat and a long under-banked runway (credit is only about 40% of GDP), the discounted value lands modestly above the quote. The premium the market paid a year ago (price-to-book above 4x) has compressed to about 2.5x.

## Most important assumptions (tornado)

Varying each assumption one at a time to its plausible low and high, ranked by the swing in value per share:

| Driver | Swing (IDR/share) |
|---|---|
| Cost of equity | ~2,700 |
| Cost of credit | ~1,250 |
| Explicit growth (peak) | ~1,100 |
| Cost-to-income | ~960 |
| NIM | ~890 |
| Terminal growth | ~640 |
| RONE | ~640 |
| Capital intensity | ~470 |
| Fee income | ~330 |
| Tax rate | ~290 |

The discount rate and asset quality drive most of the uncertainty. NIM ranks below cost of credit because its plausible range is narrow, even though it is the biggest revenue lever per unit.

## What the market is pricing in (reverse DCF)

Solving for the driver value that makes the model equal today's 5,700, one driver at a time, the market is pricing BBCA modestly more conservatively than our base on every axis: cost of equity about 12.4%, terminal growth about 4.2%, NIM about 5.2% (an implied ROE near 18.9%), cost of credit about 0.83%, or RONE about 14.9%. None of these is extreme, which is why this is a fair-to-modestly-cheap call rather than a clear mispricing.

## Range and probability (Monte Carlo)

10,000 simulations with a single cycle factor that moves rates, NIM, credit cost, and growth together (a bad cycle lifts rates and provisions while cutting growth), plus idiosyncratic noise on each driver and a fat-tailed credit cost. Median about 6,000. Likely band (P25 to P75) about 5,200 to 6,900. Full range (P10 to P90) about 4,600 to 7,950. Probability the value exceeds today's price: about 60%.

## Cross-checks

- **Implied multiple.** At 5,700, BBCA trades at about 2.5x book and roughly 12x trailing earnings, consistent with a high-ROE franchise normalizing toward a high-teens ROE.
- **Economic profit.** Equity times (ROE minus cost of equity), about 282T times roughly 8%, is about 22T per year of value creation, confirming the franchise earns well above its cost of capital. The question is how long and fast that spread compounds, not whether it exists.

## Risks and what would change the call

- **Cost of equity and rates.** The single biggest swing factor. A sustained rise in Indonesian yields or a wider risk premium pushes value toward the low-5,000s; durable easing pushes it well above 6,000.
- **Credit cycle.** The biggest fundamental downside. Provisions have spiked before (about 2.0% in 2020); a move toward 1 to 2% would remove a large part of the value, and it tends to arrive together with the rate stress.
- **Funding moat.** BBCA's edge is its low-cost CASA base. Erosion from digital-bank deposit competition or tighter margins would compress the ROE-to-cost-of-equity spread.
- **Growth.** Slower loan growth than the recovery we assume would pull the explicit path down.
- **Currency and accounting.** This is a local-currency (IDR) valuation; a foreign holder bears rupiah translation risk. Bank balance sheets are hard to read from outside; required risk capital is assumed equal to book equity.

## Inputs, sources, and caveats

- FY2025 actuals: net income about 57.6T (up about 4.9%), equity about 282T, total assets about 1,587T, ROE about 20 to 21%, NIM 5.7%, cost of credit 0.42%, CASA ratio 84.6%, cost-to-income about 31%, effective tax about 19%, loan growth 7.7%. Price IDR 5,700; shares about 122.88B; market cap about 700T. Indonesia 10-year yield about 6.9% spot (a normalized 6.5% is used for discounting).
- Normalized through-cycle anchors are grounded in BBCA's reported FY2011 to FY2025 history (spanning the 2015 to 2016 slowdown and the 2020 COVID spike), leaning on the recent lower-rate regime while blending in a downturn for cost of credit. Macro from IMF and OECD: real GDP about 5%, inflation heading toward 2.5 to 3%, nominal GDP about 8%.
- Sources: company FY2025 release and annual reports, broker results notes, stockanalysis, Investing, TradingEconomics, IMF and OECD.
- This is a methodology-grounded estimate, not investment advice.
