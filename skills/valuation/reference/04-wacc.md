# Step 4 — Estimate the Cost of Capital / WACC (McKinsey Valuation, 4th ed., Ch 10)

> Pure 4th-edition book methodology, extracted via NotebookLM. The book's circa-2005 market figures (ERP, risk-free guidance) are preserved here as-is; current-market guidance is in `modern-updates.md`.

## Purpose
Estimate the weighted average cost of capital (WACC) used to discount free cash flows. The WACC is the market-based weighted average of the after-tax cost of debt and the cost of equity, blending the opportunity costs of all the company's investors into a single rate.

## WACC formula
The WACC is the market-based weighted average of the after-tax cost of debt and the cost of equity:

```
WACC = (D/V) · k_d · (1 − T_m) + (E/V) · k_e
```

Term definitions (exact):
- `D/V` — target level of debt to enterprise value using market-based (not book) values.
- `E/V` — target level of equity to enterprise value using market-based values.
- `k_d` — cost of debt (pretax).
- `k_e` — cost of equity.
- `T_m` — company's marginal income tax rate.
- After-tax cost of debt component — calculated as `k_d · (1 − T_m)`.

## Cost of equity (CAPM)
The book recommends the Capital Asset Pricing Model (CAPM) to translate risk into expected return:

```
E(R_i) = r_f + β_i · [E(R_m) − r_f]
```

- `E(R_i)` — the security's expected return.
- `r_f` — the risk-free rate.
- `β_i` — the stock's sensitivity to the market.
- `[E(R_m) − r_f]` — the market risk premium.

### Risk-free rate
Use highly liquid, long-term government securities. For U.S. corporate valuation, the most common proxy is the 10-year government bond. The authors specifically prefer the 10-year zero-coupon strip to avoid distortions from interim interest payments.

### Equity/market risk premium  (4th-ed. recommendation: 4.5%–5.5%)
The authors conclude the appropriate range for the market risk premium (ERP) is 4.5 percent to 5.5 percent. It is estimated using three methods:
1. **Historical excess returns:** Arithmetic averages of U.S. data (1903–2002) show a 6.2% premium, but after adjusting for negative autocorrelation (Blume's estimator) and survivorship bias, the estimate falls to approximately 5.5%.
2. **Regression analysis:** Linking market returns to financial ratios such as the dividend-to-price ratio.
3. **Forward-looking / DCF models:** Research suggests a stable real expected market return of 7.0%. Subtracting the real long-term risk-free rate (2.1% at year-end 2003) yields a premium of just under 5%.

### Beta  (estimation, unlever/relever formulas, smoothing)
- **Raw vs. industry beta:** Raw regression betas are often imprecise due to high standard errors. To improve precision, the book recommends using industry, rather than company-specific, betas.
- **Unlevering formula** (to find the operating/unlevered beta `β_u`):

```
β_u = β_e / (1 + D/E)
```

- **Relevering formula** (to find the equity/levered beta `β_e` for a target structure):

```
β_e = β_u · (1 + D/E)
```

  Terminology: `D` and `E` are market values of debt and equity; these formulas assume a debt beta of zero and that debt tracks enterprise value.

- **Smoothing formula (Bloomberg adjustment)** — adjusts raw betas toward the market mean of 1.0:

```
Adjusted Beta = 0.33 + 0.67 × Raw Beta
```

## Cost of debt (after-tax)
- **Estimation:** For investment-grade firms (rated BBB or better), use the yield to maturity (YTM) on the company's long-term, option-free bonds.
- **Indirect method:** For firms with illiquid debt, determine the firm's credit rating and use the average YTM on a portfolio of long-term bonds with that same rating.
- **Tax adjustment:** The pretax cost is reduced by the marginal tax rate to incorporate the value of the tax shield:

```
After-Tax Cost of Debt = k_d · (1 − T_m)
```

## Capital-structure weights
The book explicitly recommends using target market-value weights rather than book values.
- **Why market values:** WACC represents the opportunity cost of capital; if a company returned capital to investors, they would reinvest it at market prices. Book value is a sunk cost and irrelevant for opportunity cost.
- **Why target weights:** Current market values may reflect short-term swings; target weights better reflect the level expected to prevail over the life of the business.

## Midyear adjustment factor
Because cash flows occur continuously throughout the year rather than as a lump sum at year-end, discounting in full-year increments understates value. The adjustment grows the discounted value of operations at the WACC for six months:

```
Midyear multiplier = (1 + WACC)^0.5
```

## Other claims in WACC
If a company has securities other than simple debt and equity, they must be included.
- **Preferred stock:** Additional terms are added for the security's rate of return and its percentage of enterprise value; it is treated as a debt equivalent.
- **Hybrid securities:** For material claims such as convertibles, the book recommends using the Adjusted Present Value (APV) method or splitting the security into its debt and equity components for inclusion in WACC.
- **Operating liabilities:** Items such as accounts payable are specifically excluded from WACC to avoid double-counting costs already embedded in COGS.

## Step-by-step procedure
1. Estimate the cost of equity via CAPM → verify: `r_f` from 10-year government bond (zero-coupon strip), ERP in 4.5%–5.5% range, and a (preferably industry) beta.
2. Estimate beta: take peer/industry equity betas, unlever each (`β_u = β_e / (1 + D/E)`), average, then relever to the target structure (`β_e = β_u · (1 + D/E)`); optionally smooth raw betas toward 1.0.
3. Estimate the after-tax cost of debt → verify: YTM on long-term option-free bonds (or credit-rating proxy), reduced by marginal tax rate `k_d · (1 − T_m)`.
4. Set target market-value capital-structure weights (`D/V`, `E/V`); add terms for any other claims (preferred, hybrids).
5. Combine into WACC → verify: `WACC = (D/V)·k_d·(1 − T_m) + (E/V)·k_e`.
6. Apply the midyear adjustment factor `(1 + WACC)^0.5` when discounting continuous cash flows.

## Common pitfalls (from the book)
- Using book-value weights instead of target market-value weights (book value is a sunk cost, irrelevant to opportunity cost).
- Using raw company-specific regression betas, which carry high standard errors; prefer industry betas.
- Using interim-coupon government bonds rather than the 10-year zero-coupon strip for the risk-free rate.
- Including operating liabilities (e.g., accounts payable) in WACC, which double-counts costs already in COGS.
- Discounting cash flows in full-year increments without the midyear adjustment, which understates value.

## Inputs needed / Outputs produced
- Inputs: risk-free rate, ERP, peer betas + capital structures, target capital structure, credit rating/yield, marginal tax rate
- Outputs: cost of equity, after-tax cost of debt, WACC, midyear factor
