# Special Situation — Valuing Cyclical Companies (McKinsey Valuation, 4th ed., Ch 24)

> Pure 4th-edition book methodology, extracted via NotebookLM.

## When to use this

Use this approach for companies in cyclical industries such as **steel, airlines, paper, and chemicals**, whose earnings show a **"repeating pattern of significant increases and decreases"** that is primarily driven by large changes in product prices.

## The core challenge

The core challenge is that earnings swing with the cycle, so **"historical performance must be assessed in context of the cycle."** A recent decline may simply be a shift in the cycle rather than a long-term negative trend.

A single-point forecast misleads because:

- A single earnings forecast is "almost certain to be wrong" in a cyclical context.
- Consensus earnings forecasts for cyclical companies often **"ignore cyclicality entirely,"** projecting a constant upward-sloping trend regardless of whether the company is at a peak or a trough.
- Except for the immediate year following a trough, these projections typically **"do not even acknowledge the existence of a cycle"** ("zero-foresight" forecasts). Empirical evidence was drawn from 36 U.S. companies.
- The behavior is attributed to incentives: pessimistic forecasts might damage an investment bank's relationship with a company or cause management to cut off an analyst's access.

## Recommended approach

<normalize through the cycle; scenario / probability-weighted DCF>

The book recommends a **"multiple-scenario probabilistic approach,"** which **"avoids the traps of a single forecast."** Rather than predicting specific cycle inflection points, focus on the **"long-term trend line"** of the business.

Build at least two scenarios:

1. **Normal cycle scenario** — based on historical patterns and the long-term trend line, constructed using information about **past cycles**.
2. **New trend-line scenario** — based on recent performance, accounting for the possibility that the company is **"breaking out of the old cycle"** to establish a new level of long-term profitability.

Then **"assign probabilities to the scenarios, and calculate a weighted value"** (the probability-weighted average of the resulting DCF values). Over the long run **"the high cash flows cancel out the low cash flows,"** reflecting how a "smart" market should value these firms.

## Building the forecast

The book recommends a four-step approach:

1. **Construct and value a "normal cycle" scenario.** Use information about **past cycles**. Pay the most attention to the **"long-term trend lines of operating profits, cash flow, and ROIC,"** as these have the largest impact on the final valuation.
2. **Construct and value a "new trend-line" scenario.** Based on **recent performance**, accounting for the company "breaking out of the old cycle" to a new level of profitability.
3. **Develop the economic rationale for each scenario.** Analyze underlying drivers such as **demand growth, the entry or exit of competitors,** and **technological changes** that could affect the supply-and-demand balance.
4. **Assign probabilities and calculate a weighted value.** Assign a likelihood to each scenario based on its economic rationale and calculate the **probability-weighted average** of the DCF values.

Reverting to a long-run normalized level:

- Do not worry about modeling every future up and down of the cycle; focus on the **long-term trend lines**, because in a DCF model the high cash flows at the peak eventually cancel out the low cash flows at the trough.
- **Make sure the continuing value is based on a normalized level of profits** — **"a point on the company's long-term cash flow trend line, not a peak or trough."**

Handling the explicit forecast period:

- Bridge the company's current cyclical position to the long-term trend line. If the company is currently at a trough, the forecast should acknowledge that performance is likely to improve as the cycle returns to normal, rather than showing a flat or declining trend.
- For the DCF valuation itself, focusing on the trend line is sufficient, since the specific timing of future cycles has a relatively small impact on total present value. (Future cyclicality still matters for checking financial solvency.)

## Common pitfalls (from the book)

- **The single-point forecast trap** — relying on one earnings forecast, which is almost certain to be wrong in a cyclical context.
- **"Zero-foresight" forecasts** — projecting a constant upward-sloping trend that ignores cyclicality entirely.
- **Naive extrapolation** — assuming that a peak or trough represents a new long-term trend line; a recent decline should be assessed in the context of the cycle, not viewed as a "long-term negative trend."
- **Continuing value errors** — basing continuing value on a peak or trough rather than a **"normalized level of profits"** on the long-term trend line.

How the market and managers actually behave:

- **The market's "blended path"** — the stock market appears smarter than consensus forecasts but lacks perfect foresight. If investors followed "zero-foresight" forecasts, share prices would overreact to every cyclical move. Empirical tests suggest the market follows a **"blended path"** between perfect and zero foresight, modeled as roughly a **"50/50 path"** of those two extremes.
- **Supply as the driver** — in industries like commodity chemicals, profit cyclicality is often caused by **"producer supply"** rather than customer demand: companies collectively invest when prices are high, but **"capacity comes on line in very large chunks,"** so utilization plunges and prices fall.
- **Herding behavior** — managers invest when prices are high because cash is available and board approval is easier, sending confusing optimism signals to the market just before a downturn.
- **Decision guidance** — prioritize long-term trend lines; consider a **"contrarian view"** (expanding when the industry is gloomy), though the book notes this is extremely difficult; consider a **"trading approach"** (acquiring at the bottom, selling at the top); and consider issuing shares at the peak and repurchasing at the trough.

## How this modifies the standard workflow

- Replace the single base-case DCF with a **multiple-scenario probabilistic DCF** (at minimum a "normal cycle" and a "new trend-line" scenario), then probability-weight the resulting values.
- Build the forecast around **long-term trend lines of operating profits, cash flow, and ROIC** rather than modeling every cyclical up and down.
- Force the **continuing value to a normalized point on the long-term cash flow trend line**, never a peak or trough.
- Assess all historical performance **in the context of the cycle**, and ground each scenario in an explicit economic rationale (demand growth, competitor entry/exit, technological change).
