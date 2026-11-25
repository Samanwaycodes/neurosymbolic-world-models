# Neuro-Symbolic World Models: project board

A single-page, hand-drawn GitHub Pages site that lays out the auto-didactic neuro-symbolic world-model work as one inquiry, stage by stage.

- **The goal**: a reproduction of the original board page, including the classical and autodidactic teacher–learner diagrams.
- **The inquiry**: a map of the stages, each with its question and what it ran into or found; each stop links to its section.
- **I. Encoding to a principled representation**: causal (Panasonic motor-protection twin; Ather K383 spot-welder world model), causal Kripke (**TOKW**, forced pendulum) and typed (**First Proof**), then what each form needed from outside the data.
- **II. Presentation-relative encoding**: the system as its own teacher, changing how the input is presented (masking, order, repeats) at test and train time, with a Bayesian teacher; evidence from the anytime-anywhere PAC-Bayes paper (Walsh acquisition on measured single-pixel data).
- **III. Representation and presentation together**: **Spohn Bayesian Model Discovery** (causRCA root-cause analysis) and its DiG-bench harness extension.
- **IV. Query discovery**: where → what → how, asked of a segmenter, a VLM and a world model.
- **References**: papers, datasets and manuscripts the work builds on, grouped by stage.

Model cards keep one layout, sized to print on about ¾ of an A4 sheet (What → How → How does it perform? → Known limitations).

No build step is needed: it's plain HTML, CSS and JS. rough.js (from jsDelivr) gives shapes their hand-drawn look. Without it, the same shapes render as clean SVG.

## Deploy to GitHub Pages

1. Push this folder to the root of a repository.
2. In **Settings → Pages**, set *Source* to **Deploy from a branch**, then pick `main` and `/ (root)`.
3. `.nojekyll` is already included, so the files are served as-is.

To preview locally, run `python -m http.server 8765` and open http://localhost:8765.

GitHub Pages lets browsers cache files for 10 minutes. After editing `style.css` or `board.js`, bump the `?v=` tag on their `<link>` / `<script>` lines in `index.html` so visitors get the new files together with the new page.

## Layout

```
index.html                  all content: goal board, inquiry map, the stages, references
assets/css/style.css        paper, sticky notes, tape, highlighters, layout, inquiry map and stage blocks
assets/js/board.js          rough.js pass, goal-board connectors, Kripke graph, learnt-vs-expert DAG, bar charts,
                            DiG-bench level races, Walsh presentation field, First Proof tallies
assets/img/tokw/*.gif       pendulum episode with physics vs VLM labels overlaid
tools/make_pendulum_assets.py  regenerates the GIFs from the local TOKW v0.4.0 run folders
tools/edge_evidence.py      which expert causRCA edges the training data holds evidence for (no-evidence edges are not drawn as missed)
```

## Adding another model

Put the card in the stage it belongs to (`section.stage`), and add a line for it to that stage's `.forms` list if the stage has one. Copy the `<article class="project-card compact">` block in `index.html` and keep the same order:
title + chips → architecture diagram (`.pipeline` SVG, with `class="rk"` on any shape you want hand-drawn) → **What** / **How** notes → **How does it perform?** (one `.env` panel per environment) → **Known limitations**.

- Any `rect`, `ellipse`, `circle`, `line`, `polygon` or `path` with `class="rk"` is redrawn in a sketchy style. Add `marker-end="url(#ah)"` to get an arrowhead.
- The Kripke graph is drawn by `board.js` from the `KRIPKE` object (states with positions, transitions with probabilities). Add another object and an `<svg id="…">` host for a new environment.
- Keep the card to about ¾ of an A4 page: on screen its height should stay under ~1.06 × its width, and printing (Ctrl+P, A4) puts it on its own page.

## Data sources

- Architecture and design notes: `artpark-hub/neuro-sym-wm` (`explainable_kripke/README.md`, phyre-benchmark branch).
- Spohn DiG-bench extension (A vs B): local `invariant_dig_cloud_digbench/runs/digbench_gpt_t123_001` (P-1, P-2, P-4, P-6, P-8; its RESULTS.md) and `digbench_gpt_p3_004` (P-3); level-ups from `level_reach.json` and the per-turn logs, refreshes from `refresh.json`, laws from `controller/symbolic/compact_world_model.json`.
- Spohn RCA results: `artpark-hub/neuro-sym-wm`, `Spohn-Bayesian-Model-Discovery/results/causrca_b1/` (B1 summary, per-subsystem `benchmark_comparison.json` and `results_log.json`).
- Pendulum results: local TOKW v0.4.0 runs:
  - `runs/pendulum`: 200 × 10 s, Qwen2.5-VL-3B
  - `runs/pendulum_15s/…_grounded_final`: 30 × 15 s, Qwen2.5-VL-7B
  - `runs/pendulum_15s/…_grounded_gtuni`: labels from θ and ω
  - `runs/pendulum_15s/exp_forced_position`: the VLM quadrant probe
  - `runs/pendulum_notorque`: the unforced pendulum
- First Proof: the released dataset in `Zetetic-Dhruv/First-Proof-Benchmark-Results` (`tactic_data.csv`: the four gate columns over 85 typed steps; `Search Role` and `Rejection Source` for the 26 steps that fail generalization robustness).
- Walsh acquisition (presentation stage): `noumenal-ai/anytime-anywhere-pac-bayes`, `data/w2_spi_battery_20260824`: sealed field `sealed/E_star.tsv`, recovered field `results/phi_hat_m100.tsv` (plus the mean of the sealed field), teacher policy and path `results/secondary.tsv`, held-out error `results/primary.tsv`.
- Motor-protection twin (Panasonic): the recorded demo of the causal twin (question, intervention, answer and reason; the soft-starter mechanism added in the session).
- Ather K383 world model: the v6 graph JSON and its user guide (node and edge counts by type), the build log through v13 (error-code coverage, LLM-imagined links, 8D folding), the v14 rebuild report, the Feb 2026 discovery-loop recording, and the synthetic-benchmark write-up (DFKI nesy_diag_bench sample).
