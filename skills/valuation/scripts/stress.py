"""Stress test harness for the driver-based bank equity DCF.

Three techniques on the driver model (driver_bank.py):
  1. tornado      - vary each driver one at a time to its low/high; rank by the
                    swing in value per share. Shows which assumptions matter most.
  2. reverse DCF  - bisection-solve the value of each driver that makes the model
                    equal today's price. Shows what the market is pricing in.
  3. monte carlo  - a single cycle factor co-moves the rate, NIM, credit cost and
                    growth (a bad cycle lifts rates and provisions while cutting
                    growth), plus idiosyncratic noise per driver. Output the
                    distribution of value, percentiles, and probability undervalued.

Pure stdlib. Run from scripts/ so `import engine, driver_bank` resolve.

Usage:
    python stress.py <drivers.json> --stress <stress.json>
        [--n 10000] [--seed 42] [--json]
"""

from __future__ import annotations

import argparse
import copy
import json
import math
import random

import driver_bank
import engine


# --------------------------------------------------------------------------
# Core helpers
# --------------------------------------------------------------------------

def per_share(drivers: dict):
    """Value per share for a driver set, or None if the inputs are invalid."""
    try:
        return driver_bank.value_drivers(drivers)["value_per_share"]
    except (ValueError, ZeroDivisionError):
        return None


def set_driver(base: dict, key: str, value: float) -> dict:
    """Return a deep copy of `base` with one driver set to `value`."""
    d = copy.deepcopy(base)
    if key == "cost_of_equity":
        d["cost_of_equity"]["cost_of_equity_override"] = value
    elif key == "terminal_growth":
        d["continuing_value"]["growth"] = value
    elif key == "rone":
        d["continuing_value"]["rone"] = value
    elif key == "explicit_growth_peak":
        path = d["drivers"]["earning_asset_growth"]
        if isinstance(path, dict):
            path = path.get("base", path.get("path"))
        d["drivers"]["earning_asset_growth"] = driver_bank.scale_path_to_peak(path, value)
    elif key in ("nim", "cost_of_credit", "cost_to_income", "tax_rate",
                 "equity_to_assets", "fee_income_share_drift"):
        d["drivers"][key] = value
    else:
        raise KeyError(f"unknown driver key: {key}")
    return d


def _pct(sorted_vals: list, p: float) -> float:
    """Linear-interpolated percentile (p in 0..100) of a sorted list."""
    if not sorted_vals:
        return float("nan")
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    idx = (p / 100.0) * (len(sorted_vals) - 1)
    lo = int(math.floor(idx))
    hi = int(math.ceil(idx))
    if lo == hi:
        return sorted_vals[lo]
    frac = idx - lo
    return sorted_vals[lo] * (1 - frac) + sorted_vals[hi] * frac


# --------------------------------------------------------------------------
# 1. Tornado (one-at-a-time)
# --------------------------------------------------------------------------

def tornado(base: dict, ranges: dict) -> dict:
    base_val = per_share(base)
    rows = []
    for key, spec in ranges.items():
        lo_v = per_share(set_driver(base, key, spec["low"]))
        hi_v = per_share(set_driver(base, key, spec["high"]))
        vals = [v for v in (lo_v, hi_v) if v is not None]
        swing = (max(vals) - min(vals)) if len(vals) == 2 else 0.0
        rows.append({
            "key": key,
            "label": spec.get("label", key),
            "low_in": spec["low"],
            "base_in": spec.get("base"),
            "high_in": spec["high"],
            "low_val": lo_v,
            "high_val": hi_v,
            "swing": swing,
        })
    rows.sort(key=lambda r: r["swing"], reverse=True)
    return {"base_value": base_val, "rows": rows}


# --------------------------------------------------------------------------
# 2. Reverse DCF (bisection)
# --------------------------------------------------------------------------

def _bisect(f, lo: float, hi: float, tol: float = 0.5, iters: int = 200):
    flo = f(lo)
    fhi = f(hi)
    if flo is None or fhi is None:
        return None
    if (flo > 0) == (fhi > 0):
        return None  # no sign change in bracket
    for _ in range(iters):
        mid = (lo + hi) / 2.0
        fm = f(mid)
        if fm is None:
            return None
        if abs(fm) < tol or (hi - lo) < 1e-7:
            return mid
        if (fm > 0) == (flo > 0):
            lo, flo = mid, fm
        else:
            hi, fhi = mid, fm
    return (lo + hi) / 2.0


def reverse_dcf(base: dict, target_price: float, specs: dict) -> dict:
    rows = []
    base_inputs = {
        "cost_of_equity": base["cost_of_equity"]["risk_free"]
                          + base["cost_of_equity"].get("beta", 1.0)
                          * base["cost_of_equity"]["erp"],
        "terminal_growth": base["continuing_value"]["growth"],
        "rone": base["continuing_value"]["rone"],
        "nim": base["drivers"]["nim"],
        "cost_of_credit": base["drivers"]["cost_of_credit"],
        "explicit_growth_peak": max(
            base["drivers"]["earning_asset_growth"]
            if isinstance(base["drivers"]["earning_asset_growth"], list)
            else base["drivers"]["earning_asset_growth"]["base"]),
    }
    for key, spec in specs.items():
        f = lambda x, k=key: (
            None if (v := per_share(set_driver(base, k, x))) is None else v - target_price)
        implied = _bisect(f, spec["lo"], spec["hi"])
        row = {
            "key": key,
            "label": spec.get("label", key),
            "base_in": base_inputs.get(key),
            "implied": implied,
        }
        # bonus: ROE implied by the implied NIM
        if key == "nim" and implied is not None:
            d = set_driver(base, "nim", implied)
            row["implied_roe"] = driver_bank.build_forecast(d)["steady_state_roe"]
        rows.append(row)
    return {"target_price": target_price, "rows": rows}


# --------------------------------------------------------------------------
# 3. Monte Carlo (cycle factor + idiosyncratic noise)
# --------------------------------------------------------------------------

def _clamp(x, lo, hi):
    if lo is not None:
        x = max(lo, x)
    if hi is not None:
        x = min(hi, x)
    return x


def monte_carlo(base: dict, cfg: dict, n: int = 10000, seed: int = 42) -> dict:
    rng = random.Random(seed)
    cyc = cfg["cycle"]
    noise = cfg["noise"]
    clamp = cfg["clamp"]

    b_rf = base["cost_of_equity"]["risk_free"]
    b_erp = base["cost_of_equity"]["erp"]
    b_beta = base["cost_of_equity"].get("beta", 1.0)
    b_nim = base["drivers"]["nim"]
    b_coc = base["drivers"]["cost_of_credit"]
    b_cir = base["drivers"]["cost_to_income"]
    b_tax = base["drivers"]["tax_rate"]
    b_g = base["continuing_value"]["growth"]
    b_rone = base["continuing_value"]["rone"]

    price = base.get("price")
    vals = []
    for _ in range(n):
        c = rng.gauss(0, 1)  # cycle factor; c>0 = improving cycle
        rf = _clamp(b_rf - cyc["rf_sens"] * c + rng.gauss(0, noise["rf"]), *clamp["rf"])
        erp = _clamp(b_erp + rng.gauss(0, noise["erp"]), *clamp["erp"])
        ke = rf + b_beta * erp
        nim = _clamp(b_nim - cyc["nim_sens"] * c + rng.gauss(0, noise["nim"]), *clamp["nim"])
        coc = _clamp(b_coc * math.exp(-cyc["coc_log_sens"] * c + rng.gauss(0, noise["coc_log"])),
                     *clamp["coc"])
        gfac = _clamp(1 + cyc["growth_sens"] * c + rng.gauss(0, noise["growth"]),
                      *clamp["growth_factor"])
        g_term = b_g + cyc["g_term_sens"] * c + rng.gauss(0, noise["g_term"])
        g_term = _clamp(g_term, clamp["g_term_floor"], ke - 0.01)
        rone = _clamp(b_rone + rng.gauss(0, noise["rone"]), *clamp["rone"])
        cir = _clamp(b_cir + rng.gauss(0, noise["cir"]), *clamp["cir"])
        tax = _clamp(b_tax + rng.gauss(0, noise["tax"]), *clamp["tax"])

        d = copy.deepcopy(base)
        d["cost_of_equity"]["cost_of_equity_override"] = ke
        d["drivers"]["nim"] = nim
        d["drivers"]["cost_of_credit"] = coc
        d["drivers"]["cost_to_income"] = cir
        d["drivers"]["tax_rate"] = tax
        d["continuing_value"]["growth"] = g_term
        d["continuing_value"]["rone"] = rone
        path = d["drivers"]["earning_asset_growth"]
        if isinstance(path, dict):
            path = path.get("base", path.get("path"))
        d["drivers"]["earning_asset_growth"] = [g * gfac for g in path]

        v = per_share(d)
        if v is not None:
            vals.append(v)

    vals.sort()
    m = len(vals)
    mean = sum(vals) / m if m else float("nan")
    var = sum((v - mean) ** 2 for v in vals) / m if m else float("nan")
    prob_under = (sum(1 for v in vals if price and v >= price) / m) if (m and price) else None

    # histogram
    nbins = 30
    lo_h, hi_h = _pct(vals, 1), _pct(vals, 99)
    width = (hi_h - lo_h) / nbins if hi_h > lo_h else 1
    counts = [0] * nbins
    for v in vals:
        b = int((v - lo_h) / width) if width else 0
        b = min(max(b, 0), nbins - 1)
        counts[b] += 1
    bins = [lo_h + (i + 0.5) * width for i in range(nbins)]

    return {
        "n": m,
        "mean": mean,
        "stdev": math.sqrt(var) if m else float("nan"),
        "min": vals[0] if m else None,
        "max": vals[-1] if m else None,
        "p5": _pct(vals, 5), "p10": _pct(vals, 10), "p25": _pct(vals, 25),
        "p50": _pct(vals, 50), "p75": _pct(vals, 75), "p90": _pct(vals, 90),
        "p95": _pct(vals, 95),
        "prob_undervalued": prob_under,
        "price": price,
        "hist": {"bins": bins, "counts": counts},
    }


# --------------------------------------------------------------------------
# Orchestration + formatting
# --------------------------------------------------------------------------

def run_all(drivers: dict, stress: dict, n: int, seed: int) -> dict:
    base_val = per_share(drivers)
    price = drivers.get("price")
    torn = tornado(drivers, stress["tornado"])
    rev = reverse_dcf(drivers, price, stress["reverse"]) if price else None
    mc_cfg = stress["montecarlo"]
    mc = monte_carlo(drivers, mc_cfg, n=n or mc_cfg.get("n", 10000),
                     seed=seed if seed is not None else mc_cfg.get("seed", 42))
    return {
        "company": drivers.get("company"),
        "ticker": drivers.get("ticker"),
        "currency": drivers.get("currency", "IDR"),
        "base_value": base_val,
        "price": price,
        "tornado": torn,
        "reverse": rev,
        "montecarlo": mc,
    }


def format_report(res: dict) -> str:
    cur = res["currency"]
    L = []
    L.append(f"Stress test - {res['company']} ({res['ticker']})  [{cur}]")
    L.append(f"Base value/share: {res['base_value']:,.0f}  |  Price: {res['price']:,.0f}  "
             f"(upside {(res['base_value']/res['price']-1)*100:+.1f}%)")
    L.append("")
    L.append("1) TORNADO (value/share at low / high, ranked by swing)")
    L.append(f"   {'Driver':<26}{'low->':>12}{'high->':>12}{'swing':>10}")
    for r in res["tornado"]["rows"]:
        lv = f"{r['low_val']:,.0f}" if r["low_val"] is not None else "n/a"
        hv = f"{r['high_val']:,.0f}" if r["high_val"] is not None else "n/a"
        L.append(f"   {r['label']:<26}{lv:>12}{hv:>12}{r['swing']:>10,.0f}")
    L.append("")
    if res.get("reverse"):
        L.append(f"2) REVERSE DCF (driver value implied by price {res['price']:,.0f})")
        L.append(f"   {'Driver':<30}{'base':>10}{'implied':>12}")
        for r in res["reverse"]["rows"]:
            imp = r["implied"]
            base_in = r["base_in"]
            is_rate = r["key"] in ("cost_of_equity", "terminal_growth", "nim",
                                   "cost_of_credit", "rone", "explicit_growth_peak")
            fb = f"{base_in*100:.2f}%" if (is_rate and base_in is not None) else (
                f"{base_in}" if base_in is not None else "-")
            if imp is None:
                fi = "out of range"
            else:
                fi = f"{imp*100:.2f}%" if is_rate else f"{imp:,.2f}"
            line = f"   {r['label']:<30}{fb:>10}{fi:>12}"
            if r.get("implied_roe") is not None:
                line += f"   (implies ROE {r['implied_roe']*100:.1f}%)"
            L.append(line)
        L.append("")
    mc = res["montecarlo"]
    L.append(f"3) MONTE CARLO ({mc['n']:,} valid sims)")
    L.append(f"   mean {mc['mean']:,.0f}  stdev {mc['stdev']:,.0f}")
    L.append(f"   P10 {mc['p10']:,.0f}  P25 {mc['p25']:,.0f}  P50 {mc['p50']:,.0f}  "
             f"P75 {mc['p75']:,.0f}  P90 {mc['p90']:,.0f}")
    if mc["prob_undervalued"] is not None:
        L.append(f"   P(value >= price {res['price']:,.0f}) = "
                 f"{mc['prob_undervalued']*100:.0f}%  (probability undervalued)")
    return "\n".join(L)


def main() -> None:
    p = argparse.ArgumentParser(description="Stress test the bank driver DCF")
    p.add_argument("drivers")
    p.add_argument("--stress", required=True)
    p.add_argument("--n", type=int, default=0)
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--json", action="store_true")
    args = p.parse_args()

    with open(args.drivers) as f:
        drivers = json.load(f)
    with open(args.stress) as f:
        stress = json.load(f)

    res = run_all(drivers, stress, args.n, args.seed)
    if args.json:
        print(json.dumps(res, indent=2))
    else:
        print(format_report(res))


if __name__ == "__main__":
    main()
