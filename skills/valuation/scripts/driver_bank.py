"""Driver-based equity-cash-flow model for a bank (McKinsey equity DCF).

Turns a small set of bank fundamental drivers (earning-asset growth, NIM,
fee income, cost-to-income, cost of credit, tax, capital intensity) into the
explicit equity-cash-flow path and the continuing-value inputs that engine.py
needs. The point: the value reacts to REAL bank levers, so a stress test can
move NIM, credit cost, growth, etc. directly rather than an abstract FCF line.

Equity cash flow = net income - increase in book equity (the equity retained to
support asset growth at the target capital ratio). Discount at the cost of
equity (engine: equity_weight=1). Continuing value uses the equity value-driver
form CV = NI_next * (1 - g/RONE) / (ke - g), wired through engine's
key_value_driver method (noplat_next = NI_next, ronic = RONE).

Pure stdlib. Run from the scripts/ directory so `import engine` resolves.

Usage:
    python driver_bank.py <drivers.json> [--json] [--quiet]
      --json   emit the engine model dict (pipe into engine.py)
      default  print the driver tree + the resulting per-share value
"""

from __future__ import annotations

import argparse
import copy
import json
import sys

import engine


# --------------------------------------------------------------------------
# Driver path helpers
# --------------------------------------------------------------------------

def hump_path(start: float, peak: float, end: float, n: int = 10,
              peak_year: int = 3) -> list:
    """A growth path that rises from `start` to `peak`, holds, then fades to
    `end` by year n. Models "soft now, recover, then mature to terminal"."""
    path = []
    for t in range(1, n + 1):
        if t <= peak_year:
            # linear rise start -> peak over the first peak_year years
            frac = (t - 1) / max(1, peak_year - 1)
            path.append(start + (peak - start) * frac)
        else:
            # linear fade peak -> end over the remaining years
            frac = (t - peak_year) / max(1, n - peak_year)
            path.append(peak + (end - peak) * frac)
    return path


def scale_path_to_peak(base_path: list, target_peak: float) -> list:
    """Rescale a growth path so its maximum equals target_peak (keeps shape)."""
    base_peak = max(base_path)
    if base_peak == 0:
        return list(base_path)
    factor = target_peak / base_peak
    return [g * factor for g in base_path]


# --------------------------------------------------------------------------
# Forecast build
# --------------------------------------------------------------------------

def build_forecast(drivers: dict) -> dict:
    """Build the year-by-year bank forecast from the resolved driver set.

    Returns a dict with the per-year rows, the equity-cash-flow list, NI_next
    for the continuing value, and the implied steady-state ROE."""
    by = drivers["base_year"]
    d = drivers["drivers"]

    ea0 = float(by["earning_assets"])
    noninterest0 = float(by["noninterest_income"])
    loans_ratio = float(by["loans_to_earning_assets"])
    ea_to_assets = float(by["earning_assets_to_total_assets"])

    nim = float(d["nim"])
    cir = float(d["cost_to_income"])
    coc = float(d["cost_of_credit"])
    tax = float(d["tax_rate"])
    eta = float(d["equity_to_assets"])
    fee_drift = float(d.get("fee_income_share_drift", 0.0))

    growth = d["earning_asset_growth"]
    if isinstance(growth, dict):
        growth = growth.get("base", growth.get("path"))
    growth = [float(g) for g in growth]
    n = len(growth)

    base_year = int(by.get("year", 0))

    # Equity sized off the capital ratio so the first-year delta is clean.
    def equity_for_ea(ea: float) -> float:
        return eta * (ea / ea_to_assets)

    ea_prev = ea0
    equity_prev = equity_for_ea(ea0)
    equity_base = equity_prev

    rows = []
    ecf = []
    for t, g in enumerate(growth, start=1):
        ea = ea_prev * (1 + g)
        avg_ea = (ea_prev + ea) / 2.0

        nii = nim * avg_ea
        noninterest = noninterest0 * (ea / ea0) * ((1 + fee_drift) ** t)
        op_income = nii + noninterest
        opex = cir * op_income
        ppop = op_income - opex
        avg_loans = loans_ratio * avg_ea
        provisions = coc * avg_loans
        pretax = ppop - provisions
        ni = pretax * (1 - tax)

        assets = ea / ea_to_assets
        equity = eta * assets
        d_equity = equity - equity_prev
        equity_cf = ni - d_equity

        roe = ni / equity_prev if equity_prev else None
        rows.append({
            "year": base_year + t if base_year else t,
            "growth": g,
            "earning_assets": ea,
            "net_interest_income": nii,
            "noninterest_income": noninterest,
            "operating_income": op_income,
            "opex": opex,
            "provisions": provisions,
            "pretax": pretax,
            "net_income": ni,
            "equity": equity,
            "delta_equity": d_equity,
            "equity_cash_flow": equity_cf,
            "roe": roe,
        })
        ecf.append(equity_cf)
        ea_prev, equity_prev = ea, equity

    g_term = float(drivers["continuing_value"]["growth"])
    ni_last = rows[-1]["net_income"]
    ni_next = ni_last * (1 + g_term)

    # steady-state ROE implied by the drivers (return on the last-year base)
    steady_roe = rows[-1]["net_income"] / rows[-2]["equity"] if n >= 2 else rows[-1]["roe"]

    return {
        "rows": rows,
        "equity_cash_flow": ecf,
        "ni_next": ni_next,
        "ni_last": ni_last,
        "equity_base": equity_base,
        "steady_state_roe": steady_roe,
    }


def build_model_dict(drivers: dict) -> dict:
    """Assemble an engine-compatible model dict from the driver set."""
    fc = build_forecast(drivers)
    rows = fc["rows"]

    coe = drivers["cost_of_equity"]
    cv = drivers["continuing_value"]

    wacc = {
        "risk_free": float(coe["risk_free"]),
        "erp": float(coe["erp"]),
        "beta": float(coe.get("beta", 1.0)),
        "pretax_cost_of_debt": 0.0,
        "tax_rate": 0.0,
        "equity_weight": 1.0,
        "debt_weight": 0.0,
        "midyear": bool(coe.get("midyear", True)),
    }
    if "cost_of_equity_override" in coe and coe["cost_of_equity_override"] is not None:
        wacc["wacc_override"] = float(coe["cost_of_equity_override"])

    return {
        "company": drivers.get("company", ""),
        "ticker": drivers.get("ticker", ""),
        "currency": drivers.get("currency", "IDR"),
        "units": drivers.get("units", "billions"),
        "valuation_date": drivers.get("valuation_date", ""),
        "forecast": [{"year": r["year"], "fcf": r["equity_cash_flow"]} for r in rows],
        "wacc": wacc,
        "continuing_value": {
            "method": "key_value_driver",
            "growth": float(cv["growth"]),
            "ronic": float(cv["rone"]),
            "noplat_next": fc["ni_next"],
        },
        "bridge": {
            "nonoperating_assets": 0.0,
            "debt_and_equivalents": 0.0,
            "other_claims": 0.0,
            "shares_outstanding": float(drivers.get("shares_outstanding", 0.0)),
            "current_price": float(drivers.get("price", 0.0) or 0.0),
        },
    }


def value_drivers(drivers: dict) -> dict:
    """Build the model and run the engine. Returns the engine result dict."""
    model = engine.Model.from_dict(build_model_dict(drivers))
    return engine.value(model)


def load_drivers(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


# --------------------------------------------------------------------------
# Reporting
# --------------------------------------------------------------------------

def format_tree(drivers: dict) -> str:
    fc = build_forecast(drivers)
    result = value_drivers(drivers)
    cur = drivers.get("currency", "IDR")

    lines = []
    lines.append(f"Driver model - {drivers.get('company')} ({drivers.get('ticker')})  "
                 f"[billions {cur}]")
    coe = drivers["cost_of_equity"]
    ke = coe.get("cost_of_equity_override") or (
        coe["risk_free"] + coe.get("beta", 1.0) * coe["erp"])
    cv = drivers["continuing_value"]
    lines.append(f"ke {ke*100:.2f}%  | terminal g {cv['growth']*100:.2f}%  | "
                 f"RONE {cv['rone']*100:.2f}%")
    lines.append("")
    hdr = (f"{'Year':>5} {'g%':>6} {'EarnAssets':>12} {'NII':>9} {'OpInc':>9} "
           f"{'Prov':>7} {'NI':>9} {'ROE%':>6} {'EquityCF':>9}")
    lines.append(hdr)
    for r in fc["rows"]:
        lines.append(
            f"{r['year']:>5} {r['growth']*100:>6.1f} {r['earning_assets']:>12,.0f} "
            f"{r['net_interest_income']:>9,.0f} {r['operating_income']:>9,.0f} "
            f"{r['provisions']:>7,.0f} {r['net_income']:>9,.0f} "
            f"{(r['roe'] or 0)*100:>6.1f} {r['equity_cash_flow']:>9,.0f}")
    lines.append("")
    lines.append(f"Implied steady-state ROE: {fc['steady_state_roe']*100:.1f}%")
    lines.append(f"NI next (CV year):        {fc['ni_next']:,.0f}")
    cvr = result["continuing_value"]
    lines.append(f"PV explicit equity CF:    {result['pv_explicit_fcf']:,.0f}")
    lines.append(f"PV continuing value:      {cvr['pv']:,.0f}  "
                 f"({cvr['share_of_operations']*100:.1f}% of value)")
    lines.append(f"Equity value:             {result['equity_value']:,.0f}")
    ps = result["value_per_share"]
    lines.append(f"Value per share:          {cur} {ps:,.0f}")
    price = drivers.get("price")
    if price:
        lines.append(f"Market price:             {cur} {price:,.0f}  "
                     f"(upside {(ps/price-1)*100:+.1f}%)")
    return "\n".join(lines)


def main() -> None:
    p = argparse.ArgumentParser(description="Driver-based bank equity DCF")
    p.add_argument("drivers")
    p.add_argument("--json", action="store_true", help="emit engine model dict")
    p.add_argument("--quiet", action="store_true")
    args = p.parse_args()

    drivers = load_drivers(args.drivers)
    if args.json:
        print(json.dumps(build_model_dict(drivers), indent=2))
        return
    if not args.quiet:
        print(format_tree(drivers))


if __name__ == "__main__":
    main()
