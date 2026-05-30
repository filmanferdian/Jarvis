---
description: Run just the WACC step of the McKinsey valuation workflow — compute a company's cost of equity (CAPM), after-tax cost of debt, and weighted average cost of capital with market-value weights. Standalone step from the valuation skill.
---

Run the **WACC** step (Step 4) of the valuation skill for the company the user provides.

1. Read `~/.claude/skills/valuation/reference/04-wacc.md` for the method and `~/.claude/skills/valuation/reference/modern-updates.md` for the cost-of-equity overlay (anchor on the stable ~7% long-run real US cost of equity; normalize the risk-free rate in distorted-rate environments; ERP ~3.5–5% is environment-dependent — verify; tax ~21%/~24–26%).
2. Gather inputs: risk-free rate, ERP, levered beta (unlever/relever to target capital structure if needed), pre-tax cost of debt, marginal tax rate, and market-value equity/debt weights. Research and cite sources + as-of dates, or use the user's inputs.
3. Compute with `~/.claude/skills/valuation/scripts/engine.py` — `cost_of_equity_capm`, `wacc`, `unlever_beta`, `relever_beta`. Never compute by hand.
4. Report ke, after-tax kd, weights, and WACC, with the midyear-discounting note. State assumptions and flag estimates.
