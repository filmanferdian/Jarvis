# Modern Updates — Applying McKinsey Valuation Today (post-4th-edition layer)

> The 4th edition is circa 2005. This file captures what has changed since, so the framework can be applied with current accounting standards, tax law, and market parameters. Load this ALONGSIDE the step reference docs (`00`–`07`). Each item is tagged with what changed, how to apply it, and a source.
> The latest published edition of the book is the 7th (2020). The DCF framework itself (reorganize → analyze → forecast → WACC → continuing value → assemble → cross-check) is unchanged; what moved is accounting inputs, tax law, and market parameters.

---

## Step 1 — Reorganization & Step 4 — Cost of debt: Corporate tax reform

**What changed since the 4th ed:** The US Tax Cuts and Jobs Act (TCJA) cut the federal corporate income tax rate from 35% to a flat **21%**, effective for tax years beginning after Dec 31, 2017 (i.e. 2018). The cut is permanent (unlike the individual provisions). It also introduced GILTI and BEAT for multinationals.

**How to apply:**
- Use a **marginal tax rate around 21% federal (+ state)** for the operating-tax adjustment in NOPLAT and for the after-tax cost of debt — not the book's 35%-era examples. A blended US marginal rate of ~24–26% (federal + state) is a common working assumption; verify the company's actual jurisdiction mix.
- Watch deferred-tax remeasurement in the 2017–2018 transition years if you analyze that history (one-time distortions).
- For non-US companies, use the local statutory marginal rate.

**Source:** IRS / Tax Cuts and Jobs Act of 2017 (P.L. 115-97); rate codified in IRC §11.

---

## Step 1 — Reorganization & Step 6 — Debt bridge: Lease accounting (IFRS 16 / ASC 842)

**What changed since the 4th ed:** The 4th ed treated operating leases as **off-balance-sheet** and required the analyst to capitalize them manually. Under **IFRS 16** (effective annual periods beginning on/after 1 Jan 2019) and **US ASC 842** (effective public-company fiscal years beginning after 15 Dec 2018; private companies 2022), most leases are now ON the balance sheet as a **right-of-use (ROU) asset** and a **lease liability**.

**How to apply:**
- The manual capitalization the book describes is now largely done by the issuer. Use the reported **lease liability** as the debt equivalent in the equity bridge (Step 6) and include the ROU asset in invested capital (Step 1).
- Still **add the implied interest portion of lease expense back to EBITA** so NOPLAT and the cost of capital are on a consistent (lease-as-debt) basis — the economic logic in the book is intact.
- Under US GAAP, finance vs. operating leases are presented differently (operating-lease expense is a single line); reconstruct the interest/depreciation split if needed.

**Source:** IFRS Foundation, IFRS 16 *Leases*; FASB ASC 842 *Leases*.

---

## Step 1 — NOPLAT & Step 6 — Claims: Stock-based compensation (SBC)

**What changed since the 4th ed:** Mandatory expensing of stock-based compensation (US FAS 123R) took effect in 2006, after the 4th ed. SBC is now a large, recurring expense at tech and growth firms, and companies routinely add it back in "adjusted" / non-GAAP metrics.

**How to apply:**
- Treat SBC as a **real economic operating expense** — do NOT add it back to NOPLAT the way you add back depreciation. Compensation paid in stock is still compensation.
- Capture the **dilution** from outstanding and expected future grants in the share count or as a nonequity claim in the bridge (Step 6), so you don't double-benefit (expense ignored AND dilution ignored).
- Be skeptical of company "adjusted EBITDA" that excludes SBC.

**Source:** FASB FAS 123(R) / ASC 718; McKinsey, *Valuation* 7th ed., discussion of employee stock options and SBC.

---

## Steps 1–2 — ROIC: Capitalizing intangible investment (R&D, software, brand)

**What changed since the 4th ed:** A rising share of corporate investment is **intangible** (R&D, software, customer acquisition, brand) and is expensed under GAAP rather than capitalized. For intangible-heavy firms this understates invested capital and distorts ROIC and margins, making the raw numbers hard to compare across time and peers.

**How to apply:**
- For R&D/software/brand-intensive companies, **capitalize and amortize** the key intangible investments when computing invested capital and ROIC (Steps 1–2), so the ROIC tree reflects the real capital base.
- Be consistent: if you capitalize R&D into invested capital, add back the period R&D expense and subtract amortization in NOPLAT.
- Disclose the adjustment — it materially changes ROIC for these firms.

**Source:** McKinsey, *Valuation* 7th ed.; McKinsey on Finance, analyses of intangibles and ROIC. (Approach is best-practice guidance; calibrate the amortization life to the asset.)

---

## Step 4 — WACC: Equity risk premium & the risk-free rate

**What changed since the 4th ed:** The 4th ed recommended an equity risk premium (ERP) of **4.5%–5.5%** applied to the spot 10-year government rate. McKinsey's current guidance reframes this: the **real (inflation-adjusted) cost of equity has been remarkably stable at about 7% in the US** (≈6% UK) since the 1960s, and the **risk-free rate and ERP move inversely** — so mechanically multiplying a depressed spot risk-free rate by a fixed 5% ERP understates the cost of equity.

**How to apply:**
- **Anchor on the stable long-run real cost of equity (~7% US nominal-equivalent)** and back into a consistent ERP, rather than fixing the ERP and reading the spot risk-free rate. In low-rate environments, **normalize the risk-free rate** (use a long-run/normalized yield, not a distorted spot yield).
- In the environment McKinsey analyzed, a normalized real bond yield of ~3% implied an **ERP of roughly 3.5%–4%** and a cost of equity for a typical company of ~8.5%–11%. The precise ERP is environment-dependent — **verify the current figure** against McKinsey's latest "cost of equity" guidance before locking it in.
- Sanity-check: a ~5%–6% historical ERP is still a reasonable cross-check on the level of total cost of equity.

**Source:** McKinsey, ["The real cost of equity"](https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/the-real-cost-of-equity) and ["Markets versus textbooks: Calculating today's cost of equity"](https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/markets-versus-textbooks-calculating-todays-cost-of-equity); *Valuation* 7th ed., Ch. on cost of capital.

---

## Step 3 — Forecast & special/high-growth: Digital, platform & network-effect businesses

**What changed since the 4th ed:** Later editions expanded guidance for digital, platform, and network-effect businesses, where returns can be **more durable** (winner-take-most dynamics) but starting financials are tiny or negative.

**How to apply:**
- The book's **"start from the future, work backward"** method (see `special/high-growth.md`) still applies: size the mature market, set a plausible long-run share/margin/ROIC, then back-cast.
- Allow for **longer competitive-advantage periods** where genuine network effects or switching costs exist — but justify durability with evidence, don't assume it.
- Capitalize the customer-acquisition / R&D "investment" that GAAP expenses (see intangibles item) so early-stage ROIC isn't meaningless.

**Source:** McKinsey, *Valuation* 7th ed., chapters on high-growth and (in later editions) digital businesses.

---

## All steps (light touch) — ESG / sustainability

**What changed since the 4th ed:** McKinsey's position is that social responsibility and value creation are **compatible**, not opposed. ESG factors are not a separate valuation axis — they act **through cash flows and the cost of capital**.

**How to apply:** Reflect material ESG factors where they actually hit the model — revenue growth, margins, capex, regulatory/litigation risk, and (occasionally) the risk premium — rather than bolting on a separate "ESG adjustment." If it doesn't change expected cash flows or risk, by conservation of value it doesn't change value.

**Source:** McKinsey, "Five ways that ESG creates value" (McKinsey Quarterly); *Valuation* 7th ed.

---

## Quick reference — modern defaults to use unless company specifics say otherwise

| Input | 4th-ed era | Modern default (verify per company) |
|-------|-----------|-------------------------------------|
| US marginal tax rate | ~35–39% | ~21% federal; ~24–26% incl. state |
| Equity risk premium | 4.5–5.5% on spot rf | Anchor on ~7% real US cost of equity; normalize rf; ERP ~3.5–5% env-dependent (verify) |
| Operating leases | manually capitalize (off-B/S) | already on B/S (IFRS 16 / ASC 842); use reported lease liability |
| Stock-based comp | option claim via option pricing | real expense in NOPLAT + dilution in claims |
| Intangible-heavy ROIC | as reported | capitalize & amortize R&D/software/brand |
