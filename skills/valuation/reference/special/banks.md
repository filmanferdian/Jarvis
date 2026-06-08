# Special Situation — Valuing Financial Institutions / Banks (McKinsey Valuation, 4th ed., Ch 25)

> Pure 4th-edition book methodology, extracted via NotebookLM.

## When to use this

Use this approach for financial institutions, where operating and financing decisions are inextricably linked. The chapter explicitly applies these methodologies to:

- **Banks**
- **Insurance companies**, including **life**, **property and casualty**, and **reinsurance**

For **life insurers** specifically, the book mentions the use of **embedded value**, which is the present value of future cash flow from business in force plus the book value of shareholders' equity.

## Why the standard enterprise DCF fails here

For nonfinancial companies, the enterprise DCF approach is used because operating and financing decisions can be separated. For financial institutions, this separation is not possible for two primary reasons:

- **Interest as "raw material":** You cannot value operations separately from interest income and expense because interest is an "important component of their income." Financing decisions — such as the choice of leverage and the spread between deposit and lending rates — are at the "core of how banks and insurers generate earnings." Interest is treated as "raw material" rather than just a means of financing.
- **Definition of invested capital:** The standard concept of invested capital is indifferent to how assets are financed. In contrast, for banks the size and structure of financial claims are directly linked to the company's operations, making them "difficult to separate."
- **High sensitivity:** Because of their operating model, these companies are "highly levered," which makes their valuations "extremely sensitive to even small changes in key drivers."

Consequently, the book recommends the **equity cash flow method** (discounting equity cash flows at the cost of equity) rather than the enterprise DCF method.

## Recommended method (equity DCF)

The equity cash flow method values the equity of a financial institution directly.

**Defining equity cash flow.** Equity cash flow can be derived starting from net income and adjusting for the earnings that must be reinvested to support growth:

> **Equity Cash Flow = Net Income − Increase in Equity + Other Comprehensive Income**

- **Net Income** — earnings theoretically available to shareholders after all expenses, including those to debt holders, are paid.
- **Increase in Equity** — as an institution grows, it must increase its equity to satisfy regulators and customers regarding its solvency; these increases reduce the cash available to be paid out.
- **Other Comprehensive Income** — noncash items (e.g., unrealized gains/losses on investments) that must be added back to cancel out noncash adjustments to the equity account.

**Discount rate.** Discount equity cash flows at the **cost of equity** ($k_e$), not the WACC. Because operating and financing decisions are inextricably linked (interest is "raw material"), the enterprise DCF approach, which separates the two, is not possible. The cost of equity is estimated using the **Capital Asset Pricing Model (CAPM)**. For banks, the authors specifically note they "do not recommend adjusting betas for different leverage levels," because a bank's asset-liability mismatch typically affects the volatility of returns more than its leverage.

**Forecast horizon.** The authors typically recommend an **explicit forecast of 10 to 15 years** to ensure the company reaches a steady-state financial performance before applying a continuing value. Begin by forecasting the bank's **income statement and balance sheet** (specifically forecasting equity in relation to other balance sheet items like total assets) so that all financial elements interact correctly.

**Continuing value.** For the equity cash flow approach, the continuing-value formula is written as a value driver formula:

$$CV = \frac{NI \times (1 - g/RONE)}{k_e - g}$$

- **NI** — normalized level of net income in the first year after the explicit forecast period.
- **g** — expected growth rate in net income in perpetuity (net income growth in the continuing-value period).
- **RONE** — expected rate of return on net new equity (incremental return on new equity in the continuing-value period).
- **$k_e$** — cost of equity.

**Supplementary methods.**

- **Economic profit** — analysts "can make good use of an economic profit calculation" to see whether a bank is creating value: **Economic Profit = Equity × (ROE − $k_e$)**, or equivalently **Economic Profit = Net Income − (Equity × $k_e$)**.
- **Multiples** — for triangulation, specifically a **forward price-to-earnings multiple** and a **market value-to-equity book value** ratio.

## Key value drivers

For financial institutions, the primary drivers of value shift from ROIC and growth to **Return on Equity (ROE)** and growth.

- **Return on Equity (ROE)** — the key driver of value creation. Analysts should calculate ROE both including and excluding goodwill to understand underlying economics versus acquisition performance.
- **Equity growth** — the rate at which the bank grows its net income and the corresponding equity required to support that income.
- **Spread** — net interest income is driven by the **customer spread** (lending at higher rates than the cost of deposits) and **maturity mismatch income** (earning a spread from differing asset and liability durations).
- **Regulatory and economic capital** — the amount of equity a bank must hold is tied to its **risk-weighted assets (RWAs)**. Regulators (under frameworks like Basel I and II) require banks to maintain a minimum cushion — often measured by the **Tier 1 capital ratio** — to ensure solvency.

## Common pitfalls (from the book)

Valuing banks from the "outside in" is challenging because critical information is often unavailable to external analysts.

- **Information asymmetry** — outside analysts typically lack data on **asset-liability mismatches** and the true quality of the loan portfolio (potential **credit losses**), requiring them to rely on rough estimates and management judgment.
- **Risk capital vs. book equity** — while banks use internal models for **risk-adjusted return on capital (RAROC)**, external analysts usually must assume that the required risk capital is essentially equal to the **book value of equity**.
- **Capital adequacy** — a major pitfall is failing to ensure that the forecasted equity is sufficient to support projected growth. If a bank grows without a corresponding increase in equity, its leverage will rise to unsustainable levels, risking regulatory intervention or financial distress. The book recommends forecasting the **Tier 1 capital to risk-weighted assets ratio** (often set at a regulatory minimum of 8 percent) to determine the necessary equity for a sound valuation.

## Driver-based model, normalization, and stress (tooling + practice)

- **Use the driver tool, not a hand-built cash-flow line.** `scripts/driver_bank.py` builds the equity-cash-flow path and the continuing-value inputs (NI_next, RONE) from fundamental drivers (earning-asset growth, NIM, fee income, cost-to-income, cost of credit, tax, equity-to-assets), then runs the engine. Calibrate the base year so it reproduces reported net income and equity. ROE falls out of the drivers; it is not an input. See `examples/BBCA_drivers.json`.
- **Through-cycle normalization (do not extrapolate the trough or the peak).** Banks are cyclical. Model each driver as a path from today's stressed level to a normalized through-cycle level, and make the continuing value run off the normalized end state, not the current reading. Anchor the normal on the bank's own 10–15 year history of NIM, cost of credit, ROE and loan growth (spanning at least one downturn), leaning on the most recent rate regime rather than a flat long average. Cost of credit especially: the terminal level must blend in a downturn, never the benign trough. This mirrors `cyclicals.md`.
- **Explicit-period growth vs the terminal cap.** In under-banked markets a strong bank can grow loans well above GDP for years (credit deepening). Put that above-GDP growth in the **explicit** period and fade it down; the terminal g must still be capped at the economy's nominal growth (Damodaran's simpler cap: the local risk-free rate). High explicit growth and a disciplined terminal are not in conflict.
- **RONE consistency.** RONE is not a free pick. It should match the steady-state ROE the explicit drivers imply (`driver_bank.py` prints this). Setting RONE far above the implied ROE silently assumes better fundamentals than you forecast; setting it to the cost of equity assumes the moat is fully competed away.
- **Cost of equity for an emerging-market bank.** Use the local-currency risk-free rate (it already carries country and inflation risk) plus a mature-market ERP, not a full country-risk-adjusted ERP on top (that double-counts). If today's rate is cyclically high, discount at a normalized long-run rate, consistent with assuming the cycle improves. Do not lever-adjust the beta; smooth toward 1.0.
- **Stress test.** Run `scripts/stress.py` (tornado, reverse DCF, Monte Carlo) on the driver model. For the Monte Carlo use a single cycle factor so the rate, NIM, credit cost and growth co-move; that keeps the discount-rate benefit and the operating recovery internally linked and gives an honest "cycle does not turn" downside. See `examples/BBCA_stress.md`.

## How this modifies the standard workflow

- **Cash flow definition changes** — replace free cash flow / FCF with **equity cash flow** (Net Income − Increase in Equity + Other Comprehensive Income).
- **Discount rate changes** — discount at the **cost of equity** ($k_e$) via CAPM, not WACC; do **not** adjust betas for different leverage levels.
- **Value driver changes** — drive the model off **ROE and growth** (and RONE in continuing value) rather than ROIC and growth.
- **Forecasting changes** — forecast both the **income statement and balance sheet** together over a **10–15 year** explicit horizon, sizing equity against balance sheet items (e.g., total assets / risk-weighted assets) and the **Tier 1 capital ratio** to ensure capital adequacy.
- **Continuing value changes** — use the equity value-driver CV formula $CV = NI \times (1 - g/RONE) / (k_e - g)$.
- **Result** — the method yields the value of **equity directly**, rather than enterprise value from which net debt is subtracted.
