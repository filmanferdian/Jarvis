# Step 6 — Calculate & Interpret Results (McKinsey Valuation, 4th ed., Ch 11)

> Pure 4th-edition book methodology, extracted via NotebookLM. Modern refinements live in `modern-updates.md`.

## Purpose
Chapter 11, "Calculating and Interpreting Results," covers the final steps once financial projections and the continuing-value estimate are finished: compute the present value of operations, walk the equity value bridge to a per-share value, reconcile alternative valuation approaches, and verify that "your findings are technically correct, your assumptions realistic, and your interpretations plausible."

The book's worked example throughout this chapter is **Heineken N.V.** (see "Heineken Case" and Exhibit 11.9, "Heineken: Value of Equity").

## Present value of operations
The **value of operations** is the present value of the company's expected cash flow from its core business. It is assembled in three sub-steps: "discount free cash flows, discount continuing value, and sum the resulting values."

- **Discount free cash flows.** Discount each year's forecasted free cash flow to the present at the **Weighted Average Cost of Capital (WACC)**. For most valuations a constant WACC is used.
- **Discount the continuing value.** Because the continuing value is "already expressed as a value in the last year of the explicit forecast period," it should be discounted by the number of years in that explicit forecast (e.g., a 10-year forecast discounts the continuing value by 10 years, not 11).
- **Sum and apply the midyear convention.** Add the present value of the explicit-period free cash flows to the present value of the continuing value to get the value of operations. Because cash flows generally occur continuously throughout the year rather than as a year-end lump sum, discounting in full-year increments understates value. To correct this, the book applies a **"mid-year adjustment factor"**: "we grow the discounted value of operations at the WACC for six months."

## Equity value bridge
The fundamental enterprise value identity:

> **"Value of operations + nonoperating assets = enterprise value"**

To get common equity value, the analyst must then **"deduct the value of all the nonequity claims from the enterprise value."** The book groups nonequity claims into four categories: **Debt; Debt equivalents; Hybrid claims** (employee stock options and convertible bonds); and **Minority interests.**

### Add: nonoperating assets
Assets whose cash flows were not included in the value of operations:

- **Excess cash and marketable securities** — assets convertible to cash on short notice at low cost. Valued at the **most recent book values** as a proxy for market value (US GAAP/IFRS require fair-value reporting). Do not run a DCF unless market values are unavailable; if a DCF is used, discount at the appropriate cost of capital (e.g., the risk-free rate for government bonds), **not** the company WACC.
- **Illiquid investments / nonconsolidated subsidiaries** — loans and equity stakes where the parent holds a noncontrolling interest (generally <50%).
  - *Loans:* use **reported book value** if issued at fair market terms and risk/interest rates are unchanged; otherwise a separate DCF of promised payments at the yield to maturity for similar risk.
  - *Subsidiaries:* **market value** if publicly listed; a **separate DCF** at the subsidiary's cost of capital if unlisted but financials are available; if only parent accounts exist, use a **simplified cash-flow-to-equity valuation, multiples valuation (P/E or M/B), or a tracking portfolio**.
- **Tax loss carryforwards (NOLs)** — accumulated historical losses that offset future taxes. Create a separate account, forecast it by adding future losses and subtracting future taxable profits, and **discount the resulting tax savings at the cost of debt**. (Some practitioners simply multiply the tax rate by accumulated losses.)
- **Discontinued operations** — the **most recent book value** is usually a reasonable approximation, since these are written down to fair value under modern accounting rules.
- **Excess real estate and other unutilized assets** — assets no longer required for operations. Use the **most recent appraisal value**, an **appraisal multiple** (e.g., value per square meter), or **discount expected future rental cash flows** at an appropriate cost of capital.

### Subtract: debt & debt equivalents
- **Debt** — commercial paper, notes payable, bank loans, corporate bonds. Use **market value** if secure and actively traded; if not traded, **discount promised interest and principal** at the current yield to maturity; use book value only if interest rates and default risk are largely unchanged since issuance.
- **Operating leases** — the most common form of off-balance-sheet debt. Capitalize as a debt equivalent:

  > Capitalized Operating Leases = Rental Expense / ((1 / Asset Life) + k_d)

- **Unfunded pension and other postretirement liabilities** — subtract the **after-tax surplus (or deficit) of the plan's fair value**, calculated as fair value of plan assets minus fair value of the benefit obligation, both found in the **footnotes**, not the balance sheet.
- **Provisions** (long-term operating / nonoperating, e.g., decommissioning or restructuring charges) — use the **book value from the balance sheet** as a proxy, since these are typically recorded at discounted or near-term values.

### Subtract: other nonequity claims
- **Preferred equity** — resembles unsecured debt. Use **market value** if traded; otherwise a **separate DCF** discounting expected dividends in perpetuity at the cost of unsecured debt.
- **Minority interests** — third-party owners' claims on consolidated subsidiaries. Use **proportional market value** if listed; otherwise a separate valuation via **DCF, multiples, or a tracking portfolio** for the subsidiary.
- **Convertible debt** — a straight bond plus a call option. The book recommends an **option-based valuation** (adjusted Black-Scholes); alternatively the **conversion value approach** (assuming immediate exchange) if the option is "deep in the money."
- **Employee stock options** — treated as a nonequity claim that must be subtracted to arrive at common equity value.
  - *Recommended method:* the **estimated market value from option-valuation models**, such as Black-Scholes or lattice (binomial) models.
  - *Dilution adjustment:* when using Black-Scholes for employee options, adjust the resulting price for the dilution effect of new-share issuance:

    > Option Price Adjustment Factor = (Number of Existing Shares Outstanding) / (Number of Existing Shares Outstanding + Number of New Shares Issued)

  - *Data source:* first check the **notes to the balance sheet**, which report the total value of all options outstanding based on these models. If the DCF-estimated share price differs significantly from the market price used in the annual report, the analyst **must create a new valuation** using the option-pricing model and the DCF-derived share price.
  - *Vesting:* deduct the value of all **vested** options; for unvested options, adjust for the probability that some employees leave before they can exercise them.
  - *Exercise value approach:* a secondary method assuming immediate exercise (ignores time value); the book **does not recommend** it because it gives only a "lower bound" and overestimates equity value per share versus option-pricing models.

### = Equity value -> per-share value
**Equity value** is the residual after adding nonoperating assets and subtracting all nonequity claims. To get the share price, **"divide the total equity value by the number of undiluted shares outstanding."** Undiluted shares are used because the value of hybrid claims like options and convertibles has already been deducted as a nonequity claim.

(In Exhibit 11.9, "Heineken: Value of Equity," the bridge runs from a Value of operations of EUR 16.855 billion to a Value per share of EUR 34.35, adding nonoperating assets such as excess cash and subtracting debt, retirement liabilities, minority interest, and restructuring provisions.)

## Cross-checks (DCF = economic profit = APV)
Enterprise DCF, economic-profit valuation, and the adjusted present value (APV) approach "lead to identical results when applied correctly."

**Enterprise DCF vs. economic profit** — to make the two models yield the same value of operations:
- **Invested-capital timing:** "use beginning-of-year invested capital (i.e., last year's value)" when calculating economic profit.
- **Consistent definitions:** "use the same invested-capital number for both economic profit and ROIC" (e.g., both including or both excluding goodwill).
- **Mathematical identity:** the operating value equals beginning book value of invested capital plus the present value of all future value created:

  > Value_0 = Invested Capital_0 + sum_{t=1..inf} [ Economic Profit_t / (1 + WACC)^t ]

- **NOPLAT check:** NOPLAT should be "identical when calculated top down from sales and bottom up from net income."

**APV reconciliation** — APV handles the value of interest tax shields separately. To match a WACC-based DCF:
- **Risk of tax shields:** assume the "risk of tax shields will equal the risk of operating assets" (k_txa = k_u), consistent with managing debt to a target debt-to-value level.
- **Unlevered value:** discount free cash flow at the **unlevered cost of equity** (k_u) to get the value of operations as if all-equity financed, then add the **present value of interest tax shields**.

## Validating & interpreting results
**Consistency of ROIC and growth:**
- *Value-driver economics:* "if the projected returns on invested capital are above the WACC, the value of operations should be above the book value of invested capital."
- *Reasonable patterns:* avoid "large step-changes in key assumptions from one year to the next"; verify invested-capital turnover increases only for sound economic reasons, not as a mechanical byproduct of the model.
- *Steady-state requirement:* verify a "steady state is reached" by the end of the explicit forecast — achieved only when free cash flows grow at a constant rate.

**Comparison to market value (plausibility analysis):**
- *Market as default:* for a listed company, "Your default assumption should be that the market is right," unless there is evidence of low free float or low liquidity.
- *Multiples analysis:* perform a "sound multiples analysis" by computing implied forward-looking multiples (e.g., **EV/EBITA**) and comparing with traded peers; explain significant differences via strategic drivers or business characteristics.

**Scenario analysis:**
- *Purpose:* use scenarios to "deal better with the uncertainty underlying the final valuation."
- *Review variables:* broad economic conditions, competitive structure of the industry, internal capabilities, and financing capabilities.
- *Complete buildup:* for every scenario, generate a "complete valuation buildup from value of operations to equity value" — critical because the value of debt and nonequity claims can change across scenarios (e.g., in a downside scenario debt may be worth less than face value).
- *Combine via probability-weighting:* "weight each scenario's conditional value of equity by its probability of occurrence to obtain an estimate for the value of equity," then "weight the scenario values with probabilities and arrived at an estimated value." Assign probabilities by assessing "how likely it is that the key assumptions underlying each scenario will change"; this is "ultimately a matter of management judgment."

**Sensitivity analysis:**
- Test how the valuation changes when varying key drivers such as **growth and ROIC**, and sector-specific operating drivers (e.g., customer churn for a telecom).

**Interpreting results:**
- *High sensitivity:* for a typical company, a **0.5 percentage point change in WACC** can change value by **approximately 10 percent**.
- *Valuation range:* aim for a "valuation range of plus or minus 15 percent" rather than a single point estimate; "keep your aspirations for precision in check."

## Step-by-step procedure
1. **Calculate value of operations** — discount forecasted free cash flows (or economic profits) and the continuing value at WACC, then sum; apply the midyear adjustment.
2. **Walk the equity bridge** — add nonoperating assets to get enterprise value, then deduct the value of all nonequity claims (debt, debt equivalents, hybrid claims, minority interests) to get equity value.
3. **Per-share value** — divide total equity value by the number of undiluted shares outstanding.
4. **Use scenarios** — build multiple complete valuation buildups to handle uncertainty; probability-weight conditional equity values into a single estimate.
5. **Verify and interpret** — cross-check DCF against economic profit and APV; sanity-check ROIC/growth consistency, compare to market value and peer multiples, run sensitivity analysis, and present a range.

## Common pitfalls (from the book)
- Discounting the continuing value by the wrong number of years (it is already a value in the last explicit year, so use the explicit-period count, not one more).
- Omitting the midyear convention, which understates value because cash flows arrive continuously, not at year-end.
- Using the company WACC to discount excess cash / marketable securities instead of the appropriate (lower) cost of capital.
- Reading unfunded pension surplus/deficit off the balance sheet rather than the footnotes (fair-value figures live in the footnotes).
- Valuing employee stock options by the exercise (intrinsic) value approach, which ignores time value, gives only a lower bound, and overestimates equity value per share.
- Failing to re-rerun the option valuation with the DCF-derived share price when it differs significantly from the annual-report market price.
- Mismatched invested-capital definitions between economic profit and ROIC, or using end-of-year instead of beginning-of-year invested capital — breaks the DCF/economic-profit reconciliation.
- Large step-changes in key assumptions year to year, or a forecast that never reaches steady state (constant FCF growth) by the end of the explicit period.
- Over-precision: treating a single point estimate as exact despite a 0.5pp WACC move shifting value ~10%.

## Inputs needed / Outputs produced
- **Inputs:** explicit FCF (Step 3), continuing value (Step 5), WACC (Step 4), nonoperating assets, debt & claims, share count
- **Outputs:** enterprise value, equity value, value per share, value bridge
