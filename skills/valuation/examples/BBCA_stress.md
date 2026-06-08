# Bank Central Asia (BBCA): Assumption Stress Test

As of 2026-06-08 | billions IDR | Driver-based equity DCF | Price IDR 5,700

This stress test rebuilds the BBCA equity DCF from real bank levers (NIM, cost of credit, loan growth, efficiency, capital), then pushes on the assumptions three ways: a tornado (which assumptions matter most), a reverse DCF (what the market is pricing in), and a Monte Carlo (the full range of value and the odds of being undervalued). Every number comes from the deterministic engine, not mental math. Artifacts: `BBCA_drivers.json` (assumptions), `BBCA_stress.json` (stress spec), `BBCA_stress.xlsx` (model), and the scripts `driver_bank.py` + `stress.py`.

## Verdict

The base case is **IDR 6,049 per share, about 6% above the 5,700 price**. The Monte Carlo puts the median at about 6,000 with a **60% probability the stock is worth more than today's price**. This is a "modestly undervalued, not a screaming buy" call: the central estimate sits above the quote, but the plausible range is wide and brackets the price comfortably. Two things drive almost all the uncertainty: the cost of equity (the macro/rate cycle) and the cost of credit (asset quality). Everything else is second order.

## How the cycle is handled (bad now, better later)

We are in a tight part of the cycle: rates are high (10-year at 6.9%, BI may hike), loan growth has slowed to 7.7%, and NIM is compressing. The model does not extrapolate that trough forever. Each driver follows a path from today's stressed level toward a normalized through-cycle level, anchored on BCA's own 15-year history (which includes the 2015 to 2016 slowdown and the 2020 COVID spike). The continuing value, which is about 62% of total value, runs off the normalized end state, not the trough. The cycle recovery for BCA shows up mainly as a lower discount rate (rates ease) and a loan-growth recovery, not as a higher margin.

## The 10 assumptions (locked base, with stress range)

| # | Assumption | Base | Downside | Upside |
|---|---|---|---|---|
| 1 | Cost of equity | 12.0% (rf 6.5% + ERP 5.5%, beta 1.0) | 14% | 11% |
| 2 | Terminal growth (g) | 5.5% | 4.5% | 6.5% |
| 3 | NIM | 5.5% | 5.0% | 5.8% |
| 4 | Cost of credit | 0.50% | 1.5% | 0.30% |
| 5 | Explicit growth | peak 10.5%, ~8.5% avg | peak 6.5% | peak 12% |
| 6 | RONE | 18% | 14% | 20% |
| 7 | Cost-to-income | 31% | 38% | 30% |
| 8 | Capital intensity | equity/assets 18% | 20% (build) | 15% (release) |
| 9 | Effective tax | 20% | 22% | 19% |
| 10 | Fee income | stable share | share falls | share rises |

ROE is an output of these drivers, not an input. The base set implies a steady-state ROE near 19.8%. We hold RONE at 18% in the terminal as a deliberate, mild haircut.

## 1. Tornado: which assumptions matter most

Each driver moved one at a time to its low and high, all others at base. Ranked by the swing in value per share:

| Rank | Driver | Low value | High value | Swing |
|---|---|---|---|---|
| 1 | Cost of equity | 7,238 | 4,524 | 2,714 |
| 2 | Cost of credit | 6,258 | 5,005 | 1,253 |
| 3 | Explicit growth (peak) | 5,282 | 6,386 | 1,103 |
| 4 | Cost-to-income | 6,169 | 5,211 | 958 |
| 5 | NIM | 5,495 | 6,382 | 887 |
| 6 | Terminal growth (g) | 5,774 | 6,418 | 643 |
| 7 | RONE | 5,575 | 6,215 | 641 |
| 8 | Capital intensity | 6,331 | 5,861 | 470 |
| 9 | Fee income drift | 5,892 | 6,220 | 328 |
| 10 | Tax rate | 6,146 | 5,856 | 290 |

Takeaways:
- **Cost of equity dominates.** Its swing (about 2,700 per share) is more than double the next driver. The valuation debate is mostly a debate about the discount rate, which is a debate about Indonesian rates and risk.
- **Cost of credit is the number two risk,** and it is asymmetric: the downside (a credit cycle pushing provisions to 1.5%) costs more than the benign upside helps. This is the single biggest fundamental risk to watch.
- **NIM ranks below credit cost,** which is a useful correction. NIM is the biggest revenue lever per unit, but its plausible range is narrow (5.0% to 5.8%), so it contributes less total uncertainty than credit cost, whose range is wide. Per-unit power and range-driven swing are different things.
- The bottom four (capital, fee income, tax) barely move the value. They are not worth arguing about.

## 2. Reverse DCF: what the 5,700 price implies

Solving for the single driver value that makes the model equal today's price, with everything else at base:

| Driver | Base | Implied by price |
|---|---|---|
| Cost of equity | 12.0% | 12.4% |
| Terminal growth | 5.5% | 4.2% |
| NIM | 5.5% | 5.2% (implies ROE 18.9%) |
| Cost of credit | 0.50% | 0.83% |
| Explicit growth (peak) | 10.5% | 8.8% |
| RONE | 18% | 14.9% |

Read this as: the market is pricing BCA modestly more conservatively than our base on every axis at once. To justify 5,700 you only need any one of these: a slightly higher discount rate, about 1.3 points less long-run growth, 0.3 point lower NIM, a third more credit cost, or a noticeably more competed-away moat. None of these is extreme. That is why this is a "fair to modestly cheap" call, not a deep-value one.

## 3. Monte Carlo: the full range

10,000 simulations. A single cycle factor co-moves the rate, NIM, credit cost, and growth together (a bad cycle lifts rates and provisions while cutting growth, an easing cycle does the reverse), plus idiosyncratic noise on each driver. Cost of credit is drawn on a log scale so it can spike like 2020. This keeps the discount-rate benefit and the operating drivers internally linked rather than drawn independently.

| Statistic | Value per share |
|---|---|
| Mean | 6,170 |
| Median (P50) | 5,997 |
| Std dev | 1,372 |
| P10 | 4,592 |
| P25 | 5,218 |
| P75 | 6,942 |
| P90 | 7,947 |
| P(value >= 5,700) | 60% |

The distribution is wide and slightly right-skewed. The central band (P25 to P75) of roughly 5,200 to 6,900 brackets today's price. The left tail (P10 around 4,600) is the "cycle does not turn" case: rates stay high, credit cost spikes, growth stalls, all together. The 60% probability undervalued is a modest, honest edge, not a high-conviction signal.

## Revised plausible range

- Point estimate (base): **IDR 6,049**
- Likely band (P25 to P75): **IDR 5,200 to 6,900**
- Full plausible range (P10 to P90): **IDR 4,600 to 7,950**

## What would change the call

- A sustained rise in Indonesian yields, or a wider risk premium, pulls value toward the low-5,000s. This is the dominant swing factor.
- A credit cycle (provisions toward 1.0 to 1.5%) is the biggest fundamental downside, and it tends to arrive with the rate stress, not separately.
- Faster, durable loan growth from the under-banked runway (credit is only about 40% of GDP) is the main upside, alongside any easing in rates.

## Methodology, sources, caveats

- Method: McKinsey equity DCF for banks (discount equity cash flow at the cost of equity, drive off ROE/growth, value-driver continuing value). Driver tree calibrated to FY2025 actuals (net income about 57.6T, equity about 282T, ROE about 20% on a total-equity basis).
- Normalized anchors are grounded in BCA's FY2011 to FY2025 reported history (NIM, cost of credit, ROE, loan growth, CASA, efficiency), leaning on the post-2020 lower-rate regime while blending in a stress year. Cost of equity uses a normalized 6.5% local risk-free rate rather than the 6.9% spot, to stay consistent with assuming the cycle improves.
- This is a local-currency (IDR) valuation. A foreign holder bears rupiah translation risk not captured here.
- Bank balance sheets are hard to read from outside (true loan quality, asset-liability mismatch). Required risk capital is assumed equal to book equity. The credit-cost tail is modeled but, by nature, uncertain.
- This is a methodology-grounded estimate, not investment advice.
