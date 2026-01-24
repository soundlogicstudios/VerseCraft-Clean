// core/debug_ui.js
// versecraft phase 1: on-screen diagnostic suite (no console needed)
// gated behind ?debug=1 or ?=debug1
//
// IMPORTANT: this version scopes hitbox diagnostics to the ACTIVE screen
// and also reports TOTAL hitboxes across the DOM to detect leaks.

import { go, get_current_screen } from "./screen-manager.js";

let mounted = false;
let tap_test_enabled = false;

function debug_enabled() {
  const qs = location.search || "";
  return qs.includes("debug=1") || qs.includes("=debug1");
}

function q(sel, root = document) {
  return root.querySelector(sel);
}

function qa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function active_screen_el() {
  return q(".screen.is-active");
}

function active_layer() {
  const s = active_screen_el();
  return s?.querySelector(".hitbox-layer") || null;
}

function all_hitboxes() {
  return qa(".hitbox");
}

function active_hitboxes() {
  const s = active_screen_el();
  if (!s) return [];
  return qa(".hitbox", s);
}

function safe_rect(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: Math.round(r.x),
    y: Math.round(r.y),
    w: Math.round(r.width),
    h: Math.round(r.height)
  };
}

function inline_box_style(el) {
  if (!el) return null;
  return {
    left: el.style.left || "",
    top: el.style.top || "",
    width: el.style.width || "",
    height: el.style.height || ""
  };
}

function computed_box_style(el) {
  if (!el) return null;
  const cs = getComputedStyle(el);
  return {
    left: cs.left,
    top: cs.top,
    width: cs.width,
    height: cs.height,
    display: cs.display,
    position: cs.position,
    pointerEvents: cs.pointerEvents,
    zIndex: cs.zIndex
  };
}

function current_screen_id() {
  return (
    (typeof get_current_screen === "function" && get_current_screen()) ||
    document.body?.dataset?.screen ||
    (location.hash || "").replace("#", "") ||
    "unknown"
  );
}

function snapshot() {
  const layer = active_layer();
  const hbs_active = active_hitboxes();
  const hbs_total = all_hitboxes();

  const layer_cs = layer ? getComputedStyle(layer) : null;
  const first = hbs_active[0] || null;

  return {
    screen: current_screen_id(),
    hash: location.hash || "",
    query: location.search || "",
    screen_el_found: !!q(`.screen[data-screen="${current_screen_id()}"]`),
    layer_found: !!layer,
    layer_pointer_events: layer_cs ? layer_cs.pointerEvents : null,
    layer_z_index: layer_cs ? layer_cs.zIndex : null,
    layer_rect: layer ? safe_rect(layer) : null,

    hitbox_count_active: hbs_active.length,
    hitbox_count_total: hbs_total.length,

    first_hitbox_active: first
      ? {
          dataset: { ...first.dataset },
          rect: safe_rect(first),
          inline: inline_box_style(first),
          computed: computed_box_style(first)
        }
      : null
  };
}

function list_active_hitboxes() {
  return active_hitboxes().map((hb, i) => ({
    i,
    id: hb.getAttribute("data-hitbox-id") || hb.getAttribute("aria-label") || "",
    action: hb.dataset.action || "",
    arg: hb.dataset.arg ?? "",
    rect: safe_rect(hb),
    inline: inline_box_style(hb),
    computed: computed_box_style(hb)
  }));
}

function inject_styles() {
  if (q("#vc_debug_ui_styles")) return;

  const css = `
  #vcDebugPill{
    position:fixed; z-index:9999999;
    right:12px; bottom:12px;
    padding:10px 12px;
    border-radius:999px;
    border:1px solid rgba(255,255,255,.25);
    background:rgba(0,0,0,.72);
    color:#fff;
    font:700 14px/1 system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
    letter-spacing:.2px;
    backdrop-filter: blur(6px);
  }
  #vcDebugPill:active{ transform: scale(.98); }

  #vcDebugPanel{
    position:fixed; z-index:9999999;
    left:10px; right:10px; bottom:60px;
    max-height:70vh; overflow:auto;
    border-radius:14px;
    border:1px solid rgba(255,255,255,.18);
    background:rgba(0,0,0,.90);
    color:#fff;
    padding:12px;
    font:14px/1.35 system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
    backdrop-filter: blur(8px);
    display:none;
  }

  #vcDebugPanel .bar{
    display:flex; align-items:center; justify-content:space-between; gap:10px;
    margin-bottom:8px;
  }

  #vcDebugPanel .title{ font-weight:900; letter-spacing:.2px; }

  #vcDebugPanel .row{ display:flex; gap:8px; flex-wrap:wrap; margin:10px 0; }

  #vcDebugPanel button{
    padding:10px 10px;
    border-radius:10px;
    border:1px solid rgba(255,255,255,.18);
    background:rgba(255,255,255,.08);
    color:#fff;
    font:800 13px/1 system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
  }
  #vcDebugPanel button:active{ transform: scale(.99); }

  #vcDebugPanel .note{ opacity:.9; font-size:12px; margin:6px 0 2px; }

  #vcDebugPanel pre{
    margin:10px 0 0 0;
    padding:10px;
    border-radius:10px;
    background:rgba(255,255,255,.06);
    border:1px solid rgba(255,255,255,.12);
    white-space:pre-wrap;
    word-break:break-word;
  }
  `;

  const style = document.createElement("style");
  style.id = "vc_debug_ui_styles";
  style.textContent = css;
  document.head.appendChild(style);
}

function set_outlines(on) {
  const layer = active_layer();
  if (!layer) return { ok: false, reason: "no .hitbox-layer on active screen" };
  layer.classList.toggle("debug-hitboxes", !!on);
  return { ok: true, on: !!on };
}

function clear_paint() {
  active_hitboxes().forEach((hb) => {
    hb.style.background = "";
    hb.style.outline = "";
    hb.style.zIndex = "";
  });
  return { ok: true };
}

function paint_hitbox(index = 0) {
  const hb = active_hitboxes()[index];
  if (!hb) return { ok: false, reason: "no active hitbox at index" };

  hb.style.background = "rgba(255,0,0,0.28)";
  hb.style.outline = "3px solid rgba(255,0,0,0.95)";
  hb.style.zIndex = "9999998";

  return { ok: true, index, rect: safe_rect(hb), inline: inline_box_style(hb) };
}

function paint_all() {
  const hbs = active_hitboxes();
  if (!hbs.length) return { ok: false, reason: "no active hitboxes to paint" };

  hbs.forEach((hb) => {
    hb.style.background = "rgba(255,0,0,0.18)";
    hb.style.outline = "2px solid rgba(255,0,0,0.85)";
    hb.style.zIndex = "9999998";
  });

  return { ok: true, count: hbs.length };
}

function render_outputs(panel) {
  const snapEl = q("#vcDbgSnapOut", panel);
  const listEl = q("#vcDbgListOut", panel);

  const snap = snapshot();
  const list = list_active_hitboxes();

  if (snapEl) snapEl.textContent = JSON.stringify(snap, null, 2);
  if (listEl) listEl.textContent = JSON.stringify(list, null, 2);
}

function set_panel_open(panel, open) {
  panel.style.display = open ? "block" : "none";
}

function is_panel_open(panel) {
  return panel.style.display === "block";
}

function enable_tap_test(on) {
  tap_test_enabled = !!on;
  const pill = q("#vcDebugPill");
  if (pill) pill.textContent = tap_test_enabled ? "Debug (Tap Test)" : "Debug";
  return { ok: true, tap_test: tap_test_enabled };
}

function handle_tap_test(e) {
  if (!tap_test_enabled) return;

  const hb = e.target?.closest?.(".hitbox");
  if (!hb) return;

  // Only respond if the hitbox is on the active screen
  const s = active_screen_el();
  if (!s || !s.contains(hb)) return;

  e.stopPropagation();
  e.preventDefault();

  const id = hb.getAttribute("data-hitbox-id") || hb.getAttribute("aria-label") || "";
  const action = hb.dataset.action || "";
  const arg = hb.dataset.arg ?? "";
  const rect = safe_rect(hb);
  const inline = inline_box_style(hb);

  alert(
    `HITBOX TAP (ACTIVE)\nid: ${id}\naction: ${action}\narg: ${arg}\nrect: ${rect?.w}x${rect?.h}\nstyle: ${inline?.left},${inline?.top},${inline?.width},${inline?.height}`
  );
}

export function init_debug_ui() {
  if (!debug_enabled()) return;
  if (mounted) return;
  mounted = true;

  inject_styles();
  document.addEventListener("pointerup", handle_tap_test, true);

  const pill = document.createElement("button");
  pill.id = "vcDebugPill";
  pill.type = "button";
  pill.textContent = "Debug";

  const panel = document.createElement("div");
  panel.id = "vcDebugPanel";
  panel.innerHTML = `
    <div class="bar">
      <div class="title">VerseCraft Debug</div>
      <button id="vcDbgClose" type="button">Close</button>
    </div>

    <div class="row">
      <button id="vcDbgOutlinesOn" type="button">Cyan On</button>
      <button id="vcDbgOutlinesOff" type="button">Cyan Off</button>
      <button id="vcDbgPaintFirst" type="button">Paint First Red</button>
      <button id="vcDbgPaintAll" type="button">Paint All Red</button>
      <button id="vcDbgClearPaint" type="button">Clear Paint</button>
    </div>

    <div class="row">
      <button id="vcDbgTapTestOn" type="button">Tap Test On</button>
      <button id="vcDbgTapTestOff" type="button">Tap Test Off</button>
    </div>

    <div class="row">
      <button id="vcDbgGoSplash" type="button">Go Splash</button>
      <button id="vcDbgGoTos" type="button">Go ToS</button>
    </div>

    <div class="note">Snapshot (ACTIVE vs TOTAL)</div>
    <pre id="vcDbgSnapOut"></pre>

    <div class="note">Active Screen Hitboxes</div>
    <pre id="vcDbgListOut"></pre>
  `;

  document.body.appendChild(panel);
  document.body.appendChild(pill);

  function refresh() {
    render_outputs(panel);
  }

  pill.addEventListener("click", () => {
    const open = !is_panel_open(panel);
    set_panel_open(panel, open);
    if (open) refresh();
  });

  q("#vcDbgClose", panel)?.addEventListener("click", () => set_panel_open(panel, false));

  q("#vcDbgOutlinesOn", panel)?.addEventListener("click", () => {
    set_outlines(true);
    refresh();
  });

  q("#vcDbgOutlinesOff", panel)?.addEventListener("click", () => {
    set_outlines(false);
    refresh();
  });

  q("#vcDbgPaintFirst", panel)?.addEventListener("click", () => {
    paint_hitbox(0);
    refresh();
  });

  q("#vcDbgPaintAll", panel)?.addEventListener("click", () => {
    paint_all();
    refresh();
  });

  q("#vcDbgClearPaint", panel)?.addEventListener("click", () => {
    clear_paint();
    refresh();
  });

  q("#vcDbgTapTestOn", panel)?.addEventListener("click", () => {
    enable_tap_test(true);
    refresh();
  });

  q("#vcDbgTapTestOff", panel)?.addEventListener("click", () => {
    enable_tap_test(false);
    refresh();
  });

  q("#vcDbgGoSplash", panel)?.addEventListener("click", async () => {
    await go("splash");
    refresh();
  });

  q("#vcDbgGoTos", panel)?.addEventListener("click", async () => {
    await go("tos");
    refresh();
  });

  window.addEventListener("vc:screenchange", () => {
    if (is_panel_open(panel)) refresh();
  });

  console.log("[debug_ui] enabled (query gated, active-scoped)");
}
