---
description: Run just the Forecast step of the McKinsey valuation workflow — build a 10–15 year driver-based forecast of NOPLAT, invested capital, and free cash flow with ROIC/growth convergence. Standalone step from the valuation skill.
---

Run the **Forecast** step (Step 3) of the valuation skill for the company the user provides.

1. Read `~/.claude/skills/valuation/reference/03-forecast.md` for the method and `~/.claude/skills/valuation/reference/modern-updates.md` (digital/network-effect businesses: longer advantage periods only with evidence; capitalize customer-acquisition/R&D).
2. Build the forecast from drivers (revenue growth, operating margin, capital turnover) for a 10–15 year explicit horizon. Converge ROIC toward a defensible long-run level and growth toward a sustainable rate by the end of the horizon. Balance the model (statements tie out).
3. Output a year-by-year FCF series in the `forecast` array shape the engine expects (`[{"year": Y, "fcf": F}, ...]`), so it can feed straight into the full DCF.
4. State every driver assumption explicitly and flag estimates. For cyclicals/high-growth, route to `reference/special/cyclicals.md` or `reference/special/high-growth.md`.
