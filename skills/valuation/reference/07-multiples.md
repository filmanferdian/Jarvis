# Step 7 — Using Multiples (Cross-Check) (McKinsey Valuation, 4th ed., Ch 12)

> Pure 4th-edition book methodology, extracted via NotebookLM. Modern refinements live in `modern-updates.md`.

## Purpose
Multiples are a **complement** to DCF, not a substitute. The book positions them as a **"sanity check"** and a way to **"supplement DCF valuation"** rather than replace it. Properly executed, multiples serve as a vital **cross-check** rather than a substitute for rigorous analysis.

A careful multiples analysis can **"test the plausibility of cash flow forecasts"** by comparing the multiples implied by a DCF model against those of comparable companies, and it helps **"explain mismatches between a company's performance and that of its competitors."** Multiples provide a way to **"place your DCF model in the proper context."**

Multiples should **not** replace DCF because they do not "value directly what matters to investors" — which is cash flow. Relying on industry averages can be **"dangerous"** because it assumes your company has identical growth and return prospects as the average peer.

## Which multiple to use
The book strongly prefers **enterprise-value (EV) multiples — specifically EV/EBITA** — over the price-earnings (P/E) ratio, because EV/EBITA focuses on core operations independent of how those operations are financed.

**Why EV/EBITA is preferred:**
- **Independence from capital structure:** In a world without taxes, EV/EBITA is "unaffected by leverage," allowing for a **"purely operating multiple."**
- **Comparability:** It allows for a **"clean set of multiples"** that are directly tied to the key value driver formula (growth and ROIC).

**Problems the book identifies with the P/E ratio:**
- **Systematic bias from capital structure:** The P/E ratio is **"systematically affected by capital structure."** For high-growth companies, the P/E ratio can **"explode"** simply by adding leverage, because the proportional drop in equity value is less than the drop in earnings from interest expenses.
- **Commingling of items:** P/E multiples **"commingle expectations about operating performance, capital structure, and nonoperating items."**
- **One-time event distortions:** Unlike EBITA, net income includes nonoperating gains and losses (restructuring charges, write-offs). These **"can significantly lower earnings (without a comparable effect on value), causing the P/E ratio to be artificially high."**
- **Nonoperating asset distortion:** A large cash balance generating low interest income has a very high "P/E of cash" (a 2 percent return equals a P/E of 50), which **"artificially increase[s] the P/E of [a] company's operating business,"** making it look more expensive than it is.

**Forward vs. trailing:** Use multiples based on **forward-looking (forecast) estimates**, not trailing/historical ones.
- **Consistency with valuation principles:** "When building a multiple, the denominator should use a forecast of profits, rather than historical profits" because "forward-looking multiples are consistent with the principles of valuation — in particular, that a company's value equals the present value of future cash flow, not sunk costs."
- **Greater accuracy:** Empirical evidence shows forward-looking multiples are "more accurate predictors of value." One study found historical earnings-to-price ratios had **1.6 times the standard deviation** of one-year forward ratios, and using one-year forecasted earnings reduced the median pricing error from **23 percent to 18 percent**. Two-year forecasts improved accuracy further.

## Choosing comparables
The book's first best practice: **"choose comparables with similar prospects for ROIC and growth."** True comparability is determined by a company's fundamental ability to create value through ROIC and growth, not by simple industry classification (e.g., SIC codes).
- **Look for similar economic prospects:** Relying on a broad industry average is **"dangerous"** because companies even in the same industry can have **"drastically different expected growth rates, returns on invested capital, and capital structures."**
- **Identify strategic drivers:** Investigate the business model — ask: **"Do certain companies in the group have superior products, better access to customers, recurring revenues, or economies of scale?"**
- **The link to multiples:** **"If these strategic advantages translate to superior ROIC and growth rates, better-positioned companies should trade at higher multiples."** Conversely, if expected growth, ROIC, and cost of capital are truly similar, **"they should have similar multiples."**
- **Multibusiness considerations:** For companies with multiple business units, use a **"separate peer group for each business unit,"** because each unit may have its own prospects for ROIC and growth.

## Required adjustments
The book recommends building a **"clean set of multiples"** by adjusting both numerator and denominator for nonoperating items and capital-structure differences. "Enterprise-value multiples must be adjusted for nonoperating items" included in either the market value or the reported profit.

- **Capital-structure neutrality:** Use enterprise value (market value of debt plus equity) in the numerator and EBITA in the denominator. This makes the multiple independent of financing; in a world without taxes the ratio is "unaffected by leverage."
- **Excess cash and marketable securities:** "Sum the market values of debt and equity, subtract excess cash, and divide the remainder by EBITA." EBITA excludes interest income from cash, so including cash in EV without including its income creates an inconsistency; cash's high "P/E" otherwise artificially inflates the operating P/E.
- **One-time and nonrecurring items:** If using historical data, "eliminate any one-time events" (restructuring charges, write-offs), which can otherwise distort earnings without a comparable effect on value.
- **Pension distortions:** Numerator — "add the after-tax present value of pension liabilities to debt plus equity." Denominator — start with EBITA, "add the pension interest expense, and deduct the recognized returns on plan assets." This removes nonoperating gains and losses related to plan assets.
- **Operating leases:** "Add the value of leased assets to the market value of debt and equity. Add back the implied interest expense to EBITA." Otherwise leasing-heavy companies show an artificially low EV and artificially low EBITA.
- **Employee stock options:** Denominator — "subtract the after-tax value of newly issued employee option grants from EBITA." Numerator — "add the present value of employee grants outstanding to the sum of debt and equity." EV must be adjusted for any company with outstanding options, regardless of its expensing policy.

## Multiples ↔ DCF fundamentals
Multiples are not independent of DCF; they are a **direct algebraic simplification of it.** The book derives the **enterprise-value-to-EBITA multiple** (also called the **value-driver multiple**) from the key value driver formula, disaggregating NOPLAT into EBITA and the cash tax rate (T):

```
   V          (1 - T) · (1 - g/ROIC)
-------  =  ---------------------------
 EBITA              WACC - g
```

This formula shows four fundamental factors drive the EV/EBITA multiple:
1. **Growth rate (g)**
2. **Return on invested capital (ROIC)**
3. **The cash tax rate (T)**
4. **The cost of capital (WACC)**

The book emphasizes that **"growth does indeed drive multiples, but only when combined with a healthy return on invested capital."** If ROIC equals WACC, the multiple is constant regardless of growth; if ROIC exceeds WACC, the multiple increases as the growth rate increases.

## Step-by-step procedure
1. Build the subject company's DCF valuation first (multiples are a cross-check on it).
2. Select comparables with **similar prospects for ROIC and growth** — investigate strategic drivers, not just industry codes. Use a separate peer group per business unit if needed.
3. Use **enterprise-value multiples based on EBITA**, computed on **forward-looking (forecast)** profits.
4. **Adjust** the multiple for nonoperating items on both sides: strip excess cash, eliminate one-time items, and correct for pensions, operating leases, and employee stock options.
5. Apply the adjusted peer multiple range to the subject's (adjusted, forecast) EBITA to get an implied enterprise-value range.
6. Compare the multiple **implied by your DCF** against the peer multiples to test the plausibility of your cash flow forecasts.
7. Explain any gap in terms of strategic drivers (superior products, recurring revenue, economies of scale) that justify higher/lower ROIC and growth — or revisit DCF assumptions if the gap is not explainable.

## Common pitfalls (from the book)
- Using P/E, which is "systematically affected by capital structure" and "commingle[s] expectations about operating performance, capital structure, and nonoperating items."
- Using trailing/historical multiples instead of forward-looking ones (lower accuracy, inconsistent with valuation principles).
- Relying on a **broad industry average** multiple — **"dangerous"** because it assumes identical growth, ROIC, and capital structure to peers.
- Failing to strip nonoperating items (excess cash, one-time events, pensions, leases, options) from numerator and denominator, producing an "unclean" multiple.
- Treating multiples as a replacement for DCF rather than a sanity check; they "do not value directly what matters to investors" (cash flow).

## Inputs needed / Outputs produced
- Inputs: peer EVs and EBITA/EBITDA (forecast, adjusted for nonoperating items), subject EBITA/EBITDA, DCF output to triangulate
- Outputs: implied value range from multiples; reconciliation to DCF (explained via ROIC, growth, WACC differences)
