---
description: Run just the Multiples cross-check step of the McKinsey valuation workflow — compute and benchmark EV/EBITA against peers and reconcile the multiple to fundamentals (ROIC, growth, WACC). Standalone step from the valuation skill.
---

Run the **Multiples cross-check** step (Step 7) of the valuation skill for the company the user provides.

1. Read `~/.claude/skills/valuation/reference/07-multiples.md` for the method and `~/.claude/skills/valuation/reference/modern-updates.md` for overlays.
2. Prefer **EV/EBITA** over P/E (it is capital-structure neutral and unaffected by goodwill amortization). Select peers with similar ROIC and growth, not just the same industry.
3. Reconcile multiple to fundamentals: V/EBITA = (1 − T)(1 − g/ROIC) / (WACC − g). Explain any gap between the company's implied multiple and peers' as a difference in ROIC, growth, or risk — not as mispricing by default.
4. If a DCF value already exists, report the **implied EV/EBITA** from that DCF and check it against the peer range as an independent sanity check. State assumptions and sources.
