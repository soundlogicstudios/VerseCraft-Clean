// core/debug_ui.js
// VerseCraft Phase 1 – On-screen diagnostic tools (NO CONSOLE REQUIRED)
// Enabled via ?debug=1 or ?=debug1

import { go, get_current_screen } from "./screen-manager.js";

let mounted = false;
let tap_test_enabled = false;

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
    (typeof get_current_screen === "function" && get_current_screen()) ||
    document.body?.dataset?.screen ||
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
    id: hb.dataset.hitboxId || hb.getAttribute("aria-label") || "",
    action: hb.dataset.action || "",
    arg: hb.dataset.arg || "",
    rect: safe_rect(hb)
  }));
}

async function fetch_status(path) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    return { path, ok: res.ok, status: res.status };
  } catch {
    return { path, ok: false, status: "fetch_error" };
  }
}

async function audit_screen(screen_id) {
  let reg;
  try {
    reg = await (await fetch("./sec/screen_registry.json", { cache: "no-store" })).json();
  } catch {
    return { ok: false, reason: "registry_load_failed" };
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

/* ---------- UI ---------- */

function inject_styles() {
  if (q("#vc_debug_styles")) return;

  const style = document.createElement("style");
  style.id = "vc_debug_styles";
  style.textContent = `
    #vcDebugPill{
      position:fixed; right:12px; bottom:12px; z-index:9999999;
      padding:10px 14px; border-radius:999px;
      background:rgba(0,0,0,.8); color:#fff;
      font:800 14px system-ui; border:1px solid rgba(255,255,255,.3);
    }
    #vcDebugPanel{
      position:fixed; left:10px; right:10px; bottom:60px;
      max-height:70vh; overflow:auto;
      background:rgba(0,0,0,.92); color:#fff;
      border-radius:14px; padding:12px;
      border:1px solid rgba(255,255,255,.2);
      display:none; z-index:9999999;
    }
    #vcDebugPanel button{
      padding:10px; border-radius:10px;
      border:1px solid rgba(255,255,255,.2);
      background:rgba(255,255,255,.1);
      color:#fff; font:800 13px system-ui;
    }
    .debug-hitboxes .hitbox{
      outline:2px dashed cyan;
      background:rgba(0,255,255,.08);
    }
  `;
  document.head.appendChild(style);
}

function paint_all() {
  active_hitboxes().forEach(hb => {
    hb.style.background = "rgba(255,0,0,.25)";
    hb.style.outline = "2px solid red";
  });
}

function clear_paint() {
  active_hitboxes().forEach(hb => {
    hb.style.background = "";
    hb.style.outline = "";
  });
}

function handle_tap_test(e) {
  if (!tap_test_enabled) return;
  const hb = e.target.closest(".hitbox");
  if (!hb) return;

  e.preventDefault();
  e.stopPropagation();

  alert(
    `HITBOX TAP\nid:${hb.dataset.hitboxId}\naction:${hb.dataset.action}\narg:${hb.dataset.arg}`
  );
}

export function init_debug_ui() {
  if (!debug_enabled() || mounted) return;
  mounted = true;

  inject_styles();
  document.addEventListener("pointerup", handle_tap_test, true);

  const pill = document.createElement("button");
  pill.id = "vcDebugPill";
  pill.textContent = "Debug";

  const panel = document.createElement("div");
  panel.id = "vcDebugPanel";
  panel.innerHTML = `
    <button id="dbgClose">Close</button>
    <button id="dbgCyan">Toggle Cyan</button>
    <button id="dbgPaint">Paint Red</button>
    <button id="dbgClear">Clear Paint</button>
    <button id="dbgTapOn">Tap Test On</button>
    <button id="dbgTapOff">Tap Test Off</button>
    <button id="dbgAuditTos">Audit ToS</button>
    <button id="dbgAuditMenu">Audit Menu</button>
    <pre id="dbgSnap"></pre>
    <pre id="dbgList"></pre>
    <pre id="dbgAudit"></pre>
  `;

  document.body.appendChild(panel);
  document.body.appendChild(pill);

  const snapEl = q("#dbgSnap", panel);
  const listEl = q("#dbgList", panel);
  const auditEl = q("#dbgAudit", panel);

  function refresh() {
    snapEl.textContent = JSON.stringify(snapshot(), null, 2);
    listEl.textContent = JSON.stringify(list_active_hitboxes(), null, 2);
  }

  pill.onclick = () => {
    panel.style.display = panel.style.display === "block" ? "none" : "block";
    refresh();
  };

  q("#dbgClose", panel).onclick = () => (panel.style.display = "none");
  q("#dbgCyan", panel).onclick = () => active_layer()?.classList.toggle("debug-hitboxes");
  q("#dbgPaint", panel).onclick = () => paint_all();
  q("#dbgClear", panel).onclick = () => clear_paint();
  q("#dbgTapOn", panel).onclick = () => (tap_test_enabled = true);
  q("#dbgTapOff", panel).onclick = () => (tap_test_enabled = false);

  q("#dbgAuditTos", panel).onclick = async () =>
    auditEl.textContent = JSON.stringify(await audit_screen("tos"), null, 2);

  q("#dbgAuditMenu", panel).onclick = async () =>
    auditEl.textContent = JSON.stringify(await audit_screen("menu"), null, 2);

  window.addEventListener("vc:screenchange", refresh);

  console.log("[debug_ui] mounted");
}
