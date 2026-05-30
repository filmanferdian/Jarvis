---
description: Run just the Reorganize step of the McKinsey valuation workflow — recast a company's statements into NOPLAT, invested capital, and free cash flow (operating vs. nonoperating vs. financing). Standalone step from the valuation skill.
---

Run the **Reorganize** step (Step 1) of the valuation skill for the company or financials the user provides.

1. Read `~/.claude/skills/valuation/reference/01-reorganize.md` for the method and `~/.claude/skills/valuation/reference/modern-updates.md` for the Step 1 overlays (TCJA tax ~21%/~24–26%, IFRS 16/ASC 842 leases on balance sheet, SBC as real expense, intangibles capitalization).
2. If the user named a company without numbers, research the latest annual report (revenue, EBIT/EBITA, taxes, working capital, PP&E, leases, debt, cash, nonoperating assets) and state your sources + as-of dates. If they gave numbers, use those verbatim.
3. Produce: NOPLAT (cash-tax basis, marginal rate), invested capital (with and without goodwill), free cash flow, and the total-funds-invested reconciliation. Use `~/.claude/skills/valuation/scripts/engine.py` helpers (`noplat`, `roic`) for any arithmetic — never compute by hand.
4. Flag every estimated figure. This step feeds Steps 2–3; offer to continue into the full DCF (the `valuation` skill) if the user wants a value.
