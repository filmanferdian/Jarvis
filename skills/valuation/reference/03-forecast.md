# Step 3 — Forecast Performance (McKinsey Valuation, 4th ed., Ch 8)

> Pure 4th-edition book methodology, extracted via NotebookLM. Modern refinements live in `modern-updates.md`.

## Purpose
Build an integrated financial forecast that produces future free cash flow (FCF), grounded in economic drivers rather than simple accounting extrapolation. The forecast feeds the DCF: it generates forecast NOPLAT, invested capital, and FCF for each explicit year, and it sets up the steady-state conditions required for a valid continuing value.

The forecasting work sits inside the book's broader six-step sequence to arrive at FCF:
1. **Prepare and analyze historical financials** — input raw data and reorganize the statements to calculate NOPLAT and invested capital.
2. **Build the revenue forecast** — done first, because revenue drives almost every other line item.
3. **Forecast the income statement** — use economic drivers for operating expenses, depreciation, interest, and taxes.
4. **Forecast the balance sheet (invested capital and nonoperating assets)** — project operating working capital, net PP&E, and other operating items.
5. **Forecast the balance sheet (investor funds)** — use clean surplus accounting for retained earnings and "plugs" (excess cash or new debt) to balance the statement.
6. **Calculate ROIC and FCF** — ensure projected results are consistent with economic principles and industry dynamics.

## Forecast horizon
**Length:** The explicit forecast period should typically be **10 to 15 years**, and potentially longer for "cyclical companies or those experiencing very rapid growth."

**Why this long:** The explicit forecast must run long enough for the company to reach a **"steady state."** At the end of the explicit period the company must satisfy all of these:
- "The company grows at a constant rate and reinvests a constant proportion of its operating profits into the business each year."
- "The company earns a constant rate of return on new capital invested."
- "The company earns a constant return on its base level of invested capital."
- "The company's growth rate is less than or equal to that of the economy" — continuing higher growth would make the company "unrealistically large, relative to the aggregate economy."

**Risk of a too-short period:** Using a short window (e.g., five years) typically produces a **"significant undervaluation of a company."** If the firm has not reached steady state within five years, the analyst is forced into **"heroic long-term growth assumptions"** in the continuing value (CV) to justify the value. Because "all the continuing-value approaches assume steady-state performance," ending the forecast before margins or capital turnover have stabilized distorts the CV estimate.

**Explicit vs. continuing-value split:** To avoid the "error of false precision" over a long horizon, split the explicit forecast into two sub-periods:
- **Detailed 5- to 7-year forecast:** complete balance sheets and income statements, linked to real variables (e.g., unit volumes).
- **Simplified forecast (remaining years):** focuses only on critical value drivers — revenue growth, margins, and capital turnover.

After the explicit period, value the remaining cash flows with a continuing-value perpetuity (covered in the CV step).

## Building the forecast (driver approach)

### The three-step process for each line item
For most line items the book applies a three-step sub-process:
1. **Decide what economically drives the line item.** Identify the variable most naturally linked to the account. Many are driven by **Revenue**; others are tied to specific assets or liabilities (e.g., interest is driven by debt).
2. **Estimate the forecast ratio.** Compute historical values for the ratio (e.g., COGS/Revenue) and pick an appropriate future ratio based on historical trends, industry benchmarks, or announced management strategy.
3. **Multiply the forecast ratio by an estimate of its driver** to get the dollar amount of the line item.

### Revenue forecasting (top-down vs. bottom-up)
The authors recommend using **both** methods to establish bounds for the forecast:
- **Top-down (market-based):** estimate revenue by **sizing the total market, determining market share, and forecasting prices.** In mature industries this is tied to long-term economic trends; in emerging markets it involves analyzing penetration rates of comparable historical products.
- **Bottom-up (customer-based):** rely on **projections of demand from existing customers, customer turnover rates, and the potential to attract new customers.**
- **Tying to value drivers:** calibrate projections against **historical economy-wide evidence** on growth and the company's **competitive positioning.**

### Operating margins, depreciation, taxes (income statement)
- **Operating expenses (COGS, SG&A):** driven by **Revenue**; ratio = **Operating Expense / Revenue**.
- **Depreciation:** ideally tied to **prior-year Net PP&E**; ratio = **Depreciation / Net PP&E**. Alternatively, if capex is smooth, forecast as a **percentage of Revenue.**
- **Taxes (operating tax rate):** driven by **EBITA**; use the **operating tax rate** (Operating Taxes on EBITA / EBITA) so that NOPLAT and FCF do not change with leverage.

### Working capital (balance sheet) — "stocks" approach
The book favors a **"stocks" approach** (forecasting levels) over a **"flows" approach** (forecasting changes), because levels relative to revenue are more stable. Ratios are often expressed in **"days"** of revenue, e.g.:

    365 × (Account / Revenue)

Specific drivers/ratios:
- **Operating cash (working cash):** driven by Revenue; ratio = Working Cash / Revenue (roughly 2% of sales, or ~7 days).
- **Accounts receivable:** driven by Revenue; ratio = Accounts Receivable / Revenue.
- **Inventory:** ideally driven by **COGS** (Revenue used for simplicity); ratio = Inventory / COGS.
- **Accounts payable:** driven by COGS; ratio = Accounts Payable / COGS.
- **Prepaid expenses:** driven by Revenue; ratio = Prepaid Expenses / Revenue.
- **Accrued expenses:** driven by Revenue; ratio = Accrued Expenses / Revenue.

### Capital expenditures and long-term items
Do **not** forecast capex directly. Instead forecast **Net PP&E as a percentage of revenues**, then derive capex:

    Capex = Net PP&E(t) − Net PP&E(t−1) + Depreciation(t)

This prevents unintended shifts in capital turnover.

Other long-term / nonoperating items:
- **Net PP&E:** driven by Revenue; ratio = Net PP&E / Revenue.
- **Goodwill and acquired intangibles:** driven by **acquired revenues**; ratio = Goodwill / Acquired Revenue. If no acquisitions are planned, hold constant at current levels.
- **Deferred taxes:** tied to **adjusted taxes**; ratio = Change in Deferred Taxes / Adjusted Taxes.
- **Nonoperating assets:** the authors advise being **"extremely cautious"** — value them separately based on current assessments rather than discounting forecasted changes in book value (planning projections may use a growth rate or return on equity of the asset).

### Nominal vs. real forecasting
- **Recommendation:** estimate forecasts and the cost of capital in **nominal currency units.** Most managers find nominal measures easier to communicate, and interest rates are typically quoted nominally.
- **Consistency:** nominal cash flows must be discounted at a **nominal WACC.** The inflation rate built into the forecast must match the inflation rate implicit in the cost of capital (often derived from the yield difference between nominal government bonds and inflation-indexed "linkers" such as TIPS).
- **High-inflation hybrid:** in emerging markets or high-inflation environments (above ~5% annually), project **operating performance in real terms** (EBITDA, capex, operating working capital), then convert into **nominal financial statements** to correctly compute taxes and interest, which are governed by nominal laws and contracts.

## Making the model balance
To preserve the balance-sheet identity (Assets = Liabilities + Equity):
- **Retained earnings — clean surplus relation:**

      Retained Earnings(t+1) = Retained Earnings(t) + Net Income − Dividends

- **The "plug" — excess cash and newly issued debt** act as balancing items. If projected assets (excluding cash) exceed liabilities and equity (excluding new debt), "plug the difference with newly issued debt." If liabilities/equity are higher, plug with "excess cash."
- **Other equity accounts** (e.g., common stock) are typically held constant unless a new issue is planned.

**Avoiding circularity:** Interest depends on debt, but debt (the plug) depends on net income, which depends on interest — a feedback loop. The book recommends tying **interest expense to the previous year's debt load:**

    Interest Expense(t) / Total Debt(t−1)

**Capital-structure consistency:** As growth slows, the plug's "common side effect" is that "newly issued debt will drop to zero, and excess cash will become very large." If this conflicts with the target capital structure used in the WACC, the analyst must manually adjust the **dividend payout ratio** or **net share repurchases** to maintain the target structure.

## Convergence logic
ROIC and growth must eventually converge to a steady state consistent with the **competitive advantage period:**
- **Growth convergence:** high growth decays quickly and tends to regress toward the long-run median within five years.
- **ROIC convergence:** future ROIC generally follows one of three patterns — (1) remaining near current levels if there is a **distinguishable sustainable advantage**, (2) trending toward an industry median, or (3) trending toward the **cost of capital.**
- **Logic:** the explicit forecast must be long enough to capture any expected erosion of margins or shifts in competitive dynamics before assuming a constant-growth perpetuity in the continuing value. Match future ROIC against the company's **competitive advantage** rather than merely forecasting line items precisely.

## Step-by-step procedure
1. Prepare and analyze historical financials; reorganize to NOPLAT and invested capital (output of Step 2).
2. Build the **revenue forecast** first (top-down and bottom-up; calibrate to value drivers and competitive position).
3. For each line item: **decide the driver → estimate the forecast ratio → multiply ratio by driver.**
4. Forecast the **income statement** (operating expenses, depreciation, operating tax rate; interest tied to prior-year debt).
5. Forecast the **balance sheet — invested capital and nonoperating assets** (operating working capital via the "stocks"/days approach; net PP&E as % of revenue; derive capex; goodwill on acquired revenue; deferred taxes; value nonoperating assets cautiously and separately).
6. Forecast the **balance sheet — investor funds** (retained earnings via clean surplus; plug with excess cash / newly issued debt).
7. Ensure growth and ROIC **converge** to steady state by the end of the explicit period; adjust payout/repurchases for target capital structure.
8. Compute **ROIC and FCF** per explicit year; check consistency with economic principles and industry dynamics.

## Common pitfalls (from the book)
- **False precision:** avoid by splitting into a detailed 5- to 7-year forecast plus a simplified forecast of core value drivers.
- **Naive base-year extrapolation:** assuming a constant investment rate for the CV period; the proportion of gross cash flow devoted to increasing working capital should decline significantly as sales growth slows.
- **Ignoring competitive dynamics:** forecasts must be "consistent with industry dynamics, competitive positioning, and the historical evidence on corporate growth"; match ROIC to competitive advantage.
- **Mechanical balancing / unrealistic cash buildup:** the plug can drive new debt to zero and excess cash very large; manually adjust dividend payout or net share repurchases to hold the target capital structure.
- **Standardized data errors:** relying solely on standardized data services (e.g., Compustat) can "hide critical information" by grouping operating and nonoperating items together.
- **Circularity:** break the interest/debt/net-income loop by tying interest to the previous year's debt load.
- **Hard-coded numbers:** "numbers should never be hard-coded into a formula" — they are "easily lost as the spreadsheet grows in complexity."

## Inputs needed / Outputs produced
- Inputs: historical drivers (from Step 2), strategic assumptions
- Outputs: forecast NOPLAT, invested capital, and free cash flow per explicit year
