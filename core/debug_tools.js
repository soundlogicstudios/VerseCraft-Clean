// core/debug_tools.js
// VerseCraft Clean — Debug Tools (HUD + lifecycle traces)
// HARD GATE: does NOTHING unless ?debug=1 is present.
//
// Usage:
//   Enable:  https://.../index.html?debug=1
//   Disable: remove debug=1
//
// Important safety rule:
// - The HUD MUST NEVER block gameplay UI.
//   => HUD container uses pointer-events:none
//   => Only buttons inside HUD use pointer-events:auto

let _enabled = false;
let _inited = false;

const STATE = {
  enabled: false,
  screen: null,
  story_id: null,
  node_id: null,
  pills: null,
  css_last: null,
  last_event: null,
  events: []
};

const MAX_EVENTS = 24;

function has_debug_flag() {
  try {
    const params = new URLSearchParams(location.search);
    const v = params.get("debug");
    return v === "1" || v === "true" || v === "yes";
  } catch (_) {
    return false;
  }
}

function now_ms() {
  return Math.round(performance.now());
}

function escape_html(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function push_event(line) {
  const stamp = `${now_ms()}ms`;
  STATE.events.push(`${stamp} ${line}`);
  if (STATE.events.length > MAX_EVENTS) STATE.events.shift();
}

let hud = null;
let hud_minimized = false;

function ensure_hud() {
  if (hud) return;

  hud = document.createElement("div");
  hud.id = "vc_debug_hud";

  // CRITICAL: never block interaction under HUD
  // pointer-events:none on container; buttons inside set to auto.
  hud.style.cssText = [
    "position:fixed",
    "left:8px",
    "right:8px",
    "bottom:8px",
    "z-index:999999",
    "pointer-events:none",
    "display:block"
  ].join(";");

  document.body.appendChild(hud);
}

function render() {
  if (!_enabled || !hud) return;

  const lines = STATE.events
    .slice(-8)
    .map((x) => `<div style="margin:0 0 2px 0;">${escape_html(x)}</div>`)
    .join("");

  const header = `
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="font-weight:900;color:#fff;">VC DEBUG</div>
      <div style="opacity:0.85;color:#cfc;">${escape_html(STATE.last_event || "-")}</div>

      <div style="margin-left:auto;display:flex;gap:6px;">
        <button id="vcDbgMin"
          style="pointer-events:auto;padding:4px 8px;border:0;border-radius:10px;background:rgba(40,60,90,0.92);color:#fff;">
          ${hud_minimized ? "Show" : "Min"}
        </button>
        <button id="vcDbgClear"
          style="pointer-events:auto;padding:4px 8px;border:0;border-radius:10px;background:rgba(30,60,40,0.92);color:#fff;">
          Clear
        </button>
      </div>
    </div>
  `;

  const body_full = `
    <div style="margin-top:6px;">
      <div><b>screen</b>: ${escape_html(STATE.screen || "-")}</div>
      <div><b>story</b>: ${escape_html(STATE.story_id || "-")} &nbsp; <b>node</b>: ${escape_html(STATE.node_id || "-")}</div>
      <div><b>pills</b>: ${STATE.pills === null ? "-" : String(STATE.pills)}</div>
      <div style="opacity:0.9;"><b>css</b>: ${escape_html(STATE.css_last || "-")}</div>
      <hr style="border:0;border-top:1px solid rgba(255,255,255,0.15);margin:6px 0;" />
      <div style="max-height:22vh;overflow:auto;-webkit-overflow-scrolling:touch;">${lines}</div>
    </div>
  `;

  // Visual-only panel: small, translucent, non-obstructive.
  // (Still cannot block touches due to pointer-events:none on container.)
  hud.innerHTML = `
    <div style="
      background:rgba(0,0,0,0.55);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      color:#9f9;
      border:1px solid rgba(255,255,255,0.14);
      border-radius:14px;
      padding:8px 10px;
      font:12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      box-shadow:0 10px 24px rgba(0,0,0,0.35);
    ">
      ${header}
      ${hud_minimized ? "" : body_full}
    </div>
  `;

  // Buttons must be clickable
  hud.querySelector("#vcDbgClear")?.addEventListener(
    "click",
    () => {
      STATE.events = [];
      push_event("HUD cleared");
      STATE.last_event = "HUD cleared";
      render();
    },
    { once: true }
  );

  hud.querySelector("#vcDbgMin")?.addEventListener(
    "click",
    () => {
      hud_minimized = !hud_minimized;
      push_event(hud_minimized ? "HUD minimized" : "HUD expanded");
      STATE.last_event = hud_minimized ? "HUD minimized" : "HUD expanded";
      render();
    },
    { once: true }
  );
}

function enable_debug_tools() {
  if (_inited) return;
  _inited = true;

  _enabled = true;
  STATE.enabled = true;

  const ready = () => {
    ensure_hud();
    push_event("debug_tools enabled");
    STATE.last_event = "debug_tools enabled";
    render();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready, { once: true });
  } else {
    ready();
  }

  // CSS injection watcher (head append)
  try {
    const headAppend = document.head.appendChild.bind(document.head);
    document.head.appendChild = function (node) {
      try {
        if (node && node.tagName === "LINK" && (node.rel || "").toLowerCase() === "stylesheet") {
          STATE.css_last = node.href || node.getAttribute?.("href") || "(link)";
          push_event(`css append: ${STATE.css_last}`);
          STATE.last_event = "css append";
          render();
        }
      } catch (_) {}
      return headAppend(node);
    };
  } catch (_) {}

  // DOM wipe detector (story_* only)
  // IMPORTANT: still gated by debug flag; never runs otherwise.
  try {
    const ih = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
    if (ih?.set && !window.__VC_DBG_PATCHED_INNERHTML) {
      window.__VC_DBG_PATCHED_INNERHTML = true;
      Object.defineProperty(Element.prototype, "innerHTML", {
        get: ih.get,
        set(v) {
          const scr = this.closest?.("[data-screen]")?.getAttribute("data-screen");
          if (scr && scr.startsWith("story_")) {
            push_event(`DOM WIPE innerHTML: ${scr} target=${this.className || this.tagName}`);
            STATE.last_event = "DOM WIPE innerHTML";
            render();
          }
          return ih.set.call(this, v);
        }
      });
    }
  } catch (_) {}

  try {
    if (!window.__VC_DBG_PATCHED_REPLACECHILDREN) {
      window.__VC_DBG_PATCHED_REPLACECHILDREN = true;
      const rc = Element.prototype.replaceChildren;
      Element.prototype.replaceChildren = function (...nodes) {
        const scr = this.closest?.("[data-screen]")?.getAttribute("data-screen");
        if (scr && scr.startsWith("story_")) {
          push_event(`DOM WIPE replaceChildren: ${scr} target=${this.className || this.tagName}`);
          STATE.last_event = "DOM WIPE replaceChildren";
          render();
        }
        return rc.apply(this, nodes);
      };
    }
  } catch (_) {}

  // Public surface
  window.VC_DEBUG = {
    state: STATE,
    log: debug_log,
    update: debug_update
  };
}

export function init_debug_tools() {
  // HARD GATE
  if (!has_debug_flag()) return;
  enable_debug_tools();
}

export function debug_log(message, extra) {
  if (!_enabled) return;
  const msg = extra !== undefined ? `${message} ${safe_json(extra)}` : String(message);
  push_event(msg);
  STATE.last_event = msg.slice(0, 80);
  render();
}

export function debug_update(partial) {
  if (!_enabled) return;
  try {
    Object.assign(STATE, partial || {});
  } catch (_) {}
  render();
}

function safe_json(v) {
  try {
    return JSON.stringify(v);
  } catch (_) {
    return String(v);
  }
}
