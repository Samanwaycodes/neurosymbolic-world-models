/* =========================================================================
   board.js — turns plain SVG into hand-drawn sketches (rough.js), draws the
   goal-board connectors and the Kripke graph on the model card.
   Everything degrades to plain SVG if rough.js fails to load.
   ========================================================================= */
(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const hasRough = typeof window.rough !== "undefined";
  const rootCss = getComputedStyle(document.documentElement);
  const tok = (n, d) => rootCss.getPropertyValue(n).trim() || d;

  const C = {
    ink: tok("--ink", "#2b2925"),
    ink2: tok("--ink-2", "#57524a"),
    ink3: tok("--ink-3", "#8b8477"),
    rule: tok("--rule", "#cfc5b0"),
    blue: tok("--note-blue", "#d3e6f4"),
    green: tok("--note-green", "#d8ecc9"),
  };

  let seed = 11;
  const nextSeed = () => (seed = (seed * 48271) % 2147483647);

  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue;
      if (k === "text") n.textContent = v;
      else n.setAttribute(k, v);
    }
    if (parent) parent.appendChild(n);
    return n;
  }

  const roughOpts = (o = {}) => Object.assign({ roughness: 1.1, bowing: 1, strokeWidth: 1.5, seed: nextSeed() }, o);

  /* Replace every .rk shape inside `svg` with a hand-drawn twin. */
  function roughen(svg) {
    if (!hasRough) return;
    const rc = window.rough.svg(svg);
    $$(".rk", svg).forEach((shape) => {
      const g = (n) => shape.getAttribute(n);
      const num = (n) => parseFloat(g(n));
      const fill = g("fill");
      const o = roughOpts({
        stroke: g("stroke") || C.ink,
        strokeWidth: parseFloat(g("stroke-width")) || 1.5,
        roughness: shape.dataset.rough ? +shape.dataset.rough : 1.1,
        bowing: shape.dataset.bow ? +shape.dataset.bow : 1,
      });
      if (fill && fill !== "none") {
        o.fill = fill;
        o.fillStyle = shape.dataset.fill || "solid";
        o.hachureGap = shape.dataset.gap ? +shape.dataset.gap : 5;
        o.fillWeight = 1.3;
      }
      if (g("stroke-dasharray")) o.strokeLineDash = g("stroke-dasharray").split(/[ ,]+/).map(Number);
      let node = null;
      switch (shape.tagName.toLowerCase()) {
        case "rect": node = rc.rectangle(num("x"), num("y"), num("width"), num("height"), o); break;
        case "ellipse": node = rc.ellipse(num("cx"), num("cy"), 2 * num("rx"), 2 * num("ry"), o); break;
        case "circle": node = rc.circle(num("cx"), num("cy"), 2 * num("r"), o); break;
        case "line": node = rc.line(num("x1"), num("y1"), num("x2"), num("y2"), o); break;
        case "polygon": node = rc.polygon(g("points").trim().split(/\s+/).map((p) => p.split(",").map(Number)), o); break;
        case "path": node = rc.path(g("d"), o); break;
      }
      if (!node) return;
      node.setAttribute("aria-hidden", "true");
      shape.parentNode.insertBefore(node, shape);
      if (shape.hasAttribute("marker-end") || shape.hasAttribute("marker-start")) {
        shape.setAttribute("stroke-opacity", "0"); // keep only for its arrowhead marker
        shape.setAttribute("fill", "none");
      } else {
        shape.remove();
      }
    });
  }

  /* Draw a rough shape directly (plain-SVG fallback). */
  function sketch(svg, kind, args, opts, parent) {
    const target = parent || svg;
    if (hasRough) {
      const node = window.rough.svg(svg)[kind](...args, roughOpts(opts));
      node.setAttribute("aria-hidden", "true");
      target.appendChild(node);
      return node;
    }
    const st = { stroke: opts.stroke || C.ink, "stroke-width": opts.strokeWidth || 1.5, fill: opts.fill || "none" };
    if (opts.strokeLineDash) st["stroke-dasharray"] = opts.strokeLineDash.join(" ");
    switch (kind) {
      case "rectangle": return el("rect", { x: args[0], y: args[1], width: args[2], height: args[3], ...st }, target);
      case "circle": return el("circle", { cx: args[0], cy: args[1], r: args[2] / 2, ...st }, target);
      case "line": return el("line", { x1: args[0], y1: args[1], x2: args[2], y2: args[3], ...st }, target);
      case "path": return el("path", { d: args[0], ...st }, target);
    }
  }

  function arrowhead(svg, x, y, a, color, size = 9, sw = 1.6, parent) {
    const l = [x - size * Math.cos(a - 0.45), y - size * Math.sin(a - 0.45)];
    const r = [x - size * Math.cos(a + 0.45), y - size * Math.sin(a + 0.45)];
    sketch(svg, "path", [`M${l[0]},${l[1]} L${x},${y} L${r[0]},${r[1]}`], { stroke: color, strokeWidth: sw, roughness: 0.6, bowing: 0 }, parent);
  }

  /* ---------- tooltip ---------- */
  const tip = $("#tip");
  function placeTip(x, y) {
    const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    let left = x + pad, top = y + pad;
    if (left + w > window.innerWidth - 8) left = x - w - pad;
    if (top + h > window.innerHeight - 8) top = y - h - pad;
    tip.style.left = Math.max(8, left) + "px";
    tip.style.top = Math.max(8, top) + "px";
  }
  const showTip = (html, x, y) => { tip.innerHTML = html; tip.classList.add("show"); placeTip(x, y); };
  const hideTip = () => tip.classList.remove("show");
  function bindTip(node, html) {
    node.addEventListener("pointerenter", (e) => showTip(html, e.clientX, e.clientY));
    node.addEventListener("pointermove", (e) => placeTip(e.clientX, e.clientY));
    node.addEventListener("pointerleave", hideTip);
    node.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") showTip(html, e.clientX, e.clientY); });
    node.addEventListener("focus", () => { const r = node.getBoundingClientRect(); showTip(html, r.right, r.top); });
    node.addEventListener("blur", hideTip);
  }
  document.addEventListener("scroll", hideTip, { passive: true });

  /* =======================================================================
     1. Static diagrams
     ======================================================================= */
  $$("svg").forEach((svg) => { if ($(".rk", svg)) roughen(svg); });

  /* =======================================================================
     2. Goal board: place the tan note over "Neurosymbolic" + connectors
     ======================================================================= */
  function layoutGoal() {
    const board = $("#goalBoard"), svg = $("#goalConnectors"), tan = $("#tanNote");
    if (!board || !svg) return;
    svg.innerHTML = "";
    if (window.innerWidth <= 960) { tan.style.marginLeft = ""; return; }

    const B = board.getBoundingClientRect();
    const rel = (n) => {
      const r = n.getBoundingClientRect();
      return { l: r.left - B.left, t: r.top - B.top, b: r.bottom - B.top, cx: r.left - B.left + r.width / 2, w: r.width };
    };
    const hlT = rel($("#hlTan"));
    tan.style.marginLeft = Math.max(0, hlT.cx - tan.offsetWidth / 2) + "px";

    const T = rel(tan), P = rel($("#hlPink")), Y = rel($("#hlYellow")), HT = rel($("#hlTan"));
    const panel = rel($("#didactPanel")), wm = rel($("#wmNote")), line = rel($("#goalLine"));
    const draw = (d, color, end) => {
      sketch(svg, "path", [d], { stroke: color, strokeWidth: 1.9, roughness: 1.1, bowing: 1.2 });
      arrowhead(svg, end[0], end[1], Math.PI / 2, color, 11, 1.9);
    };
    draw(`M${T.cx},${T.b + 4} C${T.cx},${(T.b + HT.t) / 2} ${HT.cx},${(T.b + HT.t) / 2} ${HT.cx},${HT.t - 3}`, "#a8733a", [HT.cx, HT.t - 3]);
    draw(`M${P.cx},${P.b + 4} L${P.cx},${panel.t - 6}`, "#c9606d", [P.cx, panel.t - 6]);
    const yMid = Math.max(line.b + 14, Math.min(wm.t - 26, line.b + 40));
    const wx = wm.l + wm.w * 0.55;
    draw(`M${Y.cx},${Y.b + 4} L${Y.cx},${yMid} L${wx},${yMid} L${wx},${wm.t - 6}`, C.ink, [wx, wm.t - 6]);
  }

  /* =======================================================================
     3. Kripke structure (forced pendulum, labels from θ and ω)
        Outer ring = anticlockwise states, inner ring = clockwise states,
        each placed in the quadrant it describes. Transitions under 5% hidden.
     ======================================================================= */
  const ROT = { ccw: "↺", cw: "↻" };
  const ROT_TXT = { ccw: "anticlockwise", cw: "clockwise" };
  const KRIPKE = {
    svg: "#kripkeGT", center: [150, 135], minP: 0.05, maxFrames: 1549,
    nodes: [
      { id: 0, x: 60, y: 45, frames: 243, q: "UL", quad: "upper-left", rot: "ccw", ring: "outer" },
      { id: 1, x: 60, y: 225, frames: 1388, q: "LL", quad: "lower-left", rot: "ccw", ring: "outer" },
      { id: 2, x: 240, y: 225, frames: 1549, q: "LR", quad: "lower-right", rot: "ccw", ring: "outer" },
      { id: 3, x: 240, y: 45, frames: 444, q: "UR", quad: "upper-right", rot: "ccw", ring: "outer" },
      { id: 4, x: 192, y: 93, frames: 252, q: "UR", quad: "upper-right", rot: "cw", ring: "inner" },
      { id: 5, x: 192, y: 177, frames: 1350, q: "LR", quad: "lower-right", rot: "cw", ring: "inner" },
      { id: 6, x: 108, y: 177, frames: 1524, q: "LL", quad: "lower-left", rot: "cw", ring: "inner" },
      { id: 7, x: 108, y: 93, frames: 474, q: "UL", quad: "upper-left", rot: "cw", ring: "inner" },
    ],
    // [source, target, count, probability]
    edges: [[0,0,2,.038],[0,1,51,.962],[1,0,2,.011],[1,1,2,.011],[1,2,180,.978],[2,1,4,.021],[2,2,2,.01],[2,3,70,.359],[2,5,112,.574],[2,6,7,.036],[3,2,8,.092],[3,3,14,.161],[3,4,55,.632],[3,5,10,.115],[4,2,1,.018],[4,5,54,.982],[5,5,4,.022],[5,6,176,.978],[6,0,1,.005],[6,1,102,.537],[6,2,6,.032],[6,5,4,.021],[6,6,5,.026],[6,7,72,.379],[7,0,42,.467],[7,1,23,.256],[7,6,5,.056],[7,7,20,.222]],
  };

  function drawKripke(spec) {
    const svg = $(spec.svg); if (!svg) return;
    const [cx, cy] = spec.center;
    const R = (n) => 9 + 9 * Math.sqrt(n.frames / spec.maxFrames);
    const byId = Object.fromEntries(spec.nodes.map((n) => [n.id, n]));

    // backdrop: the swing circle, quadrant axes and pivot
    const bg = el("g", {}, svg);
    sketch(svg, "circle", [cx, cy, 186], { stroke: C.rule, strokeWidth: 1.1, roughness: 1.1, strokeLineDash: [4, 6] }, bg);
    sketch(svg, "line", [cx, 14, cx, 256], { stroke: C.rule, strokeWidth: 1, roughness: 0.7, strokeLineDash: [3, 5] }, bg);
    sketch(svg, "line", [16, cy, 284, cy], { stroke: C.rule, strokeWidth: 1, roughness: 0.7, strokeLineDash: [3, 5] }, bg);
    sketch(svg, "circle", [cx, cy, 6], { stroke: C.ink, fill: C.ink, fillStyle: "solid", roughness: 0.4 }, bg);
    [["upper", cx, 9, "middle"], ["lower", cx, 269, "middle"], ["left", 0, cy - 4, "start"], ["right", 300, cy - 4, "end"]].forEach(([t, x, y, a]) =>
      el("text", { x, y, text: t, "text-anchor": a, "font-size": 13, fill: C.ink3, "font-family": "Caveat, cursive" }, bg));

    const eg = el("g", {}, svg), ng = el("g", {}, svg);

    spec.edges.forEach(([s, t, count, p]) => {
      const a = byId[s], b = byId[t];
      if (s === t) {
        if (p < 0.1) return;
        let ux = a.x - cx, uy = a.y - cy;
        const L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L;
        if (a.ring === "inner") { ux = -ux; uy = -uy; } // inner-ring loops point to the centre
        const lr = 7, lx = a.x + ux * (R(a) + lr - 2), ly = a.y + uy * (R(a) + lr - 2);
        sketch(svg, "circle", [lx, ly, lr * 2], { stroke: C.ink, strokeWidth: 1 + 1.5 * p, roughness: 0.7 }, eg);
        return;
      }
      if (p < spec.minP) return;
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      let nx = -dy / len, ny = dx / len, bend = 0.1;
      const midx = (a.x + b.x) / 2, midy = (a.y + b.y) / 2;
      if (a.ring === b.ring) {
        // ring edges bow outward; the weaker of a reciprocal pair bows inward
        if (nx * (midx - cx) + ny * (midy - cy) < 0) { nx = -nx; ny = -ny; }
        bend = 0.2;
        const rev = spec.edges.find(([s2, t2]) => s2 === t && t2 === s);
        if (rev && rev[3] > p) { nx = -nx; ny = -ny; bend = 0.12; }
      }
      const qx = midx + nx * bend * len, qy = midy + ny * bend * len;
      const sa = Math.atan2(qy - a.y, qx - a.x), sb = Math.atan2(qy - b.y, qx - b.x);
      const x1 = a.x + (R(a) + 2) * Math.cos(sa), y1 = a.y + (R(a) + 2) * Math.sin(sa);
      const x2 = b.x + (R(b) + 3) * Math.cos(sb), y2 = b.y + (R(b) + 3) * Math.sin(sb);
      const d = `M${x1},${y1} Q${qx},${qy} ${x2},${y2}`;
      const sw = 0.9 + 2.4 * p;
      sketch(svg, "path", [d], { stroke: C.ink, strokeWidth: sw, roughness: 0.6, bowing: 0.4 }, eg);
      arrowhead(svg, x2, y2, Math.atan2(y2 - qy, x2 - qx), C.ink, 5 + 2 * p, Math.max(1.1, sw * 0.8), eg);
      const hit = el("path", { d, fill: "none", stroke: "transparent", "stroke-width": 10 }, eg);
      bindTip(hit, `<b>s${s} → s${t}</b>p = ${p.toFixed(2)} (${count} transitions)`);
    });

    spec.nodes.forEach((n) => {
      const r = R(n);
      const col = n.rot === "ccw" ? { fill: C.blue, stroke: "#2a6fb8" } : { fill: C.green, stroke: "#1a6e3c" };
      const g = el("g", { class: "node", tabindex: 0, role: "img", "aria-label": `state s${n.id}: ${n.quad}, ${ROT_TXT[n.rot]}, ${n.frames} frames` }, ng);
      sketch(svg, "circle", [n.x, n.y, r * 2], { stroke: col.stroke, strokeWidth: 1.8, fill: col.fill, fillStyle: "solid", roughness: 0.8 }, g);
      el("text", { x: n.x, y: n.y + 1, text: n.q, "text-anchor": "middle", "font-size": 13, fill: C.ink }, g);
      el("text", { x: n.x, y: n.y + 11, text: ROT[n.rot], "text-anchor": "middle", "font-size": 11, fill: C.ink2 }, g);
      el("circle", { cx: n.x, cy: n.y, r: r + 3, fill: "transparent" }, g);
      bindTip(g, `<b>s${n.id}</b>${n.frames.toLocaleString()} frames · bob in the ${n.quad} quadrant, moving ${ROT_TXT[n.rot]}`);
    });
  }

  /* =======================================================================
     4. Learnt-vs-expert causal graph (Spohn card, hydraulics subsystem)
        Edge status follows the B1 report: correct / reversed (drawn in the
        learnt direction) / extra (learnt, not in expert) / missed (expert only).
     ======================================================================= */
  const EDGE_STYLE = {
    ok: { stroke: "#1a9e6a", width: 2, label: "matches the expert graph" },
    rev: { stroke: "#d08a00", width: 2, label: "learnt, but reversed" },
    extra: { stroke: "#d14b4b", width: 1.8, dash: [5, 4], label: "learnt, not in the expert graph" },
    miss: { stroke: "#8b8477", width: 1.6, dash: [2, 4], label: "expert edge the model missed" },
  };
  // Hydraulics: laid out around the hub Hyd_Pump_On (degree 7 counting missed edges).
  const DAG_HYDRAULICS = {
    svg: "#dagHydraulics", prefix: "Hyd_",
    nodes: {
      Hyd_Filter_Ok: [55, 40], Hyd_A_700207: [155, 40, "alarm"], Hyd_A_700204: [290, 40, "alarm"], Hyd_Temp_lt_80: [390, 40],
      Hyd_IsEnabled: [220, 100], Hyd_Temp_lt_70: [390, 110],
      Hyd_Pump_Ok: [95, 160], Hyd_Pump_On: [220, 160, "hub"], Hyd_A_700203: [390, 175, "alarm"],
      Hyd_Level_Ok: [45, 235], Hyd_A_700208: [130, 235, "alarm"], Hyd_Pump_isOff: [240, 240], Hyd_Pressure: [330, 235],
      Hyd_A_700205: [45, 290, "alarm"], Hyd_A_700206: [150, 290, "alarm"], Hyd_A_700202: [300, 290, "alarm"], Hyd_Valve_P_Up: [400, 290],
    },
    // [from, to, status, optional curve control point] from results_log.json champion_graph_vs_expert.
    // Expert edges with no evidence in the learning rows (tools/edge_evidence.py) are left out:
    // Hyd_A_700207 -> Hyd_IsEnabled (p = 1.0; the alarm fires in 7 rows of 2 runs and IsEnabled never reacts).
    edges: [
      ["Hyd_Filter_Ok", "Hyd_A_700207", "ok"], ["Hyd_Level_Ok", "Hyd_A_700205", "ok"], ["Hyd_Level_Ok", "Hyd_A_700206", "ok"],
      ["Hyd_Pressure", "Hyd_A_700202", "ok"], ["Hyd_Pump_Ok", "Hyd_A_700208", "ok"], ["Hyd_Pump_On", "Hyd_Pump_isOff", "ok"],
      ["Hyd_Temp_lt_70", "Hyd_A_700203", "ok"], ["Hyd_Temp_lt_70", "Hyd_Temp_lt_80", "ok"], ["Hyd_Temp_lt_80", "Hyd_A_700204", "ok"],
      ["Hyd_Valve_P_Up", "Hyd_Pressure", "rev"],
      ["Hyd_IsEnabled", "Hyd_Pump_On", "extra"], ["Hyd_Pump_On", "Hyd_Pressure", "extra"], ["Hyd_Pump_On", "Hyd_Temp_lt_70", "extra"],
      ["Hyd_A_700202", "Hyd_Pump_On", "miss", [292, 208]], ["Hyd_A_700202", "Hyd_Valve_P_Up", "miss"],
      ["Hyd_A_700204", "Hyd_IsEnabled", "miss"], ["Hyd_A_700206", "Hyd_Pump_On", "miss"],
      ["Hyd_Filter_Ok", "Hyd_Pump_Ok", "miss"], ["Hyd_Level_Ok", "Hyd_Pump_Ok", "miss"], ["Hyd_Pump_Ok", "Hyd_Pump_On", "miss"],
    ],
  };

  function drawDag(spec) {
    const svg = $(spec.svg); if (!svg) return;
    const box = {};
    const ng = el("g", {}, svg), eg = el("g", {}, svg);
    svg.insertBefore(eg, ng); // edges under nodes
    for (const [name, [x, y, kind]] of Object.entries(spec.nodes)) {
      const label = spec.prefix ? name.replace(spec.prefix, "") : name;
      const hub = kind === "hub";
      const w = label.length * (hub ? 7 : 6.3) + 16, h = hub ? 24 : 20;
      box[name] = { x, y, w, h };
      const g = el("g", {}, ng);
      const fill = kind === "alarm" ? "#efe9dc" : hub ? "#fbf1a9" : "#ffffff";
      sketch(svg, "rectangle", [x - w / 2, y - h / 2, w, h], { stroke: C.ink, strokeWidth: hub ? 2.2 : 1.1, fill, fillStyle: "solid", roughness: 0.7 }, g);
      el("text", { x, y: y + 4, text: label, "text-anchor": "middle", "font-size": hub ? 13 : 11.5, fill: C.ink }, g);
      bindTip(g, `<b>${name}</b>${kind === "alarm" ? "alarm" : hub ? "hub: most connected variable" : "process variable"}`);
    }
    // point on a box edge in the direction of (tx, ty)
    const clip = (b, tx, ty, pad) => {
      const dx = tx - b.x, dy = ty - b.y;
      const sx = dx ? (b.w / 2 + pad) / Math.abs(dx) : Infinity, sy = dy ? (b.h / 2 + pad) / Math.abs(dy) : Infinity;
      const s = Math.min(sx, sy);
      return [b.x + dx * s, b.y + dy * s];
    };
    spec.edges.forEach(([a, b, status, ctrl]) => {
      const st = EDGE_STYLE[status], A = box[a], B = box[b];
      const c = ctrl || [(A.x + B.x) / 2, (A.y + B.y) / 2];
      const p1 = clip(A, c[0], c[1], 1), p2 = clip(B, c[0], c[1], 3);
      const d = ctrl ? `M${p1[0]},${p1[1]} Q${c[0]},${c[1]} ${p2[0]},${p2[1]}` : `M${p1[0]},${p1[1]} L${p2[0]},${p2[1]}`;
      sketch(svg, "path", [d], { stroke: st.stroke, strokeWidth: st.width, roughness: 0.6, bowing: 0.3, strokeLineDash: st.dash }, eg);
      arrowhead(svg, p2[0], p2[1], Math.atan2(p2[1] - c[1], p2[0] - c[0]), st.stroke, 7, 1.6, eg);
      const hit = el("path", { d, fill: "none", stroke: "transparent", "stroke-width": 10 }, eg);
      bindTip(hit, `<b>${a} → ${b}</b>${st.label}`);
    });
  }

  /* =======================================================================
     5. Small hand-drawn grouped bar charts (Spohn card)
     ======================================================================= */
  const SERIES = [
    { name: "learnt graph", color: tok("--series-1", "#2a78d6"), angle: -45 },
    { name: "expert graph", color: tok("--series-2", "#eb6834"), angle: 45 },
    { name: "PC / FCI", color: tok("--series-3", "#1baf7a"), angle: 90 },
  ];
  const GROUPS = ["probe", "hydraulics", "coolant"];

  function drawBars(sel, series, values, H) {
    const svg = $(sel); if (!svg) return;
    const W = 430, ML = 30, MR = 6, T = 8, B = H - 18;
    const y = (v) => B - v * (B - T);
    const g = el("g", {}, svg);
    [0, 0.5, 1].forEach((v) => {
      el("line", { x1: ML, x2: W - MR, y1: y(v), y2: y(v), stroke: v ? C.rule : C.ink3, "stroke-width": 1, "stroke-dasharray": v ? "2 5" : null }, g);
      el("text", { x: ML - 6, y: y(v) + 4, text: v ? v.toFixed(1) : "0", "text-anchor": "end", "font-size": 11.5, fill: C.ink2 }, g);
    });
    const gw = (W - ML - MR) / GROUPS.length, bw = 26, gap = 5;
    GROUPS.forEach((name, gi) => {
      const span = series.length * bw + (series.length - 1) * gap;
      const x0 = ML + gi * gw + (gw - span) / 2;
      series.forEach((s, si) => {
        const v = values[si][gi], bx = x0 + si * (bw + gap);
        sketch(svg, "rectangle", [bx, y(v), bw, B - y(v)], { stroke: s.color, strokeWidth: 1.4, fill: s.color, fillStyle: "hachure", hachureAngle: s.angle, hachureGap: 4, fillWeight: 1.2, roughness: 0.8 }, g);
        if (si === 0) el("text", { x: bx + bw / 2, y: y(v) - 4, text: v.toFixed(2), "text-anchor": "middle", "font-size": 11.5, fill: C.ink }, g);
        const hit = el("rect", { x: bx - 2, y: Math.min(y(v), B - 24), width: bw + 4, height: Math.max(B - y(v), 24), fill: "transparent" }, g);
        bindTip(hit, `<b>${name}</b>${s.name}: ${v.toFixed(3)}`);
      });
      el("text", { x: ML + gi * gw + gw / 2, y: H - 3, text: name, "text-anchor": "middle", "font-size": 12.5, fill: C.ink }, g);
    });
  }

  /* =======================================================================
     5b. DiG-bench A vs B race (Spohn card extension)
         Per game and arm: actions at each level-up, lives lost, refresh bursts.
         Source: runs/digbench_gpt_t123_001 (P-1, P-2, P-4, P-6, P-8) and
         runs/digbench_gpt_p3_004 (P-3, 400-action cap, stopped on request), read
         from level_reach.json / per-turn logs / refresh.json.
     ======================================================================= */
  const DIG_GAMES = [
    { id: "P-1", tier: 1, verdict: "tie", note: "B faster to L3–L6",
      A: { end: 200, ups: [5, 40, 69, 102, 131, 170], lives: [], how: "cap" },
      B: { end: 200, ups: [5, 32, 60, 96, 128, 174], lives: [], how: "cap", refresh: [[139, 170, true]] } },
    { id: "P-2", tier: 1, verdict: "tie", note: "neither cleared",
      A: { end: 200, ups: [], lives: [100, 200], how: "cap" },
      B: { end: 200, ups: [], lives: [100, 200], how: "cap" } },
    { id: "P-3", tier: 1, verdict: "B", note: "400 cap, stopped",
      A: { end: 343, ups: [251, 294], lives: [126, 242], how: "stopped" },
      B: { end: 234, ups: [40, 73, 167], lives: [112], how: "stopped", refresh: [[123, 159, true]] } },
    { id: "P-4", tier: 2, verdict: "A", note: "refresh failed",
      A: { end: 166, ups: [37, 47, 70, 103, 131, 140], lives: [23, 65, 86, 120, 150, 166], how: "game over" },
      B: { end: 142, ups: [40, 86, 96], lives: [30, 58, 77, 109, 126, 142], how: "game over", refresh: [[106, 109, false]] } },
    { id: "P-6", tier: 2, verdict: "B", note: "L1 in 15 vs 27",
      A: { end: 200, ups: [27], lives: [157], how: "cap" },
      B: { end: 200, ups: [15, 164], lives: [108], how: "cap" } },
    { id: "P-8", tier: 3, verdict: "tie", note: "neither cleared",
      A: { end: 200, ups: [], lives: [147], how: "cap" },
      B: { end: 200, ups: [], lives: [], how: "cap" } },
  ];

  function drawRace(sel, games) {
    const svg = $(sel); if (!svg) return;
    const X0 = 92, X1 = 716, MAX = 350, ROW = 40, TOP = 22;
    const x = (a) => X0 + (a / MAX) * (X1 - X0);
    const col = { A: "#8b8477", B: tok("--series-1", "#2a78d6") };
    const g = el("g", {}, svg);
    const bottom = TOP + games.length * ROW;
    [0, 100, 200, 300].forEach((a) => {
      el("line", { x1: x(a), x2: x(a), y1: TOP - 4, y2: bottom, stroke: C.rule, "stroke-width": 1, "stroke-dasharray": "2 5" }, g);
      el("text", { x: x(a), y: bottom + 16, text: a, "text-anchor": "middle", "font-size": 12, fill: C.ink2 }, g);
    });
    el("text", { x: X1, y: bottom + 16, text: "actions", "text-anchor": "end", "font-size": 12, fill: C.ink2 }, g);
    sketch(svg, "line", [x(200), TOP - 12, x(200), bottom], { stroke: C.ink3, strokeWidth: 1.3, roughness: 0.6, strokeLineDash: [6, 4] }, g);
    el("text", { x: x(200) + 4, y: TOP - 8, text: "200-action cap", "font-size": 12, fill: C.ink3, "font-family": "Caveat, cursive" }, g);

    games.forEach((game, i) => {
      const y0 = TOP + i * ROW;
      if (i) el("line", { x1: 0, x2: 960, y1: y0, y2: y0, stroke: C.rule, "stroke-width": 0.8, "stroke-dasharray": "1 4" }, g);
      el("text", { x: 4, y: y0 + 21, text: game.id, "font-size": 17, fill: C.ink, "font-family": "Caveat, cursive", "font-weight": 700 }, g);
      el("text", { x: 4, y: y0 + 35, text: `tier ${game.tier}`, "font-size": 11.5, fill: C.ink3 }, g);
      [["A", y0 + 12], ["B", y0 + 28]].forEach(([arm, y]) => {
        const r = game[arm];
        el("text", { x: X0 - 10, y: y + 4, text: arm, "text-anchor": "end", "font-size": 12, fill: col[arm], "font-weight": 700 }, g);
        (r.refresh || []).forEach(([a, b, ok]) => {
          sketch(svg, "rectangle", [x(a), y - 6, Math.max(4, x(b) - x(a)), 12], { stroke: ok ? col.B : C.warn, strokeWidth: 1.2, fill: ok ? col.B : C.warn, fillStyle: "hachure", hachureGap: 2.6, fillWeight: 0.8, roughness: 0.6 }, g);
        });
        sketch(svg, "line", [x(0), y, x(r.end), y], { stroke: col[arm], strokeWidth: 3, roughness: 0.5, bowing: 0.2 }, g);
        r.ups.forEach((a, k) => {
          sketch(svg, "circle", [x(a), y, 15], { stroke: "#fffdf7", strokeWidth: 1.2, fill: col[arm], fillStyle: "solid", roughness: 0.4 }, g);
          el("text", { x: x(a), y: y + 3.5, text: k + 2, "text-anchor": "middle", "font-size": 9.5, fill: "#ffffff", "font-weight": 700 }, g);
        });
        r.lives.forEach((a) => el("text", { x: x(a), y: y + 4.5, text: "×", "text-anchor": "middle", "font-size": 14, fill: C.warn, "font-weight": 700, stroke: "#fffdf7", "stroke-width": 3, "paint-order": "stroke" }, g));
        const level = r.ups.length + 1;
        el("text", { x: x(r.end) + 7, y: y + 4, text: `L${level}${r.how === "game over" ? " · game over" : r.how === "stopped" ? " · stopped" : ""}`, "font-size": 11.5, fill: col[arm], "font-weight": 700 }, g);
        const hit = el("rect", { x: x(0), y: y - 8, width: x(r.end) - x(0), height: 16, fill: "transparent" }, g);
        bindTip(hit, `<b>${game.id} · ${arm === "A" ? "A, no help" : "B, with world model"}</b>${r.ups.length ? "level-ups at actions " + r.ups.join(", ") : "no level cleared"}; ended at L${level} after ${r.end} actions (${r.how})${r.lives.length ? "; " + r.lives.length + " lives lost" : ""}`);
      });
      const badge = { B: ["B ahead", col.B, "#d3e6f4"], A: ["A ahead", "#57524a", "#ebe7de"], tie: ["tie", C.ink2, "#fffdf7"] }[game.verdict];
      sketch(svg, "rectangle", [812, y0 + 7, 70, 20], { stroke: badge[1], strokeWidth: 1.4, fill: badge[2], fillStyle: "solid", roughness: 0.7 }, g);
      el("text", { x: 847, y: y0 + 21, text: badge[0], "text-anchor": "middle", "font-size": 13, fill: badge[1], "font-weight": 700 }, g);
      el("text", { x: 847, y: y0 + 37, text: game.note, "text-anchor": "middle", "font-size": 11, fill: C.ink3 }, g);
    });
  }

  /* =======================================================================
     6. Reveal on scroll
     ======================================================================= */
  function reveal() {
    const items = $$(".reveal");
    if (!("IntersectionObserver" in window)) { items.forEach((i) => i.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    items.forEach((i) => io.observe(i));
  }

  /* ---------- boot ---------- */
  drawKripke(KRIPKE);
  drawDag(DAG_HYDRAULICS);
  // CausalPrio-TimeRecency MAP@3 and edge F1 (B1_summary / benchmark_comparison.json)
  drawBars("#chartMap", SERIES, [[0.4485, 0.7439, 0.8333], [0.5833, 0.7439, 1.0], [0.3676, 0.4797, 0.8667]], 128);
  drawBars("#chartF1", [SERIES[0], SERIES[2]], [[0.5333, 0.5806, 0.5714], [0.3704, 0.4, 0.3]], 112);
  drawRace("#raceDig", DIG_GAMES);
  reveal();
  let t;
  window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(layoutGoal, 120); });
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(layoutGoal);
  window.addEventListener("load", layoutGoal);
})();
