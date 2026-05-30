"""Two-way sensitivity grid for the enterprise DCF.

Values per share across WACC (rows) x continuing growth (columns) — the two
inputs the valuation is most sensitive to. Pure stdlib; calls engine.value().

Usage:
    python sensitivity.py <model.json> [--metric per_share|equity|enterprise]
                          [--wacc-steps 0.005] [--growth-steps 0.005] [--n 2]
                          [--json]
"""

from __future__ import annotations

import argparse
import copy
import json

import engine


def _frange(center: float, step: float, n: int) -> list[float]:
    return [center + step * k for k in range(-n, n + 1)]


def grid(model: engine.Model, *, metric: str, wacc_step: float,
         growth_step: float, n: int) -> dict:
    base = engine.value(model)
    base_wacc = base["wacc"]["wacc"]
    base_growth = model.continuing_value.growth

    wacc_axis = _frange(base_wacc, wacc_step, n)
    growth_axis = _frange(base_growth, growth_step, n)

    metric_key = {
        "per_share": "value_per_share",
        "equity": "equity_value",
        "enterprise": "enterprise_value",
    }[metric]

    rows = []
    for w in wacc_axis:
        row = []
        for g in growth_axis:
            m = copy.deepcopy(model)
            m.wacc.wacc_override = w
            m.continuing_value.growth = g
            if w <= g:
                row.append(None)  # WACC must exceed g
                continue
            try:
                row.append(engine.value(m)[metric_key])
            except ValueError:
                row.append(None)
        rows.append(row)

    return {
        "company": model.company,
        "ticker": model.ticker,
        "currency": model.currency,
        "metric": metric,
        "base_value": base[metric_key],
        "base_wacc": base_wacc,
        "base_growth": base_growth,
        "wacc_axis": wacc_axis,
        "growth_axis": growth_axis,
        "values": rows,
    }


def format_grid(gr: dict) -> str:
    cur = gr["currency"]
    lines = [
        f"Sensitivity — {gr['company']} ({gr['ticker']})  metric: {gr['metric']} [{cur}]",
        f"Base: {gr['base_value']:,.2f} at WACC {gr['base_wacc']*100:.2f}% / g {gr['base_growth']*100:.2f}%",
        "",
    ]
    header = "WACC \\ g  " + "".join(f"{g*100:>9.2f}%" for g in gr["growth_axis"])
    lines.append(header)
    for w, row in zip(gr["wacc_axis"], gr["values"]):
        cells = "".join(
            (f"{v:>10,.2f}" if v is not None else f"{'—':>10}") for v in row
        )
        lines.append(f"{w*100:>6.2f}%  {cells}")
    return "\n".join(lines)


def main() -> None:
    p = argparse.ArgumentParser(description="DCF sensitivity grid (WACC x growth)")
    p.add_argument("model")
    p.add_argument("--metric", default="per_share",
                   choices=["per_share", "equity", "enterprise"])
    p.add_argument("--wacc-steps", type=float, default=0.005, dest="wacc_step")
    p.add_argument("--growth-steps", type=float, default=0.005, dest="growth_step")
    p.add_argument("--n", type=int, default=2, help="steps each side of base")
    p.add_argument("--json", action="store_true")
    args = p.parse_args()

    with open(args.model) as f:
        model = engine.Model.from_dict(json.load(f))

    gr = grid(model, metric=args.metric, wacc_step=args.wacc_step,
              growth_step=args.growth_step, n=args.n)
    if args.json:
        print(json.dumps(gr, indent=2))
    else:
        print(format_grid(gr))


if __name__ == "__main__":
    main()
