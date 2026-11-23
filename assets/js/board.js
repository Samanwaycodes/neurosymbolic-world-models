/* =========================================================================
   board.js — turns plain SVG into hand-drawn sketches (rough.js), draws the
   goal-board connectors, the charts and the Kripke graphs.
   Everything degrades to plain SVG if rough.js fails to load.
   ========================================================================= */
(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const hasRough = typeof window.rough !== "undefined";
  const rootCss = getComputedStyle(document.documentElement);
  const tok = (n) => rootCss.getPropertyValue(n).trim();

  const C = {
    ink: tok("--ink") || "#2b2925",
    ink2: tok("--ink-2") || "#57524a",
    ink3: tok("--ink-3") || "#8b8477",
    rule: tok("--rule") || "#cfc5b0",
    paper: tok("--paper-2") || "#fbf8f0",
    s1: tok("--series-1") || "#2a78d6",
    s2: tok("--series-2") || "#eb6834",
    warn: tok("--warn") || "#b8323f",
    blue: tok("--note-blue") || "#d3e6f4",
    green: tok("--note-green") || "#d8ecc9",
    yellow: tok("--note-yellow") || "#fbf1a9",
    tan: tok("--note-tan") || "#f0d0a8",
    pink: tok("--note-pink") || "#f4c9c9",
  };

  let seed = 11;
  const nextSeed = () => (seed = (seed * 48271) % 2147483647);

  /* ---------- tiny SVG helper ---------- */
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

  /* ---------- rough.js wrappers ---------- */
  function roughOpts(o = {}) {
    return Object.assign({ roughness: 1.1, bowing: 1, strokeWidth: 1.5, seed: nextSeed() }, o);
  }

  // Replace every .rk shape inside `svg` with a hand-drawn twin.
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
        o.fillWeight = shape.dataset.fw ? +shape.dataset.fw : 1.3;
        if (shape.dataset.angle) o.hachureAngle = +shape.dataset.angle;
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
        // keep the original only for its arrowhead marker
        shape.setAttribute("stroke-opacity", "0");
        shape.setAttribute("fill", "none");
      } else {
        shape.remove();
      }
    });
  }

  // Draw a rough shape directly (with plain-SVG fallback).
  function sketch(svg, kind, args, opts, parent) {
    const target = parent || svg;
    if (hasRough) {
      const rc = window.rough.svg(svg);
      const node = rc[kind](...args, roughOpts(opts));
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
      case "linearPath": return el("polyline", { points: args[0].map((p) => p.join(",")).join(" "), ...st, fill: "none" }, target);
    }
  }

  // Chevron arrowhead at (x, y) pointing along angle a (radians).
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
  function showTip(html, x, y) { tip.innerHTML = html; tip.classList.add("show"); placeTip(x, y); }
  function hideTip() { tip.classList.remove("show"); }
  function bindTip(node, html) {
    node.style.cursor = "pointer";
    node.addEventListener("pointerenter", (e) => showTip(typeof html === "function" ? html() : html, e.clientX, e.clientY));
    node.addEventListener("pointermove", (e) => placeTip(e.clientX, e.clientY));
    node.addEventListener("pointerleave", hideTip);
    node.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") showTip(typeof html === "function" ? html() : html, e.clientX, e.clientY); });
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
      return { l: r.left - B.left, t: r.top - B.top, r: r.right - B.left, b: r.bottom - B.top, cx: r.left - B.left + r.width / 2, w: r.width };
    };

    // centre the tan note above the word it annotates
    const hlT = rel($("#hlTan"));
    const want = hlT.cx - tan.offsetWidth / 2;
    tan.style.marginLeft = Math.max(0, want) + "px";

    const T = rel(tan), P = rel($("#hlPink")), Y = rel($("#hlYellow")), HT = rel($("#hlTan"));
    const panel = rel($("#didactPanel")), wm = rel($("#wmNote")), line = rel($("#goalLine"));

    const draw = (d, color, end, ang) => {
      sketch(svg, "path", [d], { stroke: color, strokeWidth: 1.9, roughness: 1.1, bowing: 1.2 });
      arrowhead(svg, end[0], end[1], ang, color, 11, 1.9);
    };
    // tan note → "Neurosymbolic"
    draw(`M${T.cx},${T.b + 4} C${T.cx},${(T.b + HT.t) / 2} ${HT.cx},${(T.b + HT.t) / 2} ${HT.cx},${HT.t - 3}`, "#a8733a", [HT.cx, HT.t - 3], Math.PI / 2);
    // "Auto-didactic" → pink panel
    draw(`M${P.cx},${P.b + 4} L${P.cx},${panel.t - 6}`, "#c9606d", [P.cx, panel.t - 6], Math.PI / 2);
    // "world models" → yellow note (elbow, as on the original board)
    const yMid = Math.max(line.b + 14, Math.min(wm.t - 26, line.b + 40));
    const wx = wm.l + wm.w * 0.55;
    draw(`M${Y.cx},${Y.b + 4} L${Y.cx},${yMid} L${wx},${yMid} L${wx},${wm.t - 6}`, C.ink, [wx, wm.t - 6], Math.PI / 2);
  }

  /* =======================================================================
     3. Charts
     ======================================================================= */
  function scale(d0, d1, r0, r1) { return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0); }

  function chartSvg(host, w, h, label) {
    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, role: "img", "aria-label": label }, host);
    return svg;
  }

  /* ---- 3a. signals: ω / latent speed / surprise ---- */
  function chartSignals() {
    const host = $("#chartSignals"), src = $("#dataSignals");
    if (!host || !src) return;
    let D;
    try { D = JSON.parse(src.textContent); } catch (e) { host.textContent = "(data unavailable)"; return; }
    const W = 760, H = 384, ML = 128, MR = 14, PH = 88, GAP = 24, T0 = 14;
    const svg = chartSvg(host, W, H, "Three stacked panels over a 15 second episode: angular velocity, latent speed and surprise, with true reversals marked.");
    const n = D.theta_dot.length;
    const x = scale(0, n - 1, ML, W - MR);
    const panels = [
      { key: "theta_dot", name: ["angular", "velocity ω"], unit: "rad/s", dom: [-7.5, 7.5], color: C.ink, zero: true, fmt: (v) => v.toFixed(1) },
      { key: "latent_speed", name: ["latent speed", "‖zₜ₊₁ − zₜ‖"], unit: "", dom: [0, 100], color: C.s1, fmt: (v) => v.toFixed(0) },
      { key: "surprise", name: ["surprise", "(pred. error)"], unit: "", dom: [0, 1.45], color: C.s2, fmt: (v) => v.toFixed(2) },
    ];
    const g = el("g", {}, svg);
    panels.forEach((p, i) => {
      const top = T0 + i * (PH + GAP), bot = top + PH;
      p.y = scale(p.dom[0], p.dom[1], bot, top); p.top = top; p.bot = bot;
      // frame + light grid
      el("line", { x1: ML, x2: W - MR, y1: bot, y2: bot, stroke: C.rule, "stroke-width": 1 }, g);
      if (p.zero) el("line", { x1: ML, x2: W - MR, y1: p.y(0), y2: p.y(0), stroke: C.rule, "stroke-width": 1, "stroke-dasharray": "3 4" }, g);
      el("text", { x: 6, y: top + 30, text: p.name[0], class: "t-ink", "font-size": 15 }, g);
      el("text", { x: 6, y: top + 48, text: p.name[1], "font-size": 14 }, g);
      el("text", { x: ML - 8, y: top + 10, text: p.fmt(p.dom[1]), "text-anchor": "end", "font-size": 12 }, g);
      el("text", { x: ML - 8, y: bot, text: p.fmt(p.dom[0]), "text-anchor": "end", "font-size": 12 }, g);
    });
    // reversal ticks across all panels
    D.reversals.forEach((r) => {
      el("line", { x1: x(r), x2: x(r), y1: T0 - 4, y2: T0 + 3 * PH + 2 * GAP, stroke: C.warn, "stroke-width": 1.4, "stroke-dasharray": "2 4", opacity: 0.75 }, g);
    });
    // data lines
    panels.forEach((p) => {
      const pts = [];
      D[p.key].forEach((v, i) => { if (v !== null && v !== undefined) pts.push([x(i), p.y(Math.max(p.dom[0], Math.min(p.dom[1], v)))]); });
      sketch(svg, "linearPath", [pts], { stroke: p.color, strokeWidth: 1.8, roughness: 0.35, bowing: 0.2 }, g);
    });
    // time axis
    const axisY = T0 + 3 * PH + 2 * GAP;
    for (let s = 0; s <= 15; s += 3) {
      el("text", { x: x(s * D.fps), y: axisY + 18, text: s + "s", "text-anchor": "middle", "font-size": 13 }, g);
    }
    // annotations
    const ls = panels[1], su = panels[2];
    const ann = (tx, ty, text, px, py, anchor = "start") => {
      el("text", { x: tx, y: ty, text, class: "t-script t-ink", "font-size": 19, "text-anchor": anchor }, g);
      sketch(svg, "line", [tx + (anchor === "end" ? -4 : 4), ty + 4, px, py], { stroke: C.ink2, strokeWidth: 1.2, roughness: 0.9 }, g);
      arrowhead(svg, px, py, Math.atan2(py - ty - 4, px - tx), C.ink2, 7, 1.3, g);
    };
    const f1 = 136;
    ann(x(f1) + 34, ls.top + 18, "dips at every reversal", x(f1) + 2, ls.y(D.latent_speed[f1]) - 4);
    const f2 = 113;
    ann(x(f2) - 40, su.top + 8, "no spike at reversals", x(f2) - 2, su.y(D.surprise[f2]) - 6, "end");

    // hover crosshair
    const cross = el("line", { y1: T0 - 4, y2: axisY, stroke: C.ink, "stroke-width": 1, opacity: 0 }, svg);
    const hit = el("rect", { x: ML, y: T0 - 4, width: W - ML - MR, height: axisY - T0 + 4, fill: "transparent" }, svg);
    const pick = (e) => {
      const r = svg.getBoundingClientRect();
      const fx = ((e.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((fx - ML) / (W - MR - ML)) * (n - 1))));
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("opacity", 0.5);
      const near = D.reversals.some((r) => Math.abs(r - i) <= 1);
      showTip(`<b>t = ${(i / D.fps).toFixed(2)} s${near ? " · reversal" : ""}</b>ω = ${D.theta_dot[i].toFixed(2)} rad/s<br>latent speed = ${D.latent_speed[i] == null ? "–" : D.latent_speed[i].toFixed(1)}<br>surprise = ${D.surprise[i].toFixed(3)}`, e.clientX, e.clientY);
    };
    hit.addEventListener("pointermove", pick);
    hit.addEventListener("pointerdown", pick);
    hit.addEventListener("pointerleave", () => { cross.setAttribute("opacity", 0); hideTip(); });
  }

  /* ---- 3b. dumbbell: model vs persistence ---- */
  const RUNS = [
    { id: "A", name: "A · VLM-3B, 10 s", sub: "40 held-out", model: 0.8963, persist: 0.8523, trans: 0.5108, f1: 0.8111 },
    { id: "B", name: "B · VLM-7B, 15 s", sub: "6 held-out", model: 0.9679, persist: 0.9573, trans: 0.4824, f1: 0.696 },
    { id: "C", name: "C · state labels, 15 s", sub: "6 held-out", model: 0.9681, persist: 0.9524, trans: 0.5759, f1: 0.6542 },
  ];

  function chartDumbbell() {
    const host = $("#chartDumbbell"); if (!host) return;
    const W = 520, H = 236, ML = 168, MR = 54, T = 22, B = 200;
    const svg = chartSvg(host, W, H, "Dumbbell chart of next-frame accuracy for persistence and the model across three runs; the model is ahead in every run by 1 to 4 points.");
    const x = scale(0.8, 1.0, ML, W - MR);
    const g = el("g", {}, svg);
    [0.8, 0.85, 0.9, 0.95, 1.0].forEach((v) => {
      el("line", { x1: x(v), x2: x(v), y1: T, y2: B, stroke: C.rule, "stroke-width": 1, "stroke-dasharray": "2 5" }, g);
      el("text", { x: x(v), y: B + 20, text: v.toFixed(2), "text-anchor": "middle", "font-size": 13 }, g);
    });
    const rowY = (i) => T + 28 + i * 60;
    RUNS.forEach((r, i) => {
      const y = rowY(i);
      el("text", { x: 0, y: y - 2, text: r.name, class: "t-ink", "font-size": 15 }, g);
      el("text", { x: 0, y: y + 15, text: r.sub, "font-size": 13 }, g);
      sketch(svg, "line", [x(r.persist), y, x(r.model), y], { stroke: C.ink3, strokeWidth: 3, roughness: 0.5, bowing: 0.3 }, g);
      sketch(svg, "circle", [x(r.persist), y, 13], { stroke: C.ink3, strokeWidth: 2, fill: C.paper, fillStyle: "solid", roughness: 0.6 }, g);
      sketch(svg, "circle", [x(r.model), y, 13], { stroke: C.ink, strokeWidth: 1.5, fill: C.ink, fillStyle: "solid", roughness: 0.6 }, g);
      const d = ((r.model - r.persist) * 100).toFixed(1);
      el("text", { x: x(r.model) + 12, y: y + 6, text: "+" + d, class: "t-script t-ink", "font-size": 21 }, g);
      const hit = el("rect", { x: 0, y: y - 24, width: W, height: 48, fill: "transparent" }, svg);
      bindTip(hit, `<b>${r.name}</b>model ${r.model.toFixed(3)} · persistence ${r.persist.toFixed(3)}<br>lift +${d} pts (${r.sub})`);
    });
    el("text", { x: x(0.9), y: H - 0, text: "next-frame accuracy (per proposition)", "text-anchor": "middle", "font-size": 13 }, g);
  }

  /* ---- 3c. grouped bars: transition accuracy + change F1 ---- */
  function chartTransitions() {
    const host = $("#chartTransitions"); if (!host) return;
    const W = 520, H = 252, ML = 40, MR = 8, T = 16, B = 196;
    const svg = chartSvg(host, W, H, "Grouped bar chart of transition accuracy and frame-change F1 for the three runs.");
    const y = scale(0, 1, B, T);
    const g = el("g", {}, svg);
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
      el("line", { x1: ML, x2: W - MR, y1: y(v), y2: y(v), stroke: v === 0 ? C.ink3 : C.rule, "stroke-width": 1, "stroke-dasharray": v === 0 ? null : "2 5" }, g);
      el("text", { x: ML - 8, y: y(v) + 4, text: v === 0 ? "0" : v.toFixed(2).replace(/^0/, ""), "text-anchor": "end", "font-size": 13 }, g);
    });
    const gw = (W - ML - MR) / RUNS.length, bw = 42, gap = 8;
    RUNS.forEach((r, i) => {
      const cx = ML + gw * i + gw / 2;
      [[r.trans, C.s1, -45, "transition accuracy"], [r.f1, C.s2, 45, "frame-change F1"]].forEach(([v, col, ang, lab], j) => {
        const bx = cx - bw - gap / 2 + j * (bw + gap);
        sketch(svg, "rectangle", [bx, y(v), bw, B - y(v)], { stroke: col, strokeWidth: 1.6, fill: col, fillStyle: "hachure", hachureAngle: ang, hachureGap: 5, fillWeight: 1.4, roughness: 0.9 }, g);
        const hit = el("rect", { x: bx - 3, y: Math.min(y(v), B - 30), width: bw + 6, height: Math.max(B - y(v), 30), fill: "transparent" }, svg);
        bindTip(hit, `<b>${r.name}</b>${lab}: ${v.toFixed(3)}`);
      });
      el("text", { x: cx, y: B + 20, text: r.name.split(",")[0], "text-anchor": "middle", class: "t-ink", "font-size": 14 }, g);
      el("text", { x: cx, y: B + 37, text: r.name.split(",")[1].trim(), "text-anchor": "middle", "font-size": 13 }, g);
    });
    // annotate the best transition accuracy
    const ci = 2, cx = ML + gw * ci + gw / 2 - bw / 2 - gap / 2;
    el("text", { x: cx - 52, y: y(0.86), text: "state labels win here", class: "t-script t-ink", "font-size": 19, "text-anchor": "end" }, g);
    sketch(svg, "line", [cx - 50, y(0.84), cx - 4, y(RUNS[2].trans) - 6], { stroke: C.ink2, strokeWidth: 1.2, roughness: 0.9 }, g);
    arrowhead(svg, cx - 4, y(RUNS[2].trans) - 6, Math.atan2(y(RUNS[2].trans) - 6 - y(0.84), 46), C.ink2, 7, 1.3, g);
  }

  /* =======================================================================
     4. Kripke graphs
     ======================================================================= */
  const ROT = { ccw: "↺", cw: "↻" };
  const KRIPKE = {
    gt: {
      svg: "#kripkeGT", readout: "#kripkeGTReadout", center: [230, 200],
      backdrop: true, minP: 0.05,
      nodes: [
        { id: 0, x: 124, y: 94, frames: 243, q: "UL", rot: "ccw", ring: "outer", aps: ["upper-left", "anticlockwise"] },
        { id: 1, x: 124, y: 306, frames: 1388, q: "LL", rot: "ccw", ring: "outer", aps: ["lower-left", "anticlockwise"] },
        { id: 2, x: 336, y: 306, frames: 1549, q: "LR", rot: "ccw", ring: "outer", aps: ["lower-right", "anticlockwise"] },
        { id: 3, x: 336, y: 94, frames: 444, q: "UR", rot: "ccw", ring: "outer", aps: ["upper-right", "anticlockwise"] },
        { id: 4, x: 283, y: 147, frames: 252, q: "UR", rot: "cw", ring: "inner", aps: ["upper-right", "clockwise"] },
        { id: 5, x: 283, y: 253, frames: 1350, q: "LR", rot: "cw", ring: "inner", aps: ["lower-right", "clockwise"] },
        { id: 6, x: 177, y: 253, frames: 1524, q: "LL", rot: "cw", ring: "inner", aps: ["lower-left", "clockwise"] },
        { id: 7, x: 177, y: 147, frames: 474, q: "UL", rot: "cw", ring: "inner", aps: ["upper-left", "clockwise"] },
      ],
      edges: [[0,0,2,.038],[0,1,51,.962],[1,0,2,.011],[1,1,2,.011],[1,2,180,.978],[2,1,4,.021],[2,2,2,.01],[2,3,70,.359],[2,5,112,.574],[2,6,7,.036],[3,2,8,.092],[3,3,14,.161],[3,4,55,.632],[3,5,10,.115],[4,2,1,.018],[4,5,54,.982],[5,5,4,.022],[5,6,176,.978],[6,0,1,.005],[6,1,102,.537],[6,2,6,.032],[6,5,4,.021],[6,6,5,.026],[6,7,72,.379],[7,0,42,.467],[7,1,23,.256],[7,6,5,.056],[7,7,20,.222]],
      maxFrames: 1549,
      color: (n) => (n.rot === "ccw" ? { fill: C.blue, stroke: "#2a6fb8" } : { fill: C.green, stroke: "#1a6e3c" }),
      label: (n) => [n.q, ROT[n.rot]],
      read: (n) => `<b>s${n.id}</b> · ${n.frames.toLocaleString()} frames · the object is in the <b>${n.aps[0]}</b> region, moving <b>${n.aps[1]}</b>`,
    },
    vlm: {
      svg: "#kripkeVLM", readout: "#kripkeVLMReadout", center: [190, 200],
      nodes: [
        { id: 0, x: 96, y: 178, frames: 3669, tag: "slowing down", tagPos: "above", aps: ["slowing down", "at the highest point"] },
        { id: 1, x: 104, y: 330, frames: 1091, tag: "speeding up", loopDir: [-1, 0.15], aps: ["speeding up", "at the highest point"] },
        { id: 2, x: 296, y: 66, frames: 35, tag: "speeding + reversing", tagPos: "above", aps: ["speeding up", "reversing direction", "at the highest point"] },
        { id: 3, x: 220, y: 190, frames: 2360, tag: "slowing + reversing", tagPos: "right", loopDir: [0.2, -1], aps: ["slowing down", "reversing direction", "at the highest point"] },
        { id: 4, x: 330, y: 318, frames: 52, tag: "lowest point (!)", bad: true, aps: ["slowing down", "reversing direction", "at the lowest point"] },
        { id: 5, x: 226, y: 340, frames: 17, tag: "lowest point (!)", bad: true, aps: ["speeding up", "reversing direction", "at the lowest point"] },
      ],
      edges: [[0,0,129,.884],[0,1,13,.089],[0,3,4,.027],[1,0,14,.318],[1,1,30,.682],[2,3,2,1],[3,0,2,.022],[3,3,91,.978],[4,3,2,1],[5,3,1,1]],
      maxFrames: 3669,
      color: (n) => ({ fill: C.yellow, stroke: n.bad ? C.warn : C.ink }),
      label: (n) => ["s" + n.id],
      read: (n) => `<b>s${n.id}</b> · ${n.frames.toLocaleString()} frames · pointing up · swinging left · ${n.aps.map((a) => (a.includes("lowest") ? `<b style="color:${C.warn}">${a}</b>` : a)).join(" · ")}`,
    },
  };

  function drawKripke(spec) {
    const svg = $(spec.svg); if (!svg) return;
    const out = $(spec.readout);
    const [cx, cy] = spec.center;
    const R = (n) => 12 + 14 * Math.sqrt(n.frames / spec.maxFrames);
    const byId = Object.fromEntries(spec.nodes.map((n) => [n.id, n]));
    const has = new Set(spec.edges.map(([s, t]) => s + ">" + t));

    if (spec.backdrop) {
      const bg = el("g", { opacity: 0.9 }, svg);
      sketch(svg, "circle", [cx, cy, 224], { stroke: C.rule, strokeWidth: 1.2, roughness: 1.2, strokeLineDash: [5, 7] }, bg);
      sketch(svg, "line", [cx, 24, cx, 376], { stroke: C.rule, strokeWidth: 1, roughness: 0.8, strokeLineDash: [3, 6] }, bg);
      sketch(svg, "line", [34, cy, 426, cy], { stroke: C.rule, strokeWidth: 1, roughness: 0.8, strokeLineDash: [3, 6] }, bg);
      sketch(svg, "circle", [cx, cy, 8], { stroke: C.ink, fill: C.ink, fillStyle: "solid", roughness: 0.4 }, bg);
      [["upper", cx, 16, "middle"], ["lower", cx, 396, "middle"], ["left", 6, cy - 6, "start"], ["right", 454, cy - 6, "end"]].forEach(([t, x, y, a]) =>
        el("text", { x, y, text: t, "text-anchor": a, "font-size": 15, fill: C.ink3, "font-family": "Caveat, cursive" }, bg));
    }

    const eg = el("g", {}, svg), ng = el("g", {}, svg);

    // edges
    spec.edges.forEach(([s, t, count, p]) => {
      const a = byId[s], b = byId[t];
      const strong = p >= 0.05;
      const col = strong ? C.ink : C.ink3;
      const sw = strong ? 1 + 3.2 * p : 1;
      const dash = strong ? undefined : [3, 4];
      if (s !== t && p < (spec.minP || 0)) return;
      if (s === t) {
        if (p < 0.1) return;
        // self loop: outward for outer/stand-alone nodes, inward for the inner ring
        let ux = a.x - cx, uy = a.y - cy;
        if (a.loopDir) [ux, uy] = a.loopDir;
        const L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L;
        if (a.ring === "inner") { ux = -ux; uy = -uy; }
        const r = R(a), lr = 11;
        const lx = a.x + ux * (r + lr - 3), ly = a.y + uy * (r + lr - 3);
        sketch(svg, "circle", [lx, ly, lr * 2], { stroke: col, strokeWidth: sw * 0.8, roughness: 0.8 }, eg);
        const hit = el("circle", { cx: lx, cy: ly, r: lr + 4, fill: "transparent" }, eg);
        bindTip(hit, `<b>s${s} → s${s}</b>stays put · p = ${p.toFixed(2)} (${count}×)`);
        return;
      }
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      let nx = -dy / len, ny = dx / len; // left normal
      let bend = 0.16;
      const midx = (a.x + b.x) / 2, midy = (a.y + b.y) / 2;
      const sameRing = a.ring && a.ring === b.ring;
      if (sameRing) {
        // push ring edges away from the centre; the weaker of a reciprocal pair goes inside
        const ox = midx - cx, oy = midy - cy;
        if (nx * ox + ny * oy < 0) { nx = -nx; ny = -ny; }
        const rev = spec.edges.find(([s2, t2]) => s2 === t && t2 === s);
        bend = 0.2;
        if (rev && rev[3] > p) { nx = -nx; ny = -ny; bend = 0.12; }
      } else if (!has.has(t + ">" + s)) {
        bend = 0.1;
      }
      const qx = midx + nx * bend * len, qy = midy + ny * bend * len;
      // trim to node radii
      const ra = R(a) + 3, rb = R(b) + 4;
      const sa = Math.atan2(qy - a.y, qx - a.x), sb = Math.atan2(qy - b.y, qx - b.x);
      const x1 = a.x + ra * Math.cos(sa), y1 = a.y + ra * Math.sin(sa);
      const x2 = b.x + rb * Math.cos(sb), y2 = b.y + rb * Math.sin(sb);
      const d = `M${x1},${y1} Q${qx},${qy} ${x2},${y2}`;
      sketch(svg, "path", [d], { stroke: col, strokeWidth: sw, roughness: 0.7, bowing: 0.5, strokeLineDash: dash }, eg);
      arrowhead(svg, x2, y2, Math.atan2(y2 - qy, x2 - qx), col, 7 + 2 * Math.min(p, 1), Math.max(1.3, sw * 0.8), eg);
      const hit = el("path", { d, fill: "none", stroke: "transparent", "stroke-width": 12 }, eg);
      bindTip(hit, `<b>s${s} → s${t}</b>p = ${p.toFixed(3)} (${count}×)`);
    });

    // nodes
    spec.nodes.forEach((n) => {
      const r = R(n), c = spec.color(n);
      const g = el("g", { class: "node", tabindex: 0, role: "button", "aria-label": `state s${n.id}` }, ng);
      sketch(svg, "circle", [n.x, n.y, r * 2], { stroke: c.stroke, strokeWidth: 2, fill: c.fill, fillStyle: "solid", roughness: 0.9 }, g);
      const lab = spec.label(n);
      if (lab.length === 2) {
        el("text", { x: n.x, y: n.y + 1, text: lab[0], "text-anchor": "middle", "font-size": r > 18 ? 15 : 12.5, fill: C.ink }, g);
        el("text", { x: n.x, y: n.y + (r > 18 ? 16 : 13), text: lab[1], "text-anchor": "middle", "font-size": r > 18 ? 14 : 11, fill: C.ink2 }, g);
      } else {
        el("text", { x: n.x, y: n.y + 5, text: lab[0], "text-anchor": "middle", "font-size": r > 18 ? 15 : 12, fill: C.ink }, g);
      }
      if (n.tag) {
        let tx = n.x, ty = n.y + r + 18, anchor = "middle";
        if (n.tagPos === "above" || ty > 392) ty = n.y - r - 8;
        if (n.tagPos === "right") { tx = n.x + r + 8; ty = n.y + 5; anchor = "start"; }
        el("text", { x: tx, y: ty, text: n.tag, "text-anchor": anchor, "font-size": 15, fill: n.bad ? C.warn : C.ink2, "font-family": "Caveat, cursive" }, g);
      }
      el("circle", { cx: n.x, cy: n.y, r: r + 4, fill: "transparent", class: "node-ring", stroke: "transparent" }, g);
      const activate = () => {
        $$(".node", svg).forEach((m) => m.classList.remove("on"));
        g.classList.add("on");
        if (out) out.innerHTML = spec.read(n);
      };
      g.addEventListener("pointerenter", activate);
      g.addEventListener("click", activate);
      g.addEventListener("focus", activate);
    });
    // default readout: the most visited state
    const top = spec.nodes.reduce((a, b) => (b.frames > a.frames ? b : a));
    if (out) out.innerHTML = spec.read(top);
  }

  /* =======================================================================
     5. Reveal on scroll
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
  chartSignals();
  chartDumbbell();
  chartTransitions();
  drawKripke(KRIPKE.gt);
  drawKripke(KRIPKE.vlm);
  reveal();

  let t;
  const relayout = () => { clearTimeout(t); t = setTimeout(layoutGoal, 120); };
  window.addEventListener("resize", relayout);
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(layoutGoal);
  window.addEventListener("load", layoutGoal);
})();
