"""Which missed expert edges had any evidence in the data the model learned from?

For each causRCA B1 subsystem, reads the exact learning rows the Spohn Bayesian
run assimilated (learning.sqlite events) and, for every expert edge the champion
missed, tests whether the child's state depends on the parent's.

An edge counts as discoverable only if the data shows a material and clear
dependence: the odds ratio moves by at least 2x (|log OR| >= log 2) and a
two-sided Fisher exact test gives p < 0.01. Otherwise the data carries no
evidence for the edge, and the website does not draw it as "missed".

Usage:
    python tools/edge_evidence.py <B1_causRCA_final folder>
"""
import json
import math
import sqlite3
import sys
from pathlib import Path

import pandas as pd
from scipy.stats import fisher_exact

RUNS = {"coolant": "coolant/attempt_1", "hydraulics": "hydraulics/attempt_3", "probe": "probe/attempt_6"}
MIN_FACTOR, ALPHA = 2.0, 0.01


def learning_rows(folder):
    con = sqlite3.connect(folder / "learning.sqlite")
    rows = [r["values"] for (payload,) in con.execute("select payload from events order by sequence")
            for r in json.loads(payload)["records"]]
    return pd.DataFrame(rows)


def evidence(df, parent, child):
    t = pd.crosstab(df[parent], df[child])
    if t.shape != (2, 2):
        return {"discoverable": False, "reason": "an endpoint never varies"}
    odds, p = fisher_exact(t.values)
    log_or = math.inf if odds in (0, math.inf) else abs(math.log(odds))
    ok = log_or >= math.log(MIN_FACTOR) and p < ALPHA
    return {"discoverable": ok, "odds_ratio": odds, "p": p,
            "reason": "clear dependence" if ok else "no material dependence in the learning data"}


def main(root):
    root = Path(root)
    for name, rel in RUNS.items():
        folder = root / rel
        df = learning_rows(folder)
        edges = json.loads((folder / "results_log.json").read_text(encoding="utf8"))["champion_graph_vs_expert"]
        missed = [e["edge"] for e in edges if e["status"].startswith("missed")]
        print(f"{name}: {len(df)} learning rows, {len(missed)} missed expert edges")
        kept = 0
        for edge in missed:
            parent, child = [x.strip() for x in edge.split("->")]
            r = evidence(df, parent, child)
            kept += r["discoverable"]
            extra = f"OR={r['odds_ratio']:.3g} p={r['p']:.2g}" if "p" in r else ""
            print(f"  {'MISSED  ' if r['discoverable'] else 'no data '} {edge:45s} {extra}  ({r['reason']})")
        print(f"  -> {kept} discoverable misses\n")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else
         "C:/Users/Admin/Downloads/invariant_dig_cloud/runs/causrca_b1/B1_causRCA_final")
