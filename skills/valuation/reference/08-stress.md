# Step 8 — Stress Test the Assumptions

> Skill step, not one of the book's 7. It operationalizes the book's own guidance to model uncertainty with scenarios rather than conservatism (see the "purposeful overconservatism" pitfall in `05-continuing-value.md` and the probability-weighted approach in `special/emerging-markets.md` and `special/cyclicals.md`).

## Purpose

A single point value hides which beliefs it rests on and how wide the real range is. After assembling the value (step 6) and the multiples cross-check (step 7), stress the assumptions to answer three questions:

1. Which assumptions move the value the most?
2. What is the market already pricing in?
3. What is the full range of value, and what are the odds the stock is mispriced?

## The three techniques

### 1. Tornado (one-at-a-time sensitivity)
- Vary each key assumption to a plausible low and high, holding the others at base; record value per share at each end.
- Rank drivers by the swing (high minus low). The top of the chart is where the debate belongs.
- A driver's swing reflects BOTH its per-unit sensitivity AND the width of its plausible range. A powerful driver with a narrow range can rank below a weaker driver with a wide range (e.g. NIM ranks below cost of credit for a bank). Say so, so the rank is not misread.

### 2. Reverse DCF (implied expectations)
- For each headline driver, solve (bisection) for the value that makes the model equal the current price, holding the others at base.
- Report the implied values next to the base. This states, in plain terms, what the market must believe. Aggressive implied values mean the stock is cheap on your base; conservative ones mean it is dear.

### 3. Monte Carlo (the distribution)
- Give each key driver a distribution around its base (triangular or truncated normal), with bounds from the tornado ranges.
- For macro-sensitive businesses, drive the correlated drivers from a single cycle factor so they co-move: a bad cycle simultaneously raises the discount rate and credit costs and cuts growth. Drawing them independently understates the tails.
- Make asymmetric drivers asymmetric (credit cost, impairments, demand shocks have fat downside tails); draw them on a log scale or with a skew so the simulation can spike like a real downturn.
- Run about 10,000 sims. Report P10/P50/P90, the probability the value exceeds the price (probability undervalued), and the probability-weighted (mean) value.
- This is the many-scenario generalization of the book's two-scenario probability-weighted method. Keep country and cycle risk in the cash flows; do not also pad the discount rate for the same risk (double-count).

## Step-by-step procedure

1. List the value-driving assumptions (the ones locked at the checkpoints). Give each a plausible low/high grounded in the company's own multi-cycle history and peer dispersion, not symmetric round numbers.
2. Run the tornado; rank the drivers; name the top two or three.
3. Run the reverse DCF on the headline drivers; state what the price implies.
4. Configure the Monte Carlo distributions (and the cycle coupling if macro-sensitive); run it; read P10/P50/P90 and the probability undervalued.
5. Set the published fair-value range from the Monte Carlo P10/P90 (or the tornado/scenario ends if no Monte Carlo was run). Keep the point estimate as the base.
6. Write the findings into the memo and the Notion page.

## Choosing the ranges (do this honestly)

- Anchor low/high on history and peers, not gut-feel round numbers.
- Keep the discount rate consistent with the operating case: if you assume the cycle improves (lower rates), the recovery and the lower rate must travel together, not be cherry-picked separately. The cycle factor enforces this.
- Do not use conservatism as a substitute for the range. Lowering the point estimate "to be safe" double-counts uncertainty; model the range explicitly instead.

## Interpreting

- A wide range that brackets the price is "fairly valued, conviction in neither direction." A point estimate well above the price with P10 still above it is a real undervaluation signal.
- If the probability undervalued is near 50%, say so. Do not dress a coin flip as a call.
- Tie the result back to the two or three assumptions the tornado flagged; those are what the reader is really buying.

## Tooling

- `scripts/stress.py` runs all three on a bank driver model (`drivers.json` plus a `stress.json` spec). `scripts/build_stress_workbook.py` writes the Excel (tornado + histogram charts).
- `scripts/sensitivity.py` gives the 2-way WACC by growth grid for an enterprise `model.json`. A generic tornado/reverse/Monte-Carlo for the enterprise model is a future add.
- Worked example: `examples/BBCA_stress.json` (spec) and `examples/BBCA_stress.md` (memo).

## Common pitfalls

- Conservatism instead of scenarios (lowering the point estimate to hedge) double-counts uncertainty.
- Independent draws for correlated macro drivers understate the tails; use a cycle factor.
- Double-counting risk: padding the discount rate AND stressing the cash flows for the same risk.
- Symmetric ranges on asymmetric drivers: a benign-trough credit cost extrapolated both ways misses the downturn.
- Treating the tornado rank as fixed truth: it depends on the ranges chosen, so state them.

## Inputs / Outputs

- Inputs: the assembled base model (step 6), the locked assumptions, a plausible range/distribution per driver.
- Outputs: ranked drivers (tornado), implied expectations (reverse DCF), the value distribution and probability undervalued (Monte Carlo), and the published fair-value range.
