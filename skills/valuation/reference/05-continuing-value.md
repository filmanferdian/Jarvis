# Step 5 — Estimate Continuing Value (McKinsey Valuation, 4th ed., Ch 9)

> Pure 4th-edition book methodology, extracted via NotebookLM. Modern refinements live in `modern-updates.md`.

## Purpose
Continuing value (CV) captures the value of a company's expected cash flows beyond the explicit forecast period. Because CV often accounts for a large percentage of total value, small errors in its assumptions can lead to significant misvaluations. The recommended approach is cash-flow based and explicitly links CV to the fundamental value drivers: growth and return on capital. The formulas assume the company has reached a **steady state** where its parameters remain constant forever.

Note: the length of the explicit forecast period does not affect the company's total value — it only affects the **distribution** of value between the explicit forecast period and the years that follow.

## Continuing-value formulas

### Key value driver form (recommended)
The recommended formula, stated exactly as in the book:

CV = NOPLAT_{t+1} (1 − g / RONIC) / (WACC − g)

Term definitions (as given by the book):
- **NOPLAT_{t+1}** — the normalized level of NOPLAT in the **first year after the explicit forecast period**.
- **g** — the expected growth rate in NOPLAT in perpetuity.
- **RONIC** — the expected rate of return on **new** invested capital.
- **WACC** — the weighted average cost of capital.

The book emphasizes this formula is superior to other methods because it is based on cash flow and explicitly links it to the fundamental value drivers of growth and return on capital.

### Economic-profit continuing value
The book also gives a CV for the economic-profit model. Applied correctly, it yields the same total company value as the enterprise DCF CV. Stated exactly:

CV = Economic Profit_{t+1} / WACC + [ NOPLAT_{t+1} × (g / RONIC) × (RONIC − WACC) ] / [ WACC × (WACC − g) ]

Term definitions (as given by the book):
- **Economic Profit_{t+1}** — the normalized economic profit in the first year after the explicit forecast period.
- **NOPLAT_{t+1}** — the normalized NOPLAT in the first year after the explicit forecast period.
- **g** — the expected growth rate in NOPLAT in perpetuity.
- **RONIC** — the expected rate of return on net new invested capital.
- **WACC** — the weighted average cost of capital.

### Special case RONIC = WACC (the convergence formula)
When RONIC = WACC, the key value driver formula collapses into a simple perpetuity the book calls the **convergence formula**:

CV = NOPLAT_{t+1} / WACC

Why growth drops out: in this scenario "the growth term has disappeared from the equation." This does not imply nominal growth is zero — it means growth has no impact on value, because "new growth adds nothing to value, as the return associated with growth equals the cost of capital." (Ch 3 logic: "investors will not pay a premium for additional growth if they can earn the same returns elsewhere.")

When it applies: recommended for companies in **competitive industries** where "all the excess profits are competed away" over time.

Caveat: this form may be "too conservative" for companies with sustainable competitive advantages (strong brands or patents) likely to earn returns above the cost of capital for a very long period. In those cases, use the full key value driver formula to avoid undervaluing the company.

## Choosing the inputs (g and RONIC)

### Long-run growth rate (g)
- Best estimate for g is typically "the expected long-term rate of consumption growth for the industry's products, plus inflation."
- The explicit forecast period must continue until the company's growth rate is "less than or equal to that of the economy." Higher growth rates "would eventually make companies unrealistically large, relative to the aggregate economy."
- Technical bound: for the formula to be mathematically valid, **g must be less than WACC** — otherwise the company's value would theoretically approach infinity as it eventually takes over the entire world economy.

### RONIC for the continuing period
- RONIC "should be consistent with expected competitive conditions."
- **Convergence case (RONIC = WACC):** "economic theory suggests that competition will eventually eliminate abnormal returns, so for many companies, set RONIC equal to WACC." Any excess profits on new projects get competed away over time.
- **Sustainable advantage case (RONIC > WACC):** "for companies with sustainable competitive advantages (e.g., brands and patents), you might set RONIC equal to the return the company is forecast to earn during later years of the explicit forecast period." Examples: Coca-Cola, PepsiCo, where returns are "unlikely to fall substantially as they continue to grow due to the strength of their brands."
- RONIC should reflect the expected return on **net new** invested capital, not the return on the entire base of historical capital. The book cautions against naive base-year extrapolation when setting it.

## Sanity checks
The book suggests triangulating CV estimates with the following:

- **Implied value-driver multiple** — check the resulting multiple (e.g., P/E) against industry conditions expected at the *end* of the forecast, not today. "In maturing industries... prospects at the end of the explicit forecast period are likely to be very different from today's... Unless you are comfortable using an arbitrary P/E ratio, you are much better off with the value driver formula."
- **Implied ROIC** — check the implied average ROIC over time to ensure it behaves realistically. Under the key value driver formula, the average return on all capital should decline gradually toward RONIC: "The original capital (prior to the continuing value period) will continue to earn the returns projected in the last forecast period. In other words, the company's competitive advantage period has not come to an end once the continuing-value period is reached."
- **Fraction of total value in CV** — CV typically accounts for "56 percent to 125 percent of total value." A high CV percentage is normal and does not mean most value is created in the future: "Often continuing value is large because profits and other inflows in the early years are offset by outflows for capital spending and working capital investment — investments that should generate higher cash flow in later years."

## Step-by-step procedure
1. Confirm the explicit forecast period runs long enough that the company has reached a steady state (growth ≤ that of the economy; parameters constant going forward).
2. Estimate **NOPLAT_{t+1}** — normalized NOPLAT in the first year *after* the explicit forecast period.
3. Choose **g** — long-run growth = expected industry consumption growth + inflation; ensure g < WACC and g ≤ economy growth.
4. Choose **RONIC** — set to WACC for competitive industries (convergence); set to forecast later-year returns for businesses with sustainable competitive advantages.
5. Apply the **key value driver formula** to compute CV (use the economic-profit CV formula if running the economic-profit model). If RONIC = WACC, this reduces to NOPLAT_{t+1} / WACC.
6. Run the sanity checks: implied value-driver multiple, implied ROIC path, and share of total value in CV.

## Common pitfalls (from the book)
- **Naive base-year extrapolation** — assuming every line item (including investment) grows at the same rate as NOPLAT into the CV period. "Since sales are growing more slowly, the proportion of gross cash flow devoted to increasing working capital should decline significantly... The naive approach... will significantly understate the value of the company."
- **Aggressive long-run growth rates** — "few companies can be expected to grow faster than the economy for long periods." Also: g "must be less than WACC. (Otherwise the company would eventually take over the entire world economy)."
- **Naive overconservatism (defaulting RONIC = WACC)** — for businesses with sustainable advantages, "this assumption is too conservative... An assumption that RONIC equals WACC for these businesses would substantially understate their values."
- **Purposeful overconservatism** — lowering CV to compensate for uncertainty. "Conservatism overcompensates for uncertainty. Uncertainty matters, but it should be modeled using scenarios, and not through conservatism."
- **Confusing CV with total company value** — the "misperception that the length of the explicit forecast affects the company's value." The length only affects the distribution of value between the explicit forecast period and the years that follow.

## Inputs needed / Outputs produced
- **Inputs:** NOPLAT in first CV year (NOPLAT_{t+1}), long-run g, RONIC, WACC (from Step 4)
- **Outputs:** continuing value at end of explicit period (undiscounted)
