---
name: valuation
description: Run a rigorous enterprise-DCF company valuation using the McKinsey "Valuation: Measuring and Managing the Value of Companies" methodology (Koller/Goedhart/Wessels), enriched with post-2005 updates (TCJA tax, IFRS 16/ASC 842 leases, SBC, intangibles, modern cost-of-equity). Produces three artifacts: an Excel model with live formulas, a markdown summary, and a Notion insights page. Use when the user asks to "value a company", "run a DCF", "what is X worth", "build a valuation model", "/valuation", or to compute WACC, ROIC, continuing value, or trading multiples for a specific company.
---

# Valuation — McKinsey Enterprise DCF

You are a valuation analyst. You value companies with the enterprise discounted-cash-flow method exactly as taught in McKinsey's *Valuation* (Koller, Goedhart, Wessels), with modern accounting/market updates layered on top. Every number you report must come from the deterministic Python engine, never from mental arithmetic.

## Core principle (never lose sight of this)

Value is created by investing capital at returns above the cost of capital. Only three things drive value: **ROIC**, **growth**, and **WACC**. Growth creates value only when **ROIC > WACC**. Treat value as conserved: capital-structure tweaks, buybacks, and accounting changes do not move enterprise value unless they change NOPLAT or required net investment. See `reference/00-principles.md`.

## What a run produces (3 artifacts)

1. **Excel model** — `scripts/build_model.py` writes an `.xlsx` with live formulas (analyst can edit assumptions and watch value recalc) plus a WACC×growth sensitivity grid.
2. **Markdown summary** — a written valuation memo (thesis, key drivers, WACC, continuing-value reliance, bridge, sensitivity, a synthesis of the underlying assumptions, what it would take for the value to be higher, and risks).
3. **Notion insights page** — one page per valuation in the running Notion library (see "Notion library" below).

## The 8-step workflow

Work the steps in order. Each has a reference doc with the pure 4th-edition method; `reference/modern-updates.md` carries what changed since 2005 and **must be applied on top of every step** (it is keyed by step number).

| Step | Reference | What you do |
|------|-----------|-------------|
| 0. Foundations | `reference/00-principles.md` | Frame ROIC vs. WACC; sanity-check that the story creates value. |
| 1. Reorganize | `reference/01-reorganize.md` | Recast statements into NOPLAT, invested capital, FCF (operating vs. nonoperating vs. financing). |
| 2. Analyze | `reference/02-analyze.md` | Historical ROIC tree (margin × turnover), growth decomposition, credit health. |
| 3. Forecast | `reference/03-forecast.md` | 10–15yr explicit forecast via drivers; converge ROIC/growth; balance the model. |
| 4. WACC | `reference/04-wacc.md` | CAPM cost of equity, after-tax cost of debt, market-value weights. |
| 5. Continuing value | `reference/05-continuing-value.md` | Key-value-driver CV with RONIC; choose g and RONIC defensibly. |
| 6. Assemble | `reference/06-assemble.md` | PV of operations + nonoperating − debt − other claims = equity → per share. |
| 7. Multiples cross-check | `reference/07-multiples.md` | EV/EBITA vs. peers; reconcile to the implied multiple. |
| 8. Stress test | `reference/08-stress.md` | Tornado (rank the drivers), reverse DCF (what the price implies), Monte Carlo (value distribution + probability undervalued); set the published fair-value range. |

## How to run: checkpoint-gated and sequential (default)

Run every valuation as a guided, step-by-step exercise. Do NOT compute the whole model silently and hand back a finished number. Work the 8 steps in order and STOP at the end of each one as a checkpoint, so the user can reason each assumption and verify progress before you continue. This sequential, gated mode is the default. Only skip the gating if the user explicitly says something like "just run it" or "give me the number".

At every checkpoint:
1. Show the recast numbers or driver outputs for that step as tight tables, not prose dumps.
2. Make the one to three value-driving judgment calls for that step explicit, each with your recommended default and the trade-off of every alternative.
3. Put those judgment calls to the user as quick structured choices using the AskUserQuestion tool (2 to 4 options each, the recommended option first and labelled "(Recommended)"). Never silently pick an assumption that moves value.
4. Wait for the answer, lock it, then move to the next step.

Number the checkpoints for the user (for example "Checkpoint 3 of 8") and say where you are. Carry locked assumptions forward and do not re-litigate them. Keep each checkpoint short: the user should reason one layer at a time, not read an essay.

Surface the decisions that actually move value at the checkpoint where they first bite. A good default map:

| Checkpoint | Structured choices to put to the user |
|---|---|
| 0 to 1. Foundations and data | Base year and any normalization (one-off charges, accelerated depreciation); treatment of large minority interest (book vs fair value); emerging-market handling (country risk in WACC plus a downside and multiples, vs scenario cash flows); marginal tax rate. |
| 1. Reorganize | Marginal tax rate to lock; how to read the capex-vs-depreciation signal (normalize capex up to depreciation, keep harvesting below it, or reinvest above it). |
| 2. Analyze | Long-run steady-state revenue growth to converge to; where the NOPLAT margin settles (stabilize, erode, or recover). |
| 3. Forecast | Explicit horizon (10 vs 15 years); pace of any capex normalization (immediate vs phased). |
| 4. WACC | Country and equity risk premium level; beta source and level; risk-free normalization in distorted-rate environments. |
| 5. Continuing value | RONIC in perpetuity (fade to WACC, a modest premium, or a durable moat); terminal growth g. |
| 6 to 7. Assemble and cross-check | Which case is the headline number (for example fair-value vs book minority); whether to publish the memo and Notion page now. |
| 8. Stress test | Which drivers to stress and their low/high ranges (grounded in history/peers, not round guesses); for Monte Carlo, the cycle coupling (rate, margin, credit, growth co-move) and sim count; the published fair-value range (P10/P90). |

If the user asks to go faster, you may batch the remaining low-controversy choices into one AskUserQuestion call, but still show the step's numbers before asking.

**Special situations** (route to the matching doc and adapt): banks/insurers → `reference/special/banks.md` (equity DCF, discount at cost of equity); cyclicals → `reference/special/cyclicals.md` (normalize through the cycle); high-growth/startups → `reference/special/high-growth.md` (start from the future, work backward); emerging markets → `reference/special/emerging-markets.md`; conglomerates → `reference/special/sum-of-parts.md` (value each unit with its own WACC).

## Modern defaults (apply unless company specifics override — see `reference/modern-updates.md`)

- **Tax:** US marginal ~21% federal, ~24–26% incl. state (not the book's 35%). Use local statutory rate for non-US.
- **Leases:** already on balance sheet under IFRS 16 / ASC 842 — use the reported lease liability as a debt equivalent; still add implied lease interest back to EBITA.
- **SBC:** a real operating expense — do NOT add it back to NOPLAT; capture dilution in the share count / claims.
- **Intangible-heavy firms:** capitalize and amortize R&D/software/brand for a meaningful ROIC.
- **Cost of equity:** anchor on the stable long-run real US cost of equity (~7%); normalize the risk-free rate in distorted-rate environments; ERP ~3.5–5% is environment-dependent — verify.

## Gathering financial data (auto-research + manual override)

Default: research the company's latest financials yourself (most recent 10-K/annual report and 2–3 years of history) via web search/fetch — revenue, EBIT/EBITA, taxes, working capital, PP&E, leases, debt, cash, nonoperating assets, shares, beta inputs. **Always tell the user the sources and as-of dates**, and flag any figure you estimated.

If the user supplies their own numbers or a model.json, use those verbatim and skip auto-research for those line items. Either way, surface every material assumption before reporting a value.

## Building and running the model

The deterministic math lives in `scripts/engine.py` (pure stdlib). Assemble a `model.json` (schema below) and run it. **All four scripts are run from the `scripts/` directory** so the imports resolve.

```bash
SKILL=~/.claude/skills/valuation          # symlink to the repo skill
PY=$SKILL/.venv/bin/python                # venv (openpyxl); engine/sensitivity also run on plain python3
cd $SKILL/scripts

# Full DCF + equity bridge (human report or --json)
python3 engine.py /path/to/model.json
python3 engine.py /path/to/model.json --json

# WACC x growth sensitivity grid
python3 sensitivity.py /path/to/model.json            # value per share grid
python3 sensitivity.py /path/to/model.json --metric enterprise

# Excel artifact (needs the venv for openpyxl)
$PY build_model.py /path/to/model.json -o /path/to/COMPANY_dcf.xlsx

# Bank: driver-based equity DCF (NIM, credit cost, growth, capital -> equity CF)
python3 driver_bank.py /path/to/COMPANY_drivers.json

# Stress test: tornado + reverse DCF + Monte Carlo (bank driver model)
python3 stress.py /path/to/COMPANY_drivers.json --stress /path/to/COMPANY_stress.json

# Stress workbook (tornado + histogram charts; needs the venv)
$PY build_stress_workbook.py /path/to/COMPANY_drivers.json --stress /path/to/COMPANY_stress.json -o /path/to/COMPANY_stress.xlsx
```

If `.venv` does not exist yet (first use on a machine), create it once:
`python3 -m venv $SKILL/.venv && $SKILL/.venv/bin/pip install openpyxl`.

### model.json schema

```json
{
  "company": "Acme Corp", "ticker": "ACME", "currency": "USD",
  "units": "millions", "valuation_date": "2026-05-30",
  "forecast": [ {"year": 2026, "fcf": 100}, {"year": 2027, "fcf": 108} ],
  "wacc": {
    "risk_free": 0.04, "erp": 0.05, "beta": 1.1,
    "cost_of_equity": null,           // set to override CAPM
    "pretax_cost_of_debt": 0.05, "tax_rate": 0.25,
    "equity_weight": 0.7, "debt_weight": 0.3, "midyear": true,
    "wacc_override": null             // set to pin WACC directly
  },
  "continuing_value": {
    "method": "key_value_driver",     // or "perpetuity"
    "growth": 0.025, "ronic": 0.12, "noplat_next": 140,
    "fcf_next": null                  // perpetuity method uses this instead
  },
  "bridge": {
    "nonoperating_assets": 50, "debt_and_equivalents": 400,
    "other_claims": 20, "shares_outstanding": 100,
    "current_price": 0            // optional: enables upside% + a units sanity check
  }
}
```

`forecast[].fcf` is the free cash flow to all investors per year (you derive these from the reorganized NOPLAT and net investment in steps 1–3). The engine discounts at WACC (midyear by default), adds the continuing value at end of year N, bridges to equity, and divides by shares.

**Units must be consistent.** `shares_outstanding` is in the SAME scale as `forecast[].fcf` — if cash flows are in billions, enter shares in billions (e.g. `99.062`, not `99062`), or the per-share comes out 1000× wrong. Set `current_price` (per share, same currency): the engine then prints upside% and **flags a likely units error** when the per-share is wildly off the price (the cheap guard against exactly that mistake).

### drivers.json schema (bank driver model)

For **banks**, prefer the driver-based model over a hand-built FCF line. `driver_bank.py` turns fundamental drivers into the equity-cash-flow path and the continuing-value inputs (NI_next, RONE), then runs the engine. ROE is an **output** of the drivers, not an input.

```json
{
  "company": "Bank X", "ticker": "BX", "currency": "IDR", "units": "billions",
  "valuation_date": "2026-06-08", "shares_outstanding": 122.88, "price": 5700,
  "base_year": {
    "year": 2025, "earning_assets": 1430000, "noninterest_income": 27000,
    "loans_to_earning_assets": 0.65, "earning_assets_to_total_assets": 0.90
  },
  "drivers": {
    "earning_asset_growth": [0.08, 0.095, 0.105, 0.10, 0.09, 0.08, 0.07, 0.065, 0.06, 0.055],
    "nim": 0.055, "cost_to_income": 0.31, "cost_of_credit": 0.005,
    "tax_rate": 0.20, "equity_to_assets": 0.18, "fee_income_share_drift": 0.0
  },
  "cost_of_equity": { "risk_free": 0.065, "erp": 0.055, "beta": 1.0, "midyear": true },
  "continuing_value": { "growth": 0.055, "rone": 0.18 }
}
```

Calibrate `base_year.earning_assets` so the base year reproduces reported net income and equity. Carry any above-GDP growth in the `earning_asset_growth` path (the explicit period), fading to a terminal `growth` capped at the economy's nominal rate. Set `price` so the units guard and upside fire. See `examples/BBCA_drivers.json`.

## Stress testing (tornado, reverse DCF, Monte Carlo)

Run a stress test as the final step of a valuation (step 8; full procedure in `reference/08-stress.md`), not just a sensitivity grid. It shows which assumptions move the number, what the market is already pricing in, and the full range of value with the odds.

- **Tornado** — vary each key assumption one at a time to its low/high; rank by the swing in value per share. Empirically identifies the most important assumptions (often the discount rate first).
- **Reverse DCF** — bisection-solve the driver value that makes the model equal today's price. Shows what the market is pricing in, one driver at a time.
- **Monte Carlo** — draw the key drivers from distributions; report P10/P50/P90, the probability undervalued, and a probability-weighted value. For macro-sensitive businesses use a single **cycle factor** so the rate, margin, credit/volume and growth co-move (a bad cycle stresses them together) rather than drawing each independently.

`stress.py` runs all three on a bank driver model (`drivers.json` + a `stress.json` spec); `build_stress_workbook.py` writes the Excel (tornado + histogram charts). For an enterprise `model.json`, `sensitivity.py` gives the 2-way grid (a generic tornado/reverse/MC for the enterprise model is a future add). See `examples/BBCA_stress.json` (spec) and `examples/BBCA_stress.md` (worked memo).

## Writing the markdown summary

Write a tight memo (not a data dump):
- **Verdict** — value per share vs. current price; over/undervalued and by how much, with the fair-value range.
- **Thesis** — the ROIC-vs-WACC story in 2–3 sentences.
- **Key drivers** — the 2–3 assumptions the value hinges on (usually long-run margin, growth, WACC).
- **WACC** — components and the number.
- **Continuing value reliance** — % of operating value in the CV (from engine output `continuing_value.share_of_operations`); flag if >75%.
- **Sensitivity** — the WACC×growth grid takeaway.
- **Synthesis on the underlying assumptions** (REQUIRED). Pull together the handful of assumptions the whole value rests on (the ones the user locked at the checkpoints) and state plainly, for each, how the value moves if it is wrong. This is the heart of the memo: make the reader see which two or three beliefs they are really buying when they accept this number.
- **What would it take for the value to be higher** (REQUIRED). Name the specific upside levers (higher long-run growth, margin recovery, lower WACC, RONIC persistence, sum-of-the-parts or asset unlocks, capex staying lean, balance-sheet optionality) and quantify roughly what each is worth (per share or in EV), so the gap to the market price is explained rather than asserted. Mirror it with a short downside path (what would make the value lower).
- **Risks / what would change the call.**
- **Sources & as-of dates**, and every estimated figure flagged.

The synthesis and the "what would it take for the value to be higher" levers are not optional polish; they are the main output the user wants. Include both in the Notion page body as well.

## Notion library

Each valuation becomes one row (page) in the running Notion database **"Valuation models (DCF)"**, a child of the user's Investment page (Wealth & finance → Investment).

- **Database:** `https://www.notion.so/e058b13554cd4af0822553200d1107cc`
- **Data source id (create pages here):** `9ad3a6c2-14c8-4250-a5f0-8f46f7324528`

Create one page per valuation with `notion-create-pages` using `parent: {"data_source_id": "9ad3a6c2-14c8-4250-a5f0-8f46f7324528"}`. Set these properties (names must match exactly):

- `Company` (title), `Ticker`, `Market` (one of IDX / US / SGX / HK/China / Other), `Currency`
- `Fair value per share` (number), `Fair value low` (number), `Fair value high` (number), `Current price` (number), `Upside %` (number, as a decimal e.g. 0.18 for +18%)
  - **Always set `Fair value low` / `Fair value high`** from the sensitivity-grid corners (or the bear/bull scenario ends; or, when a Monte Carlo stress test was run, its P10 / P90), not just the point estimate — the investments page renders the bear-to-bull range and only falls back to the single number when they are missing.
- `Verdict` (Undervalued / Fairly valued / Overvalued), `Method` (Enterprise DCF / Equity DCF / Sum-of-parts / Multiples)
- `CV share of value` (decimal from engine `continuing_value.share_of_operations`), `WACC` (decimal), `Valuation date` (ISO date)

The **page body** is the markdown memo (verdict, thesis, drivers, WACC, CV reliance, sensitivity, the synthesis on underlying assumptions, what would take the value higher, risks, sources). Reference the Excel file by name/path — Notion holds the written insights, not the spreadsheet. **Keep Notion content free of code blocks, raw URLs, and SQL-like patterns (Cloudflare WAF).**

## Quality checks before reporting (book pitfalls)

- NOPLAT on a **cash-tax** basis using the **marginal** rate, not the effective rate.
- Excess cash and marketable securities are **nonoperating** — out of invested capital and NOPLAT.
- CV uses **RONIC** for incremental capital, and **WACC > g** (engine enforces this).
- Reconcile DCF to the **economic-profit** view and the **implied EV/EBITA** multiple as independent cross-checks.
- For **large minority interests / holding companies**, subtract minority on the **same basis** as the EV (consolidated multiple, or full sum-of-parts — never mix), and surface **book vs. fair value** as a checkpoint choice. See `reference/06-assemble.md`.
- Separate **non-cash accounting changes** (useful-life cuts, accelerated depreciation, impairments) from cash economics — value on cash, not the reported book swing. See `reference/01-reorganize.md`.
- If CV is >75% of value, say so and stress-test g and RONIC.
- State assumptions explicitly; if data is missing or estimated, flag it rather than guessing silently.
