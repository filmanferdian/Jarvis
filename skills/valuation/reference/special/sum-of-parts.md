# Special Situation — Valuing Multibusiness Companies (Sum-of-Parts) (McKinsey Valuation, 4th ed., Ch 19)

> Pure 4th-edition book methodology, extracted via NotebookLM.

## When to use this

Use the **sum-of-the-parts** approach when a company's business units have **significantly different financial characteristics**, such as differing **growth rates** and **returns on capital**. A single corporate-wide valuation masks these differences; valuing each unit separately captures them.

## The sum-of-parts principle

The core principle is to value each business unit **as if it were a stand-alone company** and then aggregate those values to determine total enterprise value.

High-level process:

1. **Create business-unit financials** — develop separate income statements, balance sheets, and cash flow statements for each unit.
2. **Estimate cost of capital for each unit** — assign a specific WACC to each unit that reflects its unique **systematic risk (beta)** and **debt-carrying capacity**.
3. **Value each unit separately** — perform an **enterprise DCF** for every unit, including an explicit forecast and a continuing value.
4. **Sum the parts** — add the values of the individual operating units, **subtract the present value of the corporate center (headquarters) costs**, and **add the value of nonoperating assets** to reach total enterprise value.

## Building business-unit financials

When only consolidated public data (e.g., from a 10-K) is available, the book provides a specific procedure to estimate **NOPLAT** and **invested capital** per unit.

**Estimating NOPLAT:**

- Start with **reported EBITA** (or segment operating profit) provided in the annual report.
- **Allocate income taxes** — use the **effective overall corporate tax rate** for all units unless specific unit data is available.
- **Allocate adjustments** — assign adjustments for **pensions** (often by **headcount**) and **operating leases** (by the **fraction of assets used**) to each unit.
- **Reconcile** — ensure the sum of business-unit NOPLATs equals the consolidated NOPLAT.

**Estimating invested capital:**

- Start with **total assets** reported by business unit.
- **Subtract nonoperating assets** — remove items like **excess cash**, **nonconsolidated subsidiaries**, or **pension assets** if they are included in the unit's asset base.
- **Subtract operating liabilities** — allocate **non-interest-bearing liabilities** (accounts payable, accrued wages) based on a driver like **revenue** or **total assets**.
- **Adjust for goodwill** — subtract goodwill to measure **organic ROIC** for peer comparisons.

**Handling intercompany items:**

- **Intercompany sales** — eliminate internal revenue and costs to prevent **double-counting**. Treat these **"eliminations"** as a separate unit to reconcile business-unit forecasts to the consolidated total. Eliminations **do not affect the value** of the company or the individual business units.
- **Intercompany receivables/payables** — these should **not** be treated as operating working capital. Instead, treat **internal receivables as an equity investment** in the subsidiary and **internal payables as equity provided by the parent**. Treating them as working capital can cause a subsidiary's invested capital to be **understated by about 30 percent**, overstating ROIC.
- **Internal transfer pricing** — intercompany transfers must be recorded at the value transacted with **third parties**; otherwise the relative value of units is distorted.

## Corporate overhead & shared assets

The book makes a **sharp distinction** between services provided to the units and the costs of being a public corporation.

- **Shared services (allocate)** — costs for services that the corporate center provides to the units, such as **payroll, human resources, and accounting**, should be **allocated** to the business units using cost drivers (e.g., number of employees).
- **Corporate overhead / HQ (value separately)** — costs incurred because the units are part of a larger company, such as **CEO compensation, the board of directors, or the corporate art collection**, should **not** be allocated.
  - **Why value separately?** First, allocating these costs **reduces comparability with pure-play peers** that do not incur such overhead. Second, valuing the center separately reveals the **"drag"** the corporate center creates on company value, which typically amounts to **10 to 20 percent of total enterprise value** (corporate center costs typically represent **10 to 20 percent of operating profit**).
  - **Valuation method** — value the corporate center as its own unit with **negative free cash flows**. To determine continuing value, use a **cash flow perpetuity formula** (growing the negative after-tax cash flow at the company's overall growth rate), because NOPLAT is negative and ROIC is meaningless for a cost center.

## Unit-specific cost of capital

Because systematic risk and leverage vary by business type, **each business unit should be valued at its own cost of capital**.

- **Target capital structure** — use the **median capital structure of publicly traded peers** for that specific unit. If no peers exist, allocate debt so that all units have the **same interest coverage ratio (EBITA / interest expense)**.
- **Cost of equity** — estimate an **unlevered sector median beta** for the industry, then **relever** it to the specific unit's target capital structure.
- **WACC** — blend the unit's specific cost of equity and its cost of borrowing based on the unit-specific target weights. For the **corporate center** cash flows, use a **weighted average of the various business unit costs of capital**.

## Reconciling to the consolidated entity

To reach the total value of a diversified firm, perform the "sum the parts" assembly:

- **Sum of business units** — aggregate the values of the individual operating units from their separate enterprise DCFs.
- **Subtract corporate center costs** — subtract the **present value of the corporate center (headquarters) costs**, valued separately as a corporate cost center with negative free cash flows.
- **Add nonoperating assets** — add the value of nonoperating assets (e.g., excess cash, nonconsolidated subsidiaries) to arrive at **total enterprise value**.
- **Subtract nonequity claims** — subtract **debt and other nonequity claims** from total enterprise value to find the value of common equity.
- **Role of eliminations** — eliminations reconcile business-unit forecasts to the consolidated financials (avoiding double-counting of internal sales) but **do not affect the value** of the company or the individual units.

**Conglomerate discount.** The book asks whether the market values conglomerates at less than the sum of their parts and concludes that the **results are incomplete** and **there is no consensus** on whether such a discount truly exists. The authors argue that what is often perceived as a conglomerate discount is actually a **"performance discount"**: when a company is valued below pure-play peers, it is because its units have **lower growth and/or returns on capital relative to pure-play peers**. While they give no fixed discount percentage, the negative value contribution of the corporate center (the **"drag"**) is usually **about 10 to 20 percent of total enterprise value**.

## Common pitfalls (from the book)

- **Allocating corporate center costs to units** — this **reduces comparability with pure-play business unit peers** and hides the true **"drag"** the center creates on company value. Value the center separately instead.
- **Misclassifying intercompany accounts** — treating intercompany receivables and payables as **operating working capital** instead of equity can understate a subsidiary's invested capital **by about 30 percent**, overstating ROIC.
- **Internal transfer pricing distortions** — intercompany transfers must be recorded at the value transacted with **third parties**, or the relative value of units will be distorted.
- **Double-counting financial subsidiary debt** — when a firm has a financial subsidiary (e.g., GE Capital), do **not double count the debt** of the financial subsidiary when subtracting debt from consolidated enterprise value.
- **Uniform corporate WACC** — using a single corporate-wide cost of capital is an error; **each business unit should be valued at its own cost of capital** reflecting its unique systematic risk (beta) and debt-carrying capacity.
- **Cross-subsidization** — mismatched units in a portfolio can lead to **suboptimal decision-making because of conflicts of interest and cross-subsidization**.

## How this modifies the standard workflow

- **Disaggregate first** — instead of one enterprise DCF, build **separate business-unit financials** (income statement, balance sheet, cash flow) by allocating consolidated EBITA, taxes, pension/lease adjustments, operating liabilities, and goodwill down to each unit.
- **Multiple discount rates** — replace the single corporate WACC with a **unit-specific WACC** per business (unlevered sector median beta relevered to peer-median capital structure, or equal interest coverage where no peers exist).
- **Run N enterprise DCFs** — value each unit on a stand-alone basis with its own forecasts, own WACC, and own continuing value.
- **Add a corporate cost center** — value headquarters/HQ costs as a **separate unit with negative free cash flows**, using a cash flow perpetuity for continuing value and a weighted average of unit WACCs as the discount rate.
- **Assemble and reconcile** — sum operating units, subtract PV of corporate center, add nonoperating assets to get **total enterprise value**, then subtract debt and other nonequity claims (avoiding double-counting financial-subsidiary debt) to get equity value. Use eliminations only to reconcile forecasts, not to change value.
- **Interpret the gap** — a value below pure-play peers is most likely a **performance discount** (lower growth/returns), not an unexplained conglomerate discount.
