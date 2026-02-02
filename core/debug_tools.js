// core/debug_tools.js
// VerseCraft — Unified Debug HUD (CANON)
// HARD GATE: does NOTHING unless ?debug=1 (or debug=true/yes) is present.
//
// Goal:
// - One debug system (no overlapping panels)
// - Gear icon bottom-right opens the HUD
// - Tools included:
//   1) Toggle Cyan hitboxes
//   2) Audit active screen (registry + css/hitboxes fetch status + background image)
//   3) XY box tool: drag to measure a rectangle; outputs px + % relative to active screen
//
// Safety:
// - Must not break gameplay when closed.
// - HUD root uses pointer-events:none.
// - Only the gear button + HUD panel use pointer-events:auto

let _inited = false;
let _enabled = false;

const REGISTRY_URL = "./sec/screen_registry.json";
const MAX_EVENTS = 24;

// ---------- gate ----------

function has_debug_flag() {
  try {
    const p = new URLSearchParams(location.search);
    const v = (p.get("debug") || "").toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  } catch (_) {
    return false;
  }
}

// ---------- state ----------

const STATE = {
  enabled: false,
  screen: null,
  css_last: null,
  last_event: null,
  events: [],
  audit: null,
  measure: null
};

function now_ms() {
  try { return Math.round(performance.now()); } catch { return Date.now(); }
}

function push_event(line) {
  const stamp = `${now_ms()}ms`;
  STATE.events.push(`${stamp} ${line}`);
  if (STATE.events.length > MAX_EVENTS) STATE.events.shift();
  STATE.last_event = String(line || "").slice(0, 96);
  render();
}

// ---------- helpers ----------

const q = (s, r = document) => r.querySelector(s);

function current_screen_id() {
  return (
    document.body?.dataset?.screen ||
    document.documentElement?.getAttribute?.("data-screen") ||
    (location.hash || "").replace("#", "") ||
    "unknown"
  );
}

function active_screen_el() {
  return q(".screen.is-active");
}

function active_hitbox_layer() {
  const s = active_screen_el();
  return s?.querySelector(".hitbox-layer") || null;
}

function safe_rect(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
}

function safe_json(v) {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

async function fetch_status(path) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    return { path, ok: res.ok, status: res.status };
  } catch (e) {
    return { path, ok: false, status: "fetch_error", error: String(e?.message || e) };
  }
}

async function audit_active_screen() {
  let reg = null;
  try {
    reg = await (await fetch(REGISTRY_URL, { cache: "no-store" })).json();
  } catch (e) {
    return { ok: false, reason: "registry_load_failed", error: String(e?.message || e) };
  }

  const sid = current_screen_id();
  const cfg = reg?.screens?.[sid];
  if (!cfg) return { ok: false, reason: "screen_not_in_registry", screen_id: sid };

  const el = q(`.screen[data-screen="${sid}"]`);
  const css = cfg.css ? `./${String(cfg.css).replace(/^\.?\//, "")}` : null;
  const hit = cfg.hitboxes ? `./${String(cfg.hitboxes).replace(/^\.?\//, "")}` : null;

  return {
    ok: true,
    screen_id: sid,
    element_exists: !!el,
    css_fetch: css ? await fetch_status(css) : null,
    hitboxes_fetch: hit ? await fetch_status(hit) : null,
    background_image: el ? getComputedStyle(el).backgroundImage : null
  };
}

// ---------- UI ----------

let gear_btn = null;
let panel = null;

let panel_open = false;
let cyan_on = false;

// XY tool
let measure_enabled = false;
let measure_dragging = false;
let measure_start = null; // {x,y}
let measure_box = null;   // div overlay

function inject_styles() {
  if (q("#vc_unified_debug_styles")) return;

  const style = document.createElement("style");
  style.id = "vc_unified_debug_styles";
  style.textContent = `
    #vcDebugGear{
      position:fixed;
      right:12px;
      bottom:12px;
      width:46px;
      height:46px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,0.25);
      background:rgba(0,0,0,0.78);
      color:#fff;
      font-weight:900;
      font-size:22px;
      line-height:46px;
      text-align:center;
      box-shadow:0 10px 24px rgba(0,0,0,0.35);
      pointer-events:auto;
      z-index:9999999;
    }
    #vcDebugPanel{
      position:fixed;
      left:10px;
      right:10px;
      bottom:70px;
      max-height:72vh;
      overflow:auto;
      border-radius:14px;
      border:1px solid rgba(255,255,255,0.18);
      background:rgba(0,0,0,0.90);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      color:#fff;
      padding:12px;
      pointer-events:auto;
      display:none;
      z-index:9999999;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    }
    #vcDebugPanel .vcRow{
      margin-top:10px;
      padding-top:10px;
      border-top:1px solid rgba(255,255,255,0.12);
    }
    #vcDebugPanel .vcBtns{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      align-items:center;
    }
    #vcDebugPanel button.vcBtn{
      padding:10px 12px;
      border-radius:12px;
      border:1px solid rgba(255,255,255,0.18);
      background:rgba(255,255,255,0.10);
      color:#fff;
      font-weight:900;
      font-size:13px;
    }
    #vcDebugPanel pre{
      margin:10px 0 0 0;
      padding:10px;
      border-radius:12px;
      background:rgba(255,255,255,0.06);
      border:1px solid rgba(255,255,255,0.12);
      overflow:auto;
      font:700 12px ui-monospace, SFMono-Regular, Menlo, monospace;
      white-space:pre-wrap;
      word-break:break-word;
    }
    #vcDebugMeasureBox{
      position:fixed;
      border:3px solid rgba(0,255,255,0.95);
      background:rgba(0,255,255,0.12);
      box-shadow:0 0 0 3px rgba(0,0,0,0.30);
      border-radius:10px;
      pointer-events:none;
      z-index:9999998;
      display:none;
    }
    .debug-hitboxes .hitbox{
      outline:2px dashed rgba(0,255,255,.9);
      background:rgba(0,255,255,.08);
    }
  `;
  document.head.appendChild(style);
}

function ensure_ui() {
  if (gear_btn && panel) return;

  inject_styles();

  gear_btn = document.createElement("button");
  gear_btn.id = "vcDebugGear";
  gear_btn.type = "button";
  gear_btn.textContent = "⚙︎";
  gear_btn.setAttribute("aria-label", "Debug");

  panel = document.createElement("div");
  panel.id = "vcDebugPanel";
  panel.innerHTML = `
    <div class="vcBtns">
      <button class="vcBtn" id="vcDbgClose" type="button">Close</button>
      <button class="vcBtn" id="vcDbgCyan" type="button">Toggle Cyan</button>
      <button class="vcBtn" id="vcDbgAudit" type="button">Audit Screen</button>
      <button class="vcBtn" id="vcDbgMeasure" type="button">XY Tool: Off</button>
      <button class="vcBtn" id="vcDbgCopy" type="button">Copy</button>
    </div>
    <div class="vcRow"></div>
    <pre id="vcDbgStatus"></pre>
    <pre id="vcDbgOut"></pre>
  `;

  document.body.appendChild(gear_btn);
  document.body.appendChild(panel);

  gear_btn.addEventListener("click", () => {
    panel_open = !panel_open;
    panel.style.display = panel_open ? "block" : "none";
    push_event(panel_open ? "panel opened" : "panel closed");
    refresh_status();
    refresh_output();
  }, true);

  q("#vcDbgClose", panel)?.addEventListener("click", () => {
    panel_open = false;
    panel.style.display = "none";
    push_event("panel closed");
  }, true);

  q("#vcDbgCyan", panel)?.addEventListener("click", () => {
    const layer = active_hitbox_layer();
    if (!layer) {
      push_event("cyan: no active hitbox-layer");
      return;
    }
    cyan_on = !cyan_on;
    layer.classList.toggle("debug-hitboxes", cyan_on);
    push_event(cyan_on ? "cyan ON" : "cyan OFF");
    refresh_status();
  }, true);

  q("#vcDbgAudit", panel)?.addEventListener("click", async () => {
    push_event("audit running...");
    const res = await audit_active_screen();
    STATE.audit = res;
    push_event(res?.ok ? "audit ok" : `audit failed: ${res?.reason || "unknown"}`);
    refresh_output();
  }, true);

  q("#vcDbgMeasure", panel)?.addEventListener("click", () => {
    measure_enabled = !measure_enabled;
    const b = q("#vcDbgMeasure", panel);
    if (b) b.textContent = measure_enabled ? "XY Tool: On" : "XY Tool: Off";
    push_event(measure_enabled ? "measure ON (drag on game)" : "measure OFF");
    if (!measure_enabled) hide_measure_box();
    refresh_status();
  }, true);

  q("#vcDbgCopy", panel)?.addEventListener("click", async () => {
    const payload = {
      time: new Date().toISOString(),
      screen: current_screen_id(),
      audit: STATE.audit,
      measure: STATE.measure,
      last_event: STATE.last_event,
      events: STATE.events
    };
    const text = safe_json(payload);
    const ok = await copy_text(text);
    push_event(ok ? "copied to clipboard" : "copy failed");
  }, true);

  // Global measure listener (capture). Only active when measure_enabled.
  document.addEventListener("pointerdown", on_measure_down, true);
  document.addEventListener("pointermove", on_measure_move, true);
  document.addEventListener("pointerup", on_measure_up, true);

  window.addEventListener("vc:screenchange", (e) => {
    const sid = e?.detail?.screen || current_screen_id();
    STATE.screen = sid;
    push_event(`screenchange -> ${sid}`);
    refresh_status();
    refresh_output();
  });

  STATE.screen = current_screen_id();
  push_event("unified debug hud mounted");
  refresh_status();
  refresh_output();
}

function refresh_status() {
  if (!panel) return;
  const st = q("#vcDbgStatus", panel);
  if (!st) return;

  const sid = current_screen_id();
  const layer = active_hitbox_layer();
  const lr = safe_rect(layer);

  st.textContent = safe_json({
    screen: sid,
    hash: location.hash || "",
    query: location.search || "",
    hitbox_layer_found: !!layer,
    hitbox_layer_rect: lr,
    cyan: cyan_on,
    measure: measure_enabled ? "on" : "off",
    last_event: STATE.last_event || "-"
  });
}

function refresh_output() {
  if (!panel) return;
  const out = q("#vcDbgOut", panel);
  if (!out) return;

  out.textContent = safe_json({
    audit: STATE.audit,
    measure: STATE.measure,
    events: STATE.events.slice(-12)
  });
}

async function copy_text(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return !!ok;
  } catch (_) {
    return false;
  }
}

// ---------- XY measure tool ----------

function ensure_measure_box() {
  if (measure_box) return measure_box;
  measure_box = document.createElement("div");
  measure_box.id = "vcDebugMeasureBox";
  document.body.appendChild(measure_box);
  return measure_box;
}

function show_measure_box(x, y, w, h) {
  const box = ensure_measure_box();
  box.style.display = "block";
  box.style.left = `${Math.round(x)}px`;
  box.style.top = `${Math.round(y)}px`;
  box.style.width = `${Math.max(0, Math.round(w))}px`;
  box.style.height = `${Math.max(0, Math.round(h))}px`;
}

function hide_measure_box() {
  if (!measure_box) return;
  measure_box.style.display = "none";
}

function on_measure_down(e) {
  if (!_enabled || !measure_enabled) return;
  const t = e.target;
  if (t && (t.closest?.("#vcDebugPanel") || t.closest?.("#vcDebugGear"))) return;

  measure_dragging = true;
  measure_start = { x: e.clientX, y: e.clientY };
  show_measure_box(e.clientX, e.clientY, 1, 1);
}

function on_measure_move(e) {
  if (!_enabled || !measure_enabled) return;
  if (!measure_dragging || !measure_start) return;

  const x0 = measure_start.x;
  const y0 = measure_start.y;
  const x1 = e.clientX;
  const y1 = e.clientY;

  const left = Math.min(x0, x1);
  const top = Math.min(y0, y1);
  const w = Math.abs(x1 - x0);
  const h = Math.abs(y1 - y0);

  show_measure_box(left, top, w, h);
}

function on_measure_up(e) {
  if (!_enabled || !measure_enabled) return;
  if (!measure_dragging || !measure_start) return;

  measure_dragging = false;

  const x0 = measure_start.x;
  const y0 = measure_start.y;
  const x1 = e.clientX;
  const y1 = e.clientY;

  const left = Math.min(x0, x1);
  const top = Math.min(y0, y1);
  const w = Math.abs(x1 - x0);
  const h = Math.abs(y1 - y0);

  show_measure_box(left, top, w, h);

  const px = { x: Math.round(left), y: Math.round(top), w: Math.round(w), h: Math.round(h) };

  const screen_el = active_screen_el();
  const sr = screen_el?.getBoundingClientRect?.();

  let pct = null;
  if (sr && sr.width && sr.height) {
    pct = {
      x: round2(((left - sr.left) / sr.width) * 100),
      y: round2(((top - sr.top) / sr.height) * 100),
      w: round2((w / sr.width) * 100),
      h: round2((h / sr.height) * 100)
    };
  }

  STATE.measure = {
    screen: current_screen_id(),
    px,
    pct,
    screen_rect_px: sr ? { x: Math.round(sr.x), y: Math.round(sr.y), w: Math.round(sr.width), h: Math.round(sr.height) } : null
  };

  push_event(`measure: px ${px.x},${px.y} ${px.w}x${px.h}`);
  refresh_output();
  refresh_status();
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// ---------- public API used by other modules (dbg_log/dbg_update) ----------

export function debug_log(message, extra) {
  if (!_enabled) return;
  const msg = extra !== undefined ? `${message} ${safe_json(extra)}` : String(message);
  push_event(msg);
}

export function debug_update(partial) {
  if (!_enabled) return;
  try { Object.assign(STATE, partial || {}); } catch (_) {}
  render();
}

function render() {
  if (!_enabled) return;
  if (panel_open) {
    refresh_status();
    refresh_output();
  }
}

// ---------- init ----------

function enable_debug() {
  if (_inited) return;
  _inited = true;

  _enabled = true;
  STATE.enabled = true;

  // Hook CSS injection watcher (for screen-manager load_css_once)
  try {
    const headAppend = document.head.appendChild.bind(document.head);
    document.head.appendChild = function (node) {
      try {
        if (node && node.tagName === "LINK" && (node.rel || "").toLowerCase() === "stylesheet") {
          STATE.css_last = node.href || node.getAttribute?.("href") || "(link)";
          push_event(`css append: ${STATE.css_last}`);
        }
      } catch (_) {}
      return headAppend(node);
    };
  } catch (_) {}

  const ready = () => {
    ensure_ui();
    // Expose VC_DEBUG surface (used by screen-manager/story-runtime)
    window.VC_DEBUG = { state: STATE, log: debug_log, update: debug_update };
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready, { once: true });
  } else {
    ready();
  }
}

export function init_debug_tools() {
  if (!has_debug_flag()) return;
  enable_debug();
}
