---
description: Run just the Analyze step of the McKinsey valuation workflow — decompose historical ROIC (margin × capital turnover), revenue growth, and credit health for a company. Standalone step from the valuation skill.
---

Run the **Analyze** step (Step 2) of the valuation skill for the company or reorganized financials the user provides.

1. Read `~/.claude/skills/valuation/reference/02-analyze.md` for the method and `~/.claude/skills/valuation/reference/modern-updates.md` for overlays (capitalize R&D/software/brand for intangible-heavy firms so ROIC is meaningful).
2. If statements aren't already reorganized, run the Reorganize logic first (`reference/01-reorganize.md`) — Analyze needs NOPLAT and invested capital.
3. Produce the ROIC tree: ROIC = (1 − T) × (EBITA/Revenue) × (Revenue/Invested Capital) = after-tax operating margin × capital turnover. Decompose revenue growth and review credit-health ratios. Use `~/.claude/skills/valuation/scripts/engine.py` (`roic_tree`, `roic`) for the math.
4. Interpret: what is driving returns (price premium, cost, capital efficiency), is the ROIC > WACC, and is it sustainable. Flag estimates and sources.
