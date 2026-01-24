// core/debug_ui.js
// on-screen debug pill (no console needed)
// shows only when ?debug=1 or ?=debug1 is present

import { go, get_current_screen } from "./screen-manager.js";

let mounted = false;

function debug_enabled() {
  const qs = location.search || "";
  return qs.includes("debug=1") || qs.includes("=debug1");
}

function q(sel) {
  return document.querySelector(sel);
}

function active_layer() {
  return q(".screen.is-active #hitboxLayer") || q("#hitboxLayer");
}

function hitbox_count() {
  return document.querySelectorAll(".hitbox").length;
}

function snap() {
  const screen =
    (typeof get_current_screen === "function" && get_current_screen()) ||
    document.body?.dataset?.screen ||
    (location.hash || "").replace("#", "") ||
    "unknown";

  return {
    screen,
    hash: location.hash || "",
    hitboxes: hitbox_count(),
    search: location.search || ""
  };
}

function inject_styles() {
  if (q("#vc_debug_ui_styles")) return;

  const css = `
  #vcDebugPill{
    position:fixed; z-index:999999;
    right:12px; bottom:12px;
    padding:10px 12px;
    border-radius:999px;
    border:1px solid rgba(255,255,255,.25);
    background:rgba(0,0,0,.72);
    color:#fff;
    font:600 14px/1 system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
    letter-spacing:.2px;
    backdrop-filter: blur(6px);
  }
  #vcDebugPill:active{ transform: scale(.98); }
  #vcDebugPanel{
    position:fixed; z-index:999999;
    left:10px; right:10px; bottom:60px;
    max-height:55vh; overflow:auto;
    border-radius:14px;
    border:1px solid rgba(255,255,255,.18);
    background:rgba(0,0,0,.84);
    color:#fff;
    padding:12px;
    font:14px/1.35 system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
    backdrop-filter: blur(8px);
    display:none;
  }
  #vcDebugPanel .row{ display:flex; gap:8px; flex-wrap:wrap; margin:10px 0; }
  #vcDebugPanel button{
    padding:10px 10px;
    border-radius:10px;
    border:1px solid rgba(255,255,255,.18);
    background:rgba(255,255,255,.08);
    color:#fff;
    font:600 13px/1 system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
  }
  #vcDebugPanel button:active{ transform: scale(.99); }
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

function toggle_hitbox_outlines(on) {
  const layer = active_layer();
  if (!layer) return { ok: false, reason: "no hitboxLayer" };
  layer.classList.toggle("debug-hitboxes", !!on);
  return { ok: true, on: !!on };
}

function panel_text() {
  return JSON.stringify(snap(), null, 2);
}

export function init_debug_ui() {
  if (!debug_enabled()) return;
  if (mounted) return;
  mounted = true;

  inject_styles();

  const pill = document.createElement("button");
  pill.id = "vcDebugPill";
  pill.type = "button";
  pill.textContent = "Debug";

  const panel = document.createElement("div");
  panel.id = "vcDebugPanel";
  panel.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
      <div style="font-weight:800;">VerseCraft Debug</div>
      <button id="vcDbgClose" type="button">Close</button>
    </div>

    <div class="row">
      <button id="vcDbgSnap" type="button">Snapshot</button>
      <button id="vcDbgShow" type="button">Show Hitboxes</button>
      <button id="vcDbgHide" type="button">Hide Hitboxes</button>
    </div>

    <div class="row">
      <button id="vcDbgGoSplash" type="button">Go Splash</button>
      <button id="vcDbgGoTos" type="button">Go ToS</button>
    </div>

    <pre id="vcDbgOut"></pre>
  `;

  document.body.appendChild(panel);
  document.body.appendChild(pill);

  const out = () => q("#vcDbgOut");

  function refresh() {
    if (out()) out().textContent = panel_text();
  }

  pill.addEventListener("click", () => {
    const is_open = panel.style.display === "block";
    panel.style.display = is_open ? "none" : "block";
    refresh();
  });

  q("#vcDbgClose")?.addEventListener("click", () => {
    panel.style.display = "none";
  });

  q("#vcDbgSnap")?.addEventListener("click", refresh);

  q("#vcDbgShow")?.addEventListener("click", () => {
    toggle_hitbox_outlines(true);
    refresh();
  });

  q("#vcDbgHide")?.addEventListener("click", () => {
    toggle_hitbox_outlines(false);
    refresh();
  });

  q("#vcDbgGoSplash")?.addEventListener("click", async () => {
    await go("splash");
    refresh();
  });

  q("#vcDbgGoTos")?.addEventListener("click", async () => {
    await go("tos");
    refresh();
  });

  // update snapshot automatically on screen changes
  window.addEventListener("vc:screenchange", () => {
    if (panel.style.display === "block") refresh();
  });

  // initial
  refresh();
}
