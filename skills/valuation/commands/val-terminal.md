---
description: Run just the Continuing Value step of the McKinsey valuation workflow — compute terminal value via the key-value-driver formula (RONIC form) and stress-test the long-run growth and return assumptions. Standalone step from the valuation skill.
---

Run the **Continuing Value** step (Step 5) of the valuation skill for the company the user provides.

1. Read `~/.claude/skills/valuation/reference/05-continuing-value.md` for the method and `~/.claude/skills/valuation/reference/modern-updates.md` for overlays.
2. Use the **key value driver** form: CV_N = NOPLAT_{N+1} × (1 − g/RONIC) / (WACC − g). Choose g (≤ long-run GDP-ish, must be < WACC) and RONIC defensibly — RONIC often trends toward WACC as competition erodes advantage. The perpetuity form (FCF_{N+1}/(WACC − g)) is the fallback.
3. Compute with `~/.claude/skills/valuation/scripts/engine.py` — `continuing_value_kvd` or `continuing_value_perpetuity`. Never compute by hand.
4. Report the undiscounted CV, its PV, and — critically — its **share of total operating value**. If it exceeds ~75%, say so and stress-test g and RONIC. State assumptions and flag estimates.
