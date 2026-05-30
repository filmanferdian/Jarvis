# Special Situation — Valuation in Emerging Markets (McKinsey Valuation, 4th ed., Ch 22)

> Pure 4th-edition book methodology, extracted via NotebookLM.

## When to use this

Use this approach when valuing businesses in emerging markets, where great macroeconomic uncertainty, illiquid capital markets, controls on the flow of capital into and out of the country, less-rigorous accounting standards and disclosure levels, and high levels of political risk make these businesses much more difficult to value than those in developed markets.

## The country-risk problem

The country-risk problem is the set of obstacles and uncertainties that make emerging-market businesses harder to value: "great macroeconomic uncertainty, illiquid capital markets, controls on the flow of capital into and out of the country, less-rigorous accounting standards and disclosure levels, and high levels of political risk."

The book identifies two primary approaches for handling these risks: (1) incorporating country risk directly in the cash flows via probability-weighted scenarios, and (2) adding a country risk premium to the discount rate.

## Approach 1: risk in the cash flows (scenarios) — book's preferred

This method incorporates country risk directly into cash flow projections by simulating alternative trajectories. The authors recommend it as the **prime valuation approach**.

**Methodology:**
- The analyst constructs at least two scenarios: a "business as usual" case (no major crisis) and a downside scenario (reflecting the materialization of emerging-market risks).
- The valuation result is the probability-weighted average of the DCF values from these scenarios.

**Why the book prefers it.** Both methods can theoretically lead to the same result if applied consistently, but the scenario DCF approach is superior because:
- **Analytical robustness:** it is "analytically more robust and better shows the impact of emerging-market risks on value."
- **Nature of risk (diversifiability):** "most country risks, including expropriation, devaluation, and war, are largely diversifiable" from the perspective of a global investor. Because finance theory dictates that the cost of capital should not reflect risk that can be diversified, adding a premium is theoretically inconsistent; the risk should instead affect the "level of expected cash flows."
- **Non-uniform impact:** a blanket premium is misleading because "many country risks apply unequally to companies in a given country." For instance, a currency devaluation might damage a raw-materials importer while actually benefiting an exporter.
- **Lack of precise calculation:** "there is no systematic method to calculate a country risk premium." Relying on sovereign bond spreads is only reasonable if corporate cash flows are highly correlated with government debt payments, which is often not the case.
- **Managerial insight:** explicitly modeling scenarios provides "more insights than they would get from a 'black box' addition to the discount rate." By identifying specific value-impacting factors, managers can better plan to mitigate those risks.

## Approach 2: country risk premium in the discount rate

This more common practice involves adding a "markup" or premium to the discount rate. The authors view it as a **secondary or triangulation tool** rather than a primary method.

**Methodology:**
- A country risk premium is added to the cost of capital calculated for comparable investments in developed markets.
- The resulting higher discount rate is then applied to "business as usual" cash flow projections.

**The book's stance.** It is a secondary tool because "there is no systematic method to calculate a country risk premium" and it often acts as a "black box" that provides less insight than explicit scenarios. The book warns that analysts often "double-count risk" by adding a country risk premium to the discount rate and then applying it to *expected* (probability-weighted) cash flows, which results in a valuation that is erroneously low.

## Handling inflation (real vs nominal)

Because inflation, interest rates, and exchange rates can fluctuate wildly, the most critical requirement is that "assumptions underlying estimates of future financial results in domestic or foreign currency and cost of capital must be consistent."

**Real vs. nominal cash flows and discount rates.** For companies in high-inflation environments, "historical analysis and forecasting should be carried out in both nominal and real (constant currency) terms whenever possible." Properly executed projections in either real or nominal terms should yield the same value, but each has specific utility:
- **Nominal projections** are necessary to calculate taxes correctly, as taxes are typically based on nominal financial statements. However, they are difficult for capital expenditures because the relationship between revenues and fixed assets distorts under high inflation.
- **Real projections** are better for understanding the true economics of the business and forecasting operating performance (EBITDA, capital turnover). The downside is that real-terms projections must explicitly model the cash flow effects of working capital changes, which do not automatically follow from simple balance sheet differences.

**Ensuring consistency.** To avoid valuation biases, the nominal and real WACC must be consistent with inflation assumptions via the identity:

> (1 + WACC_N) = (1 + WACC_R) × (1 + Inflation)

If sales forecasts assume 10 percent inflation but the cost of capital reflects only 5 percent inflation, "the resulting DCF value will be too high."

**Specific guidance for high-inflation environments.** The authors recommend a combined approach rather than choosing one over the other:
- **Use shorter time intervals:** under extreme inflation (e.g., above 25 percent per year), the assumption that cash flows occur at year-end distorts the valuation. Analysts should "split the year into quarterly or even monthly intervals, project cash flows for each interval, and discount the cash flows at the appropriate discount rate for that interval."
- **Monetary loss on working capital:** a common error in real-terms projections is failing to account for the loss of purchasing power on cash and receivables. "Real-terms investment in net working capital (NWC_R) is equal to the increase in working capital plus a monetary loss due to inflation."
- **Continuing value adjustments:** the standard value-driver formula must be adjusted when estimating continuing value in real terms, because real-terms projections overestimate economic returns if the company has positive net working capital. The formula must reflect the perpetuity assumptions for inflation (i) and the ratio of net working capital to invested capital (NWC_R/IC_R).
- **Extended forecast horizons:** high inflation affects the timing of depreciation and capital expenditures significantly, so analysts often need a "much longer horizon than for valuations with no or low inflation" to ensure the model reaches a steady state.

## Triangulation

The book recommends a triangulation approach, comparing estimates from three distinct methods to arrive at a "more robust understanding of the value":

1. **Scenario DCF approach (primary method):** the "prime valuation approach." Models risks directly in the cash flows via at least two scenarios ("business as usual" and downside), with the final value the probability-weighted average of the scenario DCF values.
2. **Country risk premium DCF (secondary method):** adds a country risk premium to the discount rate of a comparable developed-market investment, then applies that higher discount rate to "business as usual" cash flows. Secondary because there is no systematic method to calculate the premium and it acts as a "black box."
3. **Valuation by multiples (comparables):** a "best-practice multiples analysis" to check the DCF results. Analysts compare implied forward-looking multiples (like enterprise value to EBITDA) of the target against peer companies globally. In the ConsuCo case, if the implied multiple from the DCF is similar to that of international peers, it suggests that being domiciled in an emerging market "does not matter much for the relative pricing of its stock."

## Common pitfalls (from the book)

- **Double-counting risk:** a critical error where analysts "accounted for the probability of a crisis twice." The book warns: "Don't mix approaches. Use the cost of capital to discount the cash flows in a probability-weighted scenario approach. Do not add any risk premium, because you would be double-counting risk." This happens when a country risk premium is added to the discount rate and then applied to *expected* (already probability-weighted) cash flows.
- **Arbitrary adjustments:** practitioners often make "arbitrary adjustments based on intuition" rather than grounded economic evidence, such as assuming a 5 percent country risk premium that might imply an unrealistically high 70 percent probability of economic distress.
- **Inconsistent monetary assumptions:** failing to ensure that "assumptions underlying estimates of future financial results in domestic or foreign currency and cost of capital must be consistent." Using high-inflation sales forecasts with low-inflation discount rates makes the DCF value too high.
- **Relying on sovereign spreads uncritically:** analysts often set the country risk premium equal to the sovereign bond spread. This is only reasonable if the corporation's cash flows "move closely in line with the payments on government bonds," which is often not true for sectors like consumer goods.

## How this modifies the standard workflow

- Build the DCF as a probability-weighted set of scenarios ("business as usual" plus at least one downside that captures country/macroeconomic/political crisis), and treat that scenario DCF as the prime valuation. Country risk is reflected in expected cash flows, not in the discount rate.
- Keep the cost of capital free of an added country risk premium when using the scenario approach, to avoid double-counting.
- Do historical analysis and forecasting in both nominal and real terms where possible; enforce inflation consistency between cash flows and WACC via (1 + WACC_N) = (1 + WACC_R) × (1 + Inflation).
- Under extreme inflation, shorten discounting intervals (quarterly/monthly), model the monetary loss on net working capital, adjust the continuing-value formula for real-terms returns, and extend the forecast horizon to reach steady state.
- Triangulate the result against a separate country-risk-premium DCF (applied to "business as usual" cash flows) and a best-practice multiples analysis versus global peers.
