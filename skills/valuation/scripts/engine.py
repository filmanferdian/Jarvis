"""Deterministic valuation math for the McKinsey enterprise-DCF workflow.

Pure stdlib. Every number a valuation reports should come from here, not from
an LLM's mental arithmetic. The CLI wrappers (wacc.py, dcf.py, roic.py,
sensitivity.py) and the Excel builder (build_model.py) all call into this.

Conventions match "Valuation: Measuring and Managing the Value of Companies":
- Enterprise DCF: discount free cash flow to all investors at WACC.
- Continuing value via the key value driver formula (RONIC form).
- Midyear discounting convention (cash flows received mid-period).
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from typing import Optional


# --------------------------------------------------------------------------
# Cost of capital
# --------------------------------------------------------------------------

def cost_of_equity_capm(risk_free: float, beta: float, erp: float) -> float:
    """CAPM: ke = rf + beta * equity risk premium."""
    return risk_free + beta * erp


def wacc(
    *,
    equity_weight: float,
    debt_weight: float,
    cost_of_equity: float,
    pretax_cost_of_debt: float,
    tax_rate: float,
) -> dict:
    """WACC with market-value weights and an after-tax cost of debt.

    Weights must sum to ~1 (preferred + other claims should be folded in by the
    caller as part of debt/equity weights, or the weights renormalized).
    """
    total_w = equity_weight + debt_weight
    if abs(total_w - 1.0) > 1e-6:
        raise ValueError(
            f"capital-structure weights must sum to 1.0 (got {total_w:.4f})"
        )
    after_tax_kd = pretax_cost_of_debt * (1 - tax_rate)
    w = equity_weight * cost_of_equity + debt_weight * after_tax_kd
    return {
        "cost_of_equity": cost_of_equity,
        "pretax_cost_of_debt": pretax_cost_of_debt,
        "after_tax_cost_of_debt": after_tax_kd,
        "equity_weight": equity_weight,
        "debt_weight": debt_weight,
        "wacc": w,
    }


def unlever_beta(equity_beta: float, debt_to_equity: float) -> float:
    """Book's simplifying form (debt beta = 0): bu = be / (1 + D/E)."""
    return equity_beta / (1 + debt_to_equity)


def relever_beta(asset_beta: float, debt_to_equity: float) -> float:
    """be = bu * (1 + D/E)."""
    return asset_beta * (1 + debt_to_equity)


# --------------------------------------------------------------------------
# Reorganized economics (light helpers)
# --------------------------------------------------------------------------

def noplat(ebita: float, operating_cash_tax_rate: float) -> float:
    """NOPLAT = EBITA * (1 - operating cash tax rate)."""
    return ebita * (1 - operating_cash_tax_rate)


def roic(noplat_value: float, invested_capital: float) -> float:
    return noplat_value / invested_capital


def roic_tree(
    *, revenue: float, ebita: float, invested_capital: float, operating_cash_tax_rate: float
) -> dict:
    """ROIC = (1 - T) * (EBITA/Revenue) * (Revenue/Invested Capital).

    i.e. after-tax operating margin * capital turnover.
    """
    operating_margin = ebita / revenue
    capital_turnover = revenue / invested_capital
    after_tax_margin = (1 - operating_cash_tax_rate) * operating_margin
    roic_value = after_tax_margin * capital_turnover
    return {
        "operating_margin": operating_margin,
        "after_tax_operating_margin": after_tax_margin,
        "capital_turnover": capital_turnover,
        "operating_cash_tax_rate": operating_cash_tax_rate,
        "roic": roic_value,
    }


# --------------------------------------------------------------------------
# Continuing value
# --------------------------------------------------------------------------

def continuing_value_kvd(
    *, noplat_next: float, growth: float, ronic: float, wacc_rate: float
) -> float:
    """Key value driver continuing value (value at end of explicit period N).

    CV_N = NOPLAT_{N+1} * (1 - g/RONIC) / (WACC - g)

    When RONIC == WACC this collapses to NOPLAT_{N+1}/WACC (growth is value-neutral).
    """
    if wacc_rate <= growth:
        raise ValueError("WACC must exceed the continuing growth rate (WACC > g)")
    if ronic == 0:
        raise ValueError("RONIC cannot be zero")
    return noplat_next * (1 - growth / ronic) / (wacc_rate - growth)


def continuing_value_perpetuity(
    *, fcf_next: float, growth: float, wacc_rate: float
) -> float:
    """Growing perpetuity CV_N = FCF_{N+1} / (WACC - g)."""
    if wacc_rate <= growth:
        raise ValueError("WACC must exceed the continuing growth rate (WACC > g)")
    return fcf_next / (wacc_rate - growth)


# --------------------------------------------------------------------------
# Discounting
# --------------------------------------------------------------------------

def discount_factor(wacc_rate: float, period: int, midyear: bool) -> float:
    exponent = (period - 0.5) if midyear else float(period)
    return 1.0 / ((1 + wacc_rate) ** exponent)


# --------------------------------------------------------------------------
# Full valuation
# --------------------------------------------------------------------------

@dataclass
class WaccInputs:
    risk_free: Optional[float] = None
    erp: Optional[float] = None
    beta: Optional[float] = None
    cost_of_equity: Optional[float] = None  # overrides CAPM if given
    pretax_cost_of_debt: float = 0.0
    tax_rate: float = 0.0
    equity_weight: float = 1.0
    debt_weight: float = 0.0
    midyear: bool = True
    wacc_override: Optional[float] = None  # pins WACC directly (for sensitivity)

    def resolve_wacc(self) -> dict:
        if self.wacc_override is not None:
            return {
                "cost_of_equity": self.cost_of_equity,
                "pretax_cost_of_debt": self.pretax_cost_of_debt,
                "after_tax_cost_of_debt": self.pretax_cost_of_debt * (1 - self.tax_rate),
                "equity_weight": self.equity_weight,
                "debt_weight": self.debt_weight,
                "wacc": self.wacc_override,
                "capm_used": False,
                "overridden": True,
            }
        ke = self.cost_of_equity
        if ke is None:
            if None in (self.risk_free, self.erp, self.beta):
                raise ValueError(
                    "provide cost_of_equity, or all of risk_free + erp + beta"
                )
            ke = cost_of_equity_capm(self.risk_free, self.beta, self.erp)
        out = wacc(
            equity_weight=self.equity_weight,
            debt_weight=self.debt_weight,
            cost_of_equity=ke,
            pretax_cost_of_debt=self.pretax_cost_of_debt,
            tax_rate=self.tax_rate,
        )
        out["capm_used"] = self.cost_of_equity is None
        return out


@dataclass
class ContinuingValue:
    method: str = "key_value_driver"  # or "perpetuity"
    growth: float = 0.0
    ronic: Optional[float] = None
    noplat_next: Optional[float] = None
    fcf_next: Optional[float] = None

    def compute(self, wacc_rate: float) -> float:
        if self.method == "key_value_driver":
            if None in (self.noplat_next, self.ronic):
                raise ValueError(
                    "key_value_driver CV needs noplat_next and ronic"
                )
            return continuing_value_kvd(
                noplat_next=self.noplat_next,
                growth=self.growth,
                ronic=self.ronic,
                wacc_rate=wacc_rate,
            )
        if self.method == "perpetuity":
            if self.fcf_next is None:
                raise ValueError("perpetuity CV needs fcf_next")
            return continuing_value_perpetuity(
                fcf_next=self.fcf_next, growth=self.growth, wacc_rate=wacc_rate
            )
        raise ValueError(f"unknown CV method: {self.method}")


@dataclass
class Bridge:
    nonoperating_assets: float = 0.0
    debt_and_equivalents: float = 0.0
    other_claims: float = 0.0  # minority interest, preferred, ESOs, etc.
    shares_outstanding: float = 0.0


@dataclass
class Model:
    company: str = ""
    ticker: str = ""
    currency: str = "USD"
    units: str = "millions"
    valuation_date: str = ""
    forecast: list = field(default_factory=list)  # [{"year": int, "fcf": float}, ...]
    wacc: WaccInputs = field(default_factory=WaccInputs)
    continuing_value: ContinuingValue = field(default_factory=ContinuingValue)
    bridge: Bridge = field(default_factory=Bridge)

    @staticmethod
    def from_dict(d: dict) -> "Model":
        return Model(
            company=d.get("company", ""),
            ticker=d.get("ticker", ""),
            currency=d.get("currency", "USD"),
            units=d.get("units", "millions"),
            valuation_date=d.get("valuation_date", ""),
            forecast=list(d.get("forecast", [])),
            wacc=WaccInputs(**d.get("wacc", {})),
            continuing_value=ContinuingValue(**d.get("continuing_value", {})),
            bridge=Bridge(**d.get("bridge", {})),
        )


def value(model: Model) -> dict:
    """Run the full enterprise DCF and equity bridge. Returns a result dict."""
    wacc_info = model.wacc.resolve_wacc()
    w = wacc_info["wacc"]
    midyear = model.wacc.midyear

    n = len(model.forecast)
    if n == 0:
        raise ValueError("forecast must have at least one explicit year")

    explicit = []
    pv_explicit = 0.0
    for i, row in enumerate(model.forecast, start=1):
        fcf = float(row["fcf"])
        df = discount_factor(w, i, midyear)
        pv = fcf * df
        pv_explicit += pv
        explicit.append(
            {"period": i, "year": row.get("year"), "fcf": fcf,
             "discount_factor": df, "pv": pv}
        )

    cv_undiscounted = model.continuing_value.compute(w)
    cv_df = discount_factor(w, n, midyear)  # CV sits at end of year N
    pv_cv = cv_undiscounted * cv_df

    ev_operations = pv_explicit + pv_cv
    enterprise_value = ev_operations + model.bridge.nonoperating_assets
    equity_value = (
        enterprise_value
        - model.bridge.debt_and_equivalents
        - model.bridge.other_claims
    )
    per_share = (
        equity_value / model.bridge.shares_outstanding
        if model.bridge.shares_outstanding
        else None
    )

    return {
        "company": model.company,
        "ticker": model.ticker,
        "currency": model.currency,
        "units": model.units,
        "valuation_date": model.valuation_date,
        "wacc": wacc_info,
        "midyear_convention": midyear,
        "explicit_period": explicit,
        "pv_explicit_fcf": pv_explicit,
        "continuing_value": {
            "method": model.continuing_value.method,
            "growth": model.continuing_value.growth,
            "ronic": model.continuing_value.ronic,
            "undiscounted": cv_undiscounted,
            "discount_factor": cv_df,
            "pv": pv_cv,
            "share_of_operations": (pv_cv / ev_operations) if ev_operations else None,
        },
        "value_of_operations": ev_operations,
        "nonoperating_assets": model.bridge.nonoperating_assets,
        "enterprise_value": enterprise_value,
        "debt_and_equivalents": model.bridge.debt_and_equivalents,
        "other_claims": model.bridge.other_claims,
        "equity_value": equity_value,
        "shares_outstanding": model.bridge.shares_outstanding,
        "value_per_share": per_share,
    }


def _format_pct(x):
    return f"{x*100:.2f}%" if isinstance(x, (int, float)) else "n/a"


def format_report(r: dict) -> str:
    """Human-readable summary for the terminal."""
    cur = r["currency"]
    u = r["units"]
    lines = []
    lines.append(f"Valuation — {r['company']} ({r['ticker']})  [{u} {cur}]")
    if r.get("valuation_date"):
        lines.append(f"As of {r['valuation_date']}")
    lines.append("")
    w = r["wacc"]
    lines.append(
        f"WACC {_format_pct(w['wacc'])}  "
        f"(ke {_format_pct(w['cost_of_equity'])}, "
        f"after-tax kd {_format_pct(w['after_tax_cost_of_debt'])}, "
        f"E/V {_format_pct(w['equity_weight'])})"
    )
    lines.append(f"Midyear convention: {r['midyear_convention']}")
    lines.append("")
    lines.append("Explicit free cash flow:")
    for row in r["explicit_period"]:
        yr = row.get("year") or row["period"]
        lines.append(
            f"  {yr}: FCF {row['fcf']:,.1f}  x DF {row['discount_factor']:.4f}  "
            f"= PV {row['pv']:,.1f}"
        )
    lines.append(f"  PV of explicit FCF:            {r['pv_explicit_fcf']:,.1f}")
    cv = r["continuing_value"]
    lines.append(
        f"  Continuing value ({cv['method']}, g {_format_pct(cv['growth'])}): "
        f"undiscounted {cv['undiscounted']:,.1f}  PV {cv['pv']:,.1f}  "
        f"({_format_pct(cv['share_of_operations'])} of operations)"
    )
    lines.append("")
    lines.append(f"Value of operations:             {r['value_of_operations']:,.1f}")
    lines.append(f"+ Nonoperating assets:           {r['nonoperating_assets']:,.1f}")
    lines.append(f"= Enterprise value:              {r['enterprise_value']:,.1f}")
    lines.append(f"- Debt & equivalents:            {r['debt_and_equivalents']:,.1f}")
    lines.append(f"- Other claims:                  {r['other_claims']:,.1f}")
    lines.append(f"= Equity value:                  {r['equity_value']:,.1f}")
    if r["value_per_share"] is not None:
        lines.append(
            f"/ Shares ({r['shares_outstanding']:,.1f}) "
            f"= Value per share: {cur} {r['value_per_share']:,.2f}"
        )
    return "\n".join(lines)


def _load_model(path: str) -> Model:
    with open(path) as f:
        return Model.from_dict(json.load(f))


if __name__ == "__main__":
    # Usage: python engine.py model.json [--json]
    if len(sys.argv) < 2:
        print("usage: python engine.py <model.json> [--json]", file=sys.stderr)
        sys.exit(2)
    model = _load_model(sys.argv[1])
    result = value(model)
    if "--json" in sys.argv[2:]:
        print(json.dumps(result, indent=2))
    else:
        print(format_report(result))
