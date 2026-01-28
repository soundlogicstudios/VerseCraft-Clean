// core/debug_ui.js
// VerseCraft Debug Lite+ (IN-GAME, NO CONSOLE REQUIRED)
// Enabled via ?debug=1 or ?=debug1
//
// Adds (no guessing):
// - Tap Probe (shows what element actually receives the tap, and whether a hitbox is under it)
// - Blocker Finder (highlights the top element under your finger + pointer-events/z-index)
// - Audit Active Screen (registry + css/hitboxes fetch status)
// - Copy Report (clipboard or selectable textarea fallback)
//
// Kept:
// - Toggle Cyan hitbox overlay
// - Snapshot + Active Hitbox List (auto-refresh on screen change)
//
// No navigation changes. No storage changes.

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

function current_screen_id() {
  return (
    document.body?.dataset?.screen ||
    document.documentElement?.getAttribute?.("data-screen") ||
    (location.hash || "").replace("#", "") ||
    "unknown"
  );
}

function snapshot() {
  const layer = active_layer();
  const hbs = active_hitboxes();
  const cs = layer ? getComputedStyle(layer) : null;
  const first = hbs[0] || null;

  return {
    screen: current_screen_id(),
    hash: location.hash || "",
    query: location.search || "",
    screen_el_found: !!active_screen_el(),
    layer_found: !!layer,
    layer_pointer_events: cs?.pointerEvents || null,
    layer_z_index: cs?.zIndex || null,
    layer_rect: layer ? safe_rect(layer) : null,
    hitbox_count_active: hbs.length,
    first_hitbox_active: first
      ? {
          dataset: { ...first.dataset },
          rect: safe_rect(first),
          inline: {
            left: first.style.left,
            top: first.style.top,
            width: first.style.width,
            height: first.style.height
          }
        }
      : null
  };
}

function list_active_hitboxes() {
  return active_hitboxes().map((hb, i) => ({
    i,
    id: hb.dataset.hitboxId || hb.getAttribute("data-hitbox-id") || hb.getAttribute("aria-label") || "",
    action: hb.dataset.action || "",
    arg: hb.dataset.arg || "",
    rect: safe_rect(hb),
    pe: getComputedStyle(hb).pointerEvents,
    z: getComputedStyle(hb).zIndex
  }));
}

async function fetch_status(path) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    return { path, ok: res.ok, status: res.status };
  } catch (e) {
    return { path, ok: false, status: "fetch_error", error: String(e?.message || e) };
  }
}

async function audit_screen(screen_id) {
  let reg;
  try {
    reg = await (await fetch("./sec/screen_registry.json", { cache: "no-store" })).json();
  } catch (e) {
    return { ok: false, reason: "registry_load_failed", error: String(e?.message || e) };
  }

  const cfg = reg?.screens?.[screen_id];
  if (!cfg) return { ok: false, reason: "screen_not_in_registry", screen_id };

  const el = q(`.screen[data-screen="${screen_id}"]`);

  const css = cfg.css ? `./${cfg.css.replace(/^\.?\//, "")}` : null;
  const hit = cfg.hitboxes ? `./${cfg.hitboxes.replace(/^\.?\//, "")}` : null;

  return {
    ok: true,
    screen_id,
    element_exists: !!el,
    css_fetch: css ? await fetch_status(css) : null,
    hitboxes_fetch: hit ? await fetch_status(hit) : null,
    background_image: el ? getComputedStyle(el).backgroundImage : null
  };
}

/* ----------------------------
   Tap Probe + Blocker Finder
---------------------------- */

let tap_probe_enabled = false;
let blocker_mode = false;
let last_tap = null;
let last_blocker = null;

function element_summary(el) {
  if (!el) return null;
  const cs = getComputedStyle(el);
  const tag = (el.tagName || "").toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls = el.className ? `.${String(el.className).trim().split(/\s+/).join(".")}` : "";
  return {
    tag,
    id,
    cls,
    pe: cs.pointerEvents,
    z: cs.zIndex,
    pos: cs.position,
    rect: safe_rect(el)
  };
}

function closest_hitbox_from(el) {
  if (!el) return null;
  const hb = el.closest?.(".hitbox") || null;
  if (!hb) return null;
  return {
    id: hb.dataset.hitboxId || hb.getAttribute("data-hitbox-id") || hb.getAttribute("aria-label") || "",
    action: hb.dataset.action || "",
    arg: hb.dataset.arg || "",
    pe: getComputedStyle(hb).pointerEvents,
    z: getComputedStyle(hb).zIndex,
    rect: safe_rect(hb)
  };
}

function element_from_point(x, y) {
  try {
    return document.elementFromPoint(x, y);
  } catch {
    return null;
  }
}

function clear_blocker_highlight() {
  qa(".vc_dbg_blocker_hit").forEach((n) => n.classList.remove("vc_dbg_blocker_hit"));
}

function highlight_el(el) {
  if (!el) return;
  clear_blocker_highlight();
  el.classList.add("vc_dbg_blocker_hit");
}

function probe_tap(e) {
  // Always capture taps when probe enabled OR blocker mode enabled
  if (!tap_probe_enabled && !blocker_mode) return;

  const x = e.clientX;
  const y = e.clientY;

  const screen_id = current_screen_id();
  const top_el = element_from_point(x, y);

  // Build a short ancestor chain to see pointer-events/z-index up the tree
  const chain = [];
  let cur = top_el;
  for (let i = 0; i < 8 && cur; i++) {
    chain.push(element_summary(cur));
    cur = cur.parentElement;
  }

  const hb = closest_hitbox_from(top_el);

  last_tap = {
    when: new Date().toISOString(),
    screen: screen_id,
    xy: { x: Math.round(x), y: Math.round(y) },
    top_element: element_summary(top_el),
    closest_hitbox: hb,
    chain
  };

  // Blocker mode: highlight the top element (what actually receives the tap)
  if (blocker_mode) {
    highlight_el(top_el);
    last_blocker = {
      when: last_tap.when,
      screen: screen_id,
      top_element: element_summary(top_el),
      closest_hitbox: hb
    };
    blocker_mode = false; // one-shot
  }
}

/* ---------- UI ---------- */

function inject_styles() {
  if (q("#vc_debug_styles")) return;

  const style = document.createElement("style");
  style.id = "vc_debug_styles";
  style.textContent = `
    #vcDebugPill{
      position:fixed; right:12px; bottom:12px; z-index:9999999;
      padding:10px 14px; border-radius:999px;
      background:rgba(0,0,0,.82); color:#fff;
      font:800 14px system-ui; border:1px solid rgba(255,255,255,.3);
    }
    #vcDebugPanel{
      position:fixed; left:10px; right:10px; bottom:60px;
      max-height:72vh; overflow:auto;
      background:rgba(0,0,0,.92); color:#fff;
      border-radius:14px; padding:12px;
      border:1px solid rgba(255,255,255,.2);
      display:none; z-index:9999999;
    }
    #vcDebugPanel button{
      padding:10px; border-radius:10px;
      border:1px solid rgba(255,255,255,.2);
      background:rgba(255,255,255,.10);
      color:#fff; font:800 13px system-ui;
      margin:6px 6px 0 0;
    }
    #vcDebugPanel .row{
      margin-top:8px;
      padding-top:8px;
      border-top:1px solid rgba(255,255,255,.12);
    }
    #vcDebugPanel pre{
      margin:10px 0 0 0;
      padding:10px;
      border-radius:10px;
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.12);
      overflow:auto;
      font:700 12px ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    #vcDebugCopyBox{
      width:100%;
      min-height:160px;
      margin-top:10px;
      padding:10px;
      border-radius:10px;
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.12);
      color:#fff;
      font:700 12px ui-monospace, SFMono-Regular, Menlo, monospace;
      display:none;
    }
    .debug-hitboxes .hitbox{
      outline:2px dashed rgba(0,255,255,.9);
      background:rgba(0,255,255,.08);
    }
    .vc_dbg_blocker_hit{
      outline:3px solid rgba(255,0,0,.9) !important;
      box-shadow: 0 0 0 3px rgba(255,0,0,.35) !important;
    }
  `;
  document.head.appendChild(style);
}

function build_report(extra = {}) {
  return {
    time: new Date().toISOString(),
    screen: current_screen_id(),
    snapshot: snapshot(),
    hitboxes: list_active_hitboxes(),
    tap_probe: last_tap,
    blocker: last_blocker,
    ...extra
  };
}

async function copy_text(text) {
  // Prefer modern clipboard
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true, method: "navigator.clipboard" };
    }
  } catch (_) {}

  // Fallback: execCommand (sometimes works on iOS)
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
    return { ok: !!ok, method: "execCommand" };
  } catch (e) {
    return { ok: false, method: "none", error: String(e?.message || e) };
  }
}

export function init_debug_ui() {
  if (!debug_enabled() || mounted) return;
  mounted = true;

  inject_styles();

  // Capture taps for probe/blocker without breaking gameplay (we do not preventDefault here)
  document.addEventListener("pointerup", probe_tap, true);

  const pill = document.createElement("button");
  pill.id = "vcDebugPill";
  pill.type = "button";
  pill.textContent = "Debug";

  const panel = document.createElement("div");
  panel.id = "vcDebugPanel";
  panel.innerHTML = `
    <button id="dbgClose" type="button">Close</button>
    <button id="dbgCyan" type="button">Toggle Cyan</button>
    <button id="dbgProbeOn" type="button">Tap Probe On</button>
    <button id="dbgProbeOff" type="button">Tap Probe Off</button>
    <button id="dbgBlocker" type="button">Find Blocker (next tap)</button>
    <button id="dbgAuditActive" type="button">Audit Active Screen</button>
    <button id="dbgCopy" type="button">Copy Report</button>

    <div class="row"></div>
    <pre id="dbgSnap"></pre>
    <pre id="dbgList"></pre>
    <pre id="dbgTap"></pre>
    <pre id="dbgAudit"></pre>
    <textarea id="vcDebugCopyBox" readonly></textarea>
  `;

  document.body.appendChild(panel);
  document.body.appendChild(pill);

  const snapEl = q("#dbgSnap", panel);
  const listEl = q("#dbgList", panel);
  const tapEl = q("#dbgTap", panel);
  const auditEl = q("#dbgAudit", panel);
  const copyBox = q("#vcDebugCopyBox", panel);

  function refresh() {
    snapEl.textContent = JSON.stringify(snapshot(), null, 2);
    listEl.textContent = JSON.stringify(list_active_hitboxes(), null, 2);
    tapEl.textContent = JSON.stringify(last_tap, null, 2);
  }

  pill.onclick = () => {
    panel.style.display = panel.style.display === "block" ? "none" : "block";
    refresh();
  };

  q("#dbgClose", panel).onclick = () => (panel.style.display = "none");

  q("#dbgCyan", panel).onclick = () => {
    const layer = active_layer();
    if (!layer) return;
    layer.classList.toggle("debug-hitboxes");
  };

  q("#dbgProbeOn", panel).onclick = () => {
    tap_probe_enabled = true;
    tapEl.textContent = "Tap Probe ENABLED. Tap anywhere, then reopen/refresh panel to see details.";
  };

  q("#dbgProbeOff", panel).onclick = () => {
    tap_probe_enabled = false;
    tapEl.textContent = "Tap Probe DISABLED.";
  };

  q("#dbgBlocker", panel).onclick = () => {
    blocker_mode = true;
    tapEl.textContent = "Blocker mode ARMED. Tap the area that should be clickable. Top element will be highlighted in red.";
  };

  q("#dbgAuditActive", panel).onclick = async () => {
    const sid = current_screen_id();
    auditEl.textContent = "Auditing...";
    const result = await audit_screen(sid);
    auditEl.textContent = JSON.stringify(result, null, 2);
  };

  q("#dbgCopy", panel).onclick = async () => {
    // Include audit (best effort) + current report
    let audit = null;
    try {
      audit = await audit_screen(current_screen_id());
    } catch (_) {}

    const report = build_report({ audit });
    const text = JSON.stringify(report, null, 2);

    const res = await copy_text(text);
    if (res.ok) {
      copyBox.style.display = "none";
      auditEl.textContent = `Copied report via ${res.method}. Paste it into chat or a note.`;
    } else {
      // Clipboard failed → show selectable textarea
      copyBox.style.display = "block";
      copyBox.value = text;
      copyBox.focus();
      copyBox.select();
      auditEl.textContent =
        `Clipboard copy failed (${res.method}). Text is in the box below — tap, hold, Select All, Copy.`;
    }
  };

  window.addEventListener("vc:screenchange", () => {
    clear_blocker_highlight();
    refresh();
  });

  refresh();

  console.log("[debug_ui] mounted (Debug Lite+)");
}
