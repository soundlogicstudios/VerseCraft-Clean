// core/debug_ui.js
// VerseCraft Debug Lite — Hitbox Editor + Source File Identification
// Enabled via ?debug=1 or ?=debug1
//
// Provides:
// - Cyan hitbox overlay toggle
// - Tap readout (x/y/w/h in %)
// - Editable hitboxes with move + resize handles
// - Identifies active screen + hitbox source JSON path from sec/screen_registry.json
// - Export/copy updated JSON for the active screen's hitboxes
//
// Safety:
// - Does NOT block taps unless Edit Mode is ON
// - When Edit Mode is ON, hitbox navigation is suppressed

import { get_current_screen } from "./screen-manager.js";

let mounted = false;

function debug_enabled() {
  const qs = location.search || "";
  return qs.includes("debug=1") || qs.includes("=debug1");
}

const q = (s, r = document) => r.querySelector(s);
const qa = (s, r = document) => Array.from(r.querySelectorAll(s));

function active_screen_el() {
  return q(".screen.is-active");
}

function active_layer() {
  const s = active_screen_el();
  return s?.querySelector(".hitbox-layer") || null;
}

function active_hitboxes() {
  const s = active_screen_el();
  return s ? qa(".hitbox", s) : [];
}

function current_screen_id() {
  return (
    (typeof get_current_screen === "function" && get_current_screen()) ||
    document.body?.dataset?.screen ||
    (location.hash || "").replace("#", "") ||
    "unknown"
  );
}

// ---------- Geometry helpers ----------

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function pct_str_to_num(s) {
  const n = parseFloat(String(s || "").replace("%", ""));
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function layer_rect() {
  const layer = active_layer();
  if (!layer) return null;
  return layer.getBoundingClientRect();
}

function px_to_pct_dx(dx_px, rect) {
  if (!rect || !rect.width) return 0;
  return (dx_px / rect.width) * 100;
}

function px_to_pct_dy(dy_px, rect) {
  if (!rect || !rect.height) return 0;
  return (dy_px / rect.height) * 100;
}

function read_hitbox_pct(hb) {
  return {
    x: pct_str_to_num(hb.style.left),
    y: pct_str_to_num(hb.style.top),
    w: pct_str_to_num(hb.style.width),
    h: pct_str_to_num(hb.style.height)
  };
}

function write_hitbox_pct(hb, box) {
  hb.style.left = `${round2(box.x)}%`;
  hb.style.top = `${round2(box.y)}%`;
  hb.style.width = `${round2(box.w)}%`;
  hb.style.height = `${round2(box.h)}%`;
}

// ---------- Registry lookup (source JSON file) ----------

let _registry_cache = null;

async function load_registry() {
  if (_registry_cache) return _registry_cache;
  try {
    _registry_cache = await (await fetch("./sec/screen_registry.json", { cache: "no-store" })).json();
    return _registry_cache;
  } catch (e) {
    console.warn("[debug_ui] failed to load registry", e);
    return null;
  }
}

async function get_hitbox_source_for_screen(screen_id) {
  const reg = await load_registry();
  const hit = reg?.screens?.[screen_id]?.hitboxes || null;
  return hit;
}

// ---------- Debug UI + Editor State ----------

let edit_mode = false;
let selected_hitbox = null;

let panel_el = null;
let pill_el = null;

let lbl_screen_el = null;
let lbl_source_el = null;
let lbl_selected_el = null;

let select_el = null;
let readout_el = null;
let export_el = null;

let overlay_layer_el = null;
let overlay_box_el = null;

let drag = null; // { kind, startClientX, startClientY, startBox, handle }

function inject_styles() {
  if (q("#vc_debug_lite_styles")) return;

  const style = document.createElement("style");
  style.id = "vc_debug_lite_styles";
  style.textContent = `
    #vcDebugPill{
      position:fixed; right:12px; bottom:12px; z-index:9999999;
      padding:10px 14px; border-radius:999px;
      background:rgba(0,0,0,.82); color:#fff;
      font:800 14px system-ui; border:1px solid rgba(255,255,255,.28);
    }
    #vcDebugPanel{
      position:fixed; left:10px; right:10px; bottom:60px;
      max-height:70vh; overflow:auto;
      background:rgba(0,0,0,.92); color:#fff;
      border-radius:14px; padding:12px;
      border:1px solid rgba(255,255,255,.2);
      display:none; z-index:9999999;
    }
    #vcDebugPanel button, #vcDebugPanel select{
      padding:10px; border-radius:10px;
      border:1px solid rgba(255,255,255,.2);
      background:rgba(255,255,255,.10);
      color:#fff; font:800 13px system-ui;
      margin:4px 4px 0 0;
    }
    #vcDebugPanel select{
      width:100%;
      margin-top:10px;
      font-weight:700;
    }
    #vcDebugPanel .kv{
      margin-top:10px;
      padding:10px;
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.12);
      border-radius:12px;
      font:700 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      white-space:pre-wrap;
      word-break:break-word;
    }
    #vcDebugPanel pre{
      white-space:pre-wrap;
      word-break:break-word;
      margin:10px 0 0;
      padding:10px;
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.12);
      border-radius:12px;
      font:600 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }

    /* Cyan overlay */
    .debug-hitboxes .hitbox{
      outline:2px dashed rgba(0,255,255,.85);
      background:rgba(0,255,255,.08);
    }

    /* Editor overlay layer */
    .vc-editor-overlay{
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      z-index:9999998; /* below panel/pill but above hitboxes */
      pointer-events:none;
    }
    .vc-editor-box{
      position:absolute;
      border:2px solid rgba(0,255,255,.95);
      background:rgba(0,255,255,.06);
      border-radius:10px;
      pointer-events:none;
      box-shadow:0 2px 10px rgba(0,0,0,.55);
    }
    .vc-grip{
      position:absolute;
      inset:0;
      pointer-events:auto;
      touch-action:none;
    }
    .vc-handle{
      position:absolute;
      width:18px; height:18px;
      border-radius:999px;
      background:rgba(255,255,255,.92);
      border:2px solid rgba(0,0,0,.55);
      pointer-events:auto;
      touch-action:none;
    }
    .vc-handle[data-h="n"]{ left:50%; top:-9px; transform:translateX(-50%); }
    .vc-handle[data-h="s"]{ left:50%; bottom:-9px; transform:translateX(-50%); }
    .vc-handle[data-h="w"]{ left:-9px; top:50%; transform:translateY(-50%); }
    .vc-handle[data-h="e"]{ right:-9px; top:50%; transform:translateY(-50%); }
    .vc-handle[data-h="nw"]{ left:-9px; top:-9px; }
    .vc-handle[data-h="ne"]{ right:-9px; top:-9px; }
    .vc-handle[data-h="sw"]{ left:-9px; bottom:-9px; }
    .vc-handle[data-h="se"]{ right:-9px; bottom:-9px; }
  `;
  document.head.appendChild(style);
}

function ensure_overlay() {
  const screen = active_screen_el();
  if (!screen) return null;

  if (!overlay_layer_el || !screen.contains(overlay_layer_el)) {
    overlay_layer_el = document.createElement("div");
    overlay_layer_el.className = "vc-editor-overlay";
    screen.appendChild(overlay_layer_el);
  }

  return overlay_layer_el;
}

function clear_overlay() {
  if (overlay_layer_el) overlay_layer_el.remove();
  overlay_layer_el = null;
  overlay_box_el = null;
}

function hitbox_id(hb) {
  return hb?.dataset?.hitboxId || hb?.getAttribute?.("aria-label") || "";
}

function set_selected_hitbox(hb) {
  selected_hitbox = hb || null;
  render_overlay();
  refresh_ui();
}

function render_overlay() {
  clear_overlay();

  if (!edit_mode) return;
  if (!selected_hitbox) return;

  const overlay = ensure_overlay();
  if (!overlay) return;

  const box = read_hitbox_pct(selected_hitbox);

  overlay_box_el = document.createElement("div");
  overlay_box_el.className = "vc-editor-box";
  overlay_box_el.style.left = `${box.x}%`;
  overlay_box_el.style.top = `${box.y}%`;
  overlay_box_el.style.width = `${box.w}%`;
  overlay_box_el.style.height = `${box.h}%`;

  // Grip for moving the whole box
  const grip = document.createElement("div");
  grip.className = "vc-grip";
  grip.addEventListener("pointerdown", (e) => begin_drag(e, "move", null), true);

  overlay_box_el.appendChild(grip);

  // Resize handles
  const handles = ["n","s","w","e","nw","ne","sw","se"];
  handles.forEach((h) => {
    const hd = document.createElement("div");
    hd.className = "vc-handle";
    hd.dataset.h = h;
    hd.addEventListener("pointerdown", (e) => begin_drag(e, "resize", h), true);
    overlay_box_el.appendChild(hd);
  });

  overlay.appendChild(overlay_box_el);
}

function begin_drag(e, kind, handle) {
  if (!edit_mode || !selected_hitbox) return;

  e.preventDefault();
  e.stopPropagation();

  const rect = layer_rect();
  if (!rect) return;

  const startBox = read_hitbox_pct(selected_hitbox);

  drag = {
    kind,
    handle,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startBox,
    rect
  };

  try { e.target.setPointerCapture(e.pointerId); } catch (_) {}

  window.addEventListener("pointermove", on_drag_move, true);
  window.addEventListener("pointerup", end_drag, true);
}

function on_drag_move(e) {
  if (!drag || !selected_hitbox) return;

  e.preventDefault();
  e.stopPropagation();

  const dx_pct = px_to_pct_dx(e.clientX - drag.startClientX, drag.rect);
  const dy_pct = px_to_pct_dy(e.clientY - drag.startClientY, drag.rect);

  let { x, y, w, h } = drag.startBox;

  if (drag.kind === "move") {
    x = x + dx_pct;
    y = y + dy_pct;
  } else if (drag.kind === "resize") {
    const hh = drag.handle;

    // edges
    if (hh.includes("e")) w = w + dx_pct;
    if (hh.includes("s")) h = h + dy_pct;
    if (hh.includes("w")) { x = x + dx_pct; w = w - dx_pct; }
    if (hh.includes("n")) { y = y + dy_pct; h = h - dy_pct; }
  }

  // constraints
  w = clamp(w, 1, 100);
  h = clamp(h, 1, 100);
  x = clamp(x, 0, 100 - w);
  y = clamp(y, 0, 100 - h);

  write_hitbox_pct(selected_hitbox, { x, y, w, h });

  // mirror overlay
  if (overlay_box_el) {
    overlay_box_el.style.left = `${round2(x)}%`;
    overlay_box_el.style.top = `${round2(y)}%`;
    overlay_box_el.style.width = `${round2(w)}%`;
    overlay_box_el.style.height = `${round2(h)}%`;
  }

  refresh_ui(false);
}

function end_drag(e) {
  if (!drag) return;

  e.preventDefault();
  e.stopPropagation();

  drag = null;

  window.removeEventListener("pointermove", on_drag_move, true);
  window.removeEventListener("pointerup", end_drag, true);

  refresh_ui(true);
}

// ---------- Export ----------

function export_active_hitboxes_json() {
  const hbs = active_hitboxes();

  const out = hbs.map((hb) => {
    const id = hitbox_id(hb);
    const { x, y, w, h } = read_hitbox_pct(hb);
    const action = (hb.dataset.action || "").trim();
    const arg = (hb.dataset.arg || "").trim();

    return {
      id,
      x: round2(x),
      y: round2(y),
      w: round2(w),
      h: round2(h),
      action,
      arg
    };
  });

  return JSON.stringify({ hitboxes: out }, null, 2);
}

async function copy_text(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    try {
      window.prompt("Copy this JSON:", text);
      return false;
    } catch (_) {
      return false;
    }
  }
}

// ---------- UI refresh ----------

async function refresh_ui(update_export = true) {
  if (!panel_el) return;

  const screen = current_screen_id();
  const source = await get_hitbox_source_for_screen(screen);

  if (lbl_screen_el) lbl_screen_el.textContent = `screen: ${screen}`;
  if (lbl_source_el) lbl_source_el.textContent = `source (registry): ${source || "(unknown / registry load failed)"}`;

  const sid = selected_hitbox ? hitbox_id(selected_hitbox) : "(none)";
  if (lbl_selected_el) lbl_selected_el.textContent = `selected: ${sid}`;

  // Populate selector with active hitboxes
  if (select_el) {
    const hbs = active_hitboxes();
    const current = sid;

    // rebuild options
    select_el.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "-- Select Hitbox --";
    select_el.appendChild(opt0);

    hbs.forEach((hb) => {
      const id = hitbox_id(hb);
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id || "(unnamed)";
      if (id === current) opt.selected = true;
      select_el.appendChild(opt);
    });
  }

  // Readout: selected box + tap note
  if (readout_el) {
    const hb = selected_hitbox;
    if (!hb) {
      readout_el.textContent = "x/y/w/h: (select a hitbox)";
    } else {
      const b = read_hitbox_pct(hb);
      readout_el.textContent =
        `x:${round2(b.x)}%  y:${round2(b.y)}%  w:${round2(b.w)}%  h:${round2(b.h)}%`;
    }
  }

  if (update_export && export_el) {
    export_el.textContent = export_active_hitboxes_json();
  }
}

// ---------- Event handling (edit mode tap suppression + selection) ----------

function on_pointerup_capture(e) {
  if (!edit_mode) return;

  // In edit mode, suppress navigation taps on hitboxes
  const hb = e.target?.closest?.(".hitbox");
  if (hb) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function on_pointerdown_capture(e) {
  if (!edit_mode) return;

  // Allow selecting a hitbox by tapping it
  const hb = e.target?.closest?.(".hitbox");
  if (!hb) return;

  e.preventDefault();
  e.stopPropagation();

  set_selected_hitbox(hb);
}

// ---------- Mount ----------

export function init_debug_ui() {
  if (!debug_enabled() || mounted) return;
  mounted = true;

  inject_styles();

  // Capture handlers to suppress taps ONLY when edit mode is on
  document.addEventListener("pointerdown", on_pointerdown_capture, true);
  document.addEventListener("pointerup", on_pointerup_capture, true);

  pill_el = document.createElement("button");
  pill_el.id = "vcDebugPill";
  pill_el.textContent = "Debug";

  panel_el = document.createElement("div");
  panel_el.id = "vcDebugPanel";
  panel_el.innerHTML = `
    <button id="dbgClose">Close</button>
    <button id="dbgCyan">Toggle Cyan</button>
    <button id="dbgEditOn">Edit ON</button>
    <button id="dbgEditOff">Edit OFF</button>
    <button id="dbgExportRefresh">Refresh Export</button>
    <button id="dbgExportCopy">Copy Export</button>

    <div class="kv" id="dbgInfo"></div>

    <select id="dbgSelect"></select>

    <pre id="dbgReadout"></pre>
    <pre id="dbgExport"></pre>
  `;

  document.body.appendChild(panel_el);
  document.body.appendChild(pill_el);

  const infoEl = q("#dbgInfo", panel_el);
  select_el = q("#dbgSelect", panel_el);
  readout_el = q("#dbgReadout", panel_el);
  export_el = q("#dbgExport", panel_el);

  // info lines
  lbl_screen_el = document.createElement("div");
  lbl_source_el = document.createElement("div");
  lbl_selected_el = document.createElement("div");
  infoEl.appendChild(lbl_screen_el);
  infoEl.appendChild(lbl_source_el);
  infoEl.appendChild(lbl_selected_el);

  pill_el.onclick = () => {
    panel_el.style.display = panel_el.style.display === "block" ? "none" : "block";
    refresh_ui(true);
  };

  q("#dbgClose", panel_el).onclick = () => (panel_el.style.display = "none");
  q("#dbgCyan", panel_el).onclick = () => active_layer()?.classList.toggle("debug-hitboxes");

  q("#dbgEditOn", panel_el).onclick = () => {
    edit_mode = true;
    // auto-select first hitbox if none selected
    if (!selected_hitbox) {
      const first = active_hitboxes()[0] || null;
      if (first) selected_hitbox = first;
    }
    render_overlay();
    refresh_ui(true);
  };

  q("#dbgEditOff", panel_el).onclick = () => {
    edit_mode = false;
    clear_overlay();
    refresh_ui(true);
  };

  q("#dbgExportRefresh", panel_el).onclick = () => refresh_ui(true);

  q("#dbgExportCopy", panel_el).onclick = async () => {
    const txt = export_el?.textContent || "";
    await copy_text(txt);
  };

  select_el.onchange = () => {
    const id = select_el.value;
    const hb = active_hitboxes().find((x) => hitbox_id(x) === id) || null;
    set_selected_hitbox(hb);
  };

  // On every screen change: clear selection + overlay, refresh everything
  window.addEventListener("vc:screenchange", () => {
    selected_hitbox = null;
    clear_overlay();
    refresh_ui(true);
  });

  // Initial fill
  Promise.resolve().then(() => refresh_ui(true));

  console.log("[debug_ui] Debug Lite mounted");
}
