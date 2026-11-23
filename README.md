# Neuro-Symbolic World Models: project board

A single-page, hand-drawn GitHub Pages site that showcases the auto-didactic neuro-symbolic world-model work.

- **§1 The goal**: a reproduction of the original board page, including the classical and autodidactic teacher–learner diagrams.
- **§2 Recent models**: one card per model. TOKW is the first, with results from the Gymnasium forced-pendulum runs. The mountain-car slot is a placeholder until those results are added.
- **§3 Up next**: placeholders.

No build step is needed: it's plain HTML, CSS and JS. rough.js (from jsDelivr) gives shapes their hand-drawn look. Without it, the same shapes render as clean SVG.

## Deploy to GitHub Pages

1. Push this folder to the root of a repository.
2. In **Settings → Pages**, set *Source* to **Deploy from a branch**, then pick `main` and `/ (root)`.
3. `.nojekyll` is already included, so the files are served as-is.

To preview locally, run `python -m http.server 8765` and open http://localhost:8765.

## Layout

```
index.html                  all content; chart data for the signals figure is inlined
assets/css/style.css        paper, sticky notes, tape, highlighters, layout
assets/js/board.js          rough.js pass, goal-board connectors, charts, Kripke graphs
assets/img/tokw/*.gif       pendulum episodes with physics vs VLM labels overlaid
tools/make_pendulum_assets.py  regenerates the GIFs from the local TOKW v0.4.0 run folders
```

## Adding another model

Copy the `<article class="project-card">` block in `index.html` and keep the same order:
title + chips → architecture diagram (`.pipeline` SVG, with `class="rk"` on any shape you want hand-drawn) → **What** / **How** notes → **How does it perform?** (one `.testbed` block per environment) → **Known limitations**.

- Any `rect`, `ellipse`, `circle`, `line`, `polygon` or `path` with `class="rk"` is redrawn in a sketchy style. Add `marker-end="url(#ah)"` to get an arrowhead.
- Charts and Kripke graphs are drawn by `board.js` from small data objects (`RUNS`, `KRIPKE`). Add a new entry there and a matching `<div class="chart" id="…">` host.

## Data sources

- Architecture and design notes: `artpark-hub/neuro-sym-wm` (`explainable_kripke/README.md`, phyre-benchmark branch).
- Pendulum results: local TOKW v0.4.0 runs:
  - `runs/pendulum`: 200 × 10 s, Qwen2.5-VL-3B
  - `runs/pendulum_15s/…_grounded_final`: 30 × 15 s, Qwen2.5-VL-7B
  - `runs/pendulum_15s/…_grounded_gtuni`: labels from θ and ω
  - `runs/pendulum_15s/exp_forced_position`: the VLM quadrant probe
  - `runs/pendulum_notorque`: the unforced pendulum
