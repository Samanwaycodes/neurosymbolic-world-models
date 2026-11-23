"""Which expert edges does the B1 training data hold any evidence for?

Rebuilds the causRCA learning snapshots exactly as notebooks/causrca_b1_rca.ipynb does
(5 s snapshots, seeded 70/30 run split, Hyd_Pressure binning), then tests every scored edge of the
champion-vs-expert table for dependence in the learning rows the model had (the 3,000 construction
rows shown to the LLM are included). An expert edge with no detectable dependence (Fisher's exact
or chi-square p >= 0.05, or a constant variable) had no evidence to be discovered from, so the
website does not draw it as missed. Rows are autocorrelated within runs, which makes p-values too
small rather than too large, so a "no evidence" verdict is conservative.

Usage: python tools/edge_evidence.py [causRCA repo clone] [B1 results dir]
Needs pandas, numpy, networkx, scipy and the causRCA repo (github.com/causalgraph/causRCA).
"""
import sys, json, math, random, warnings
from pathlib import Path
import numpy as np
import pandas as pd
import networkx as nx

CAUSRCA = Path(sys.argv[1] if len(sys.argv) > 1 else 'C:/crca/repo')
RESULTS = Path(sys.argv[2] if len(sys.argv) > 2 else
               'C:/Users/Admin/Downloads/invariant_dig_cloud/runs/causrca_b1/B1_causRCA_final')
sys.path[:0] = [str(CAUSRCA / 'src'), str(CAUSRCA)]
from causrca.utils import discretize as _dz
from causrca.utils.utils import estimate_default_value_per_node_from_datasets as defaults_of
discretize_helper = getattr(_dz, '__discretize_dataset_helper')

DATA = CAUSRCA / 'data'
TARGET, BRIDGE = 'M_WarnWithStacklight', 'M_ErrorActive'
SNAPSHOT_SECONDS, AUDIT_FRACTION, SEED = 5, 0.30, 0


# ---- same as the notebook ----
def subsystem_columns(group):
    sub = list(nx.read_gml(DATA / 'dig_twin' / f'exp_{group}' / f'{group}_expert_graph.gml'))
    return sub, [*sub, *([BRIDGE] if group != 'probe' else []), TARGET]

def list_runs(group):
    twin = sorted((DATA / 'dig_twin' / f'exp_{group}').glob('exp_*/run_*/*.csv'))
    real = sorted((DATA / 'real_op').glob('*.csv'))
    return ([{'path': p, 'source': 'twin', 'run': p.name} for p in twin] +
            [{'path': p, 'source': 'real', 'run': p.name} for p in real])

def bin_pressure(events, nominal):
    rows = events['node'] == 'Hyd_Pressure'
    events.loc[rows, 'value'] = np.where(pd.to_numeric(events.loc[rows, 'value']) == nominal, 'nominal', 'deviating')
    events.loc[rows, 'type'] = 'Categorical'

def snapshots(events, columns, default, end_s):
    step = SNAPSHOT_SECONDS
    if events.empty:
        wide = pd.DataFrame(index=np.arange(0, end_s + step, step), columns=columns)
    else:
        wide = discretize_helper(events, time_step_ms=step * 1000, max_time_s=end_s, remove_constant_columns=False)
    return wide.reindex(columns=columns).fillna(default).astype(str)

def split_runs(runs, seed=SEED):
    rng, split = random.Random(seed), {}
    for source in ('real', 'twin'):
        idx = [i for i, r in enumerate(runs) if r['source'] == source]
        rng.shuffle(idx)
        n_audit = math.ceil(AUDIT_FRACTION * len(idx))
        split.update({i: 'audit' if k < n_audit else 'learning' for k, i in enumerate(idx)})
    return split

def learning_rows(group):
    sub, columns = subsystem_columns(group)
    runs = list_runs(group)
    raw = [pd.read_csv(r['path']) for r in runs]
    ends = [float(d['time_s'].max()) for d in raw]
    events = [d[d['node'].isin(columns)].copy() for d in raw]
    if 'Hyd_Pressure' in columns:
        pressure = [e[e['node'] == 'Hyd_Pressure'] for e in events]
        nominal = float(defaults_of([p for p in pressure if not p.empty])['Hyd_Pressure'])
        for e in events: bin_pressure(e, nominal)
    default = defaults_of(events)
    default.update({c: 'nominal' if c == 'Hyd_Pressure' else 'False' for c in columns if c not in default})
    split = split_runs(runs)
    frames = []
    for i, (e, end) in enumerate(zip(events, ends)):
        if split[i] != 'learning':
            continue
        wide = snapshots(e, columns, default, end)
        wide['_run'] = i
        frames.append(wide)
    return pd.concat(frames, ignore_index=True)


# ---- the evidence test ----
def test_edges(group):
    from scipy.stats import chi2_contingency, fisher_exact
    learn = learning_rows(group)
    log = json.loads(next((RESULTS / group).glob('attempt_*/results_log.json')).read_text(encoding='utf8'))
    rows = []
    for e in log['champion_graph_vs_expert']:
        a, b = [s.strip() for s in e['edge'].split('->')]
        tab = pd.crosstab(learn[a], learn[b])
        if tab.shape[0] < 2 or tab.shape[1] < 2:
            p = 1.0
        elif tab.shape == (2, 2):
            p = float(fisher_exact(tab.values)[1])
        else:
            p = float(chi2_contingency(tab.values)[1])
        rare = tab.sum(axis=1).idxmin()
        rows.append({'edge': e['edge'], 'status': e['status'], 'p': p, 'evidence': p < 0.05,
                     'rare_state': f'{a}={rare}', 'rare_rows': int(tab.sum(axis=1).min()),
                     'rare_runs': int(learn.loc[learn[a] == rare, '_run'].nunique())})
    return len(learn), rows


if __name__ == '__main__':
    warnings.filterwarnings('ignore')
    for group in ('probe', 'hydraulics', 'coolant'):
        n, rows = test_edges(group)
        print(f'===== {group}: {n} learning rows')
        for r in rows:
            mark = '' if r['evidence'] else '   <- no evidence'
            print(f"  {r['status']:<21} {r['edge']:<42} p={r['p']:.2g}  {r['rare_state']} "
                  f"rows={r['rare_rows']} runs={r['rare_runs']}{mark}")
