// core/debug_tools.js
// VerseCraft Clean — Debug Tools (HUD + lifecycle traces)
// HARD GATE: does NOTHING unless ?debug=1 is present.
//
// Usage:
//   - Enable:  https://.../index.html?debug=1
//   - Disable: remove debug=1
//
// Exposes window.VC_DEBUG when enabled:
//   VC_DEBUG.log("msg")
//   VC_DEBUG.update({ screen, story_id, node_id, pills, css_last, last_event })

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

function ensure_hud() {
  if (hud) return;

  hud = document.createElement("div");
  hud.id = "vc_debug_hud";
  hud.style.cssText = [
    "position:fixed",
    "left:0",
    "right:0",
    "bottom:0",
    "max-height:42vh",
    "overflow:auto",
    "z-index:999999",
    "background:rgba(0,0,0,0.85)",
    "color:#9f9",
    "font:12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    "padding:8px",
    "border-top:1px solid rgba(255,255,255,0.18)",
    "display:block"
  ].join(";");

  document.body.appendChild(hud);
}

function render() {
  if (!_enabled || !hud) return;

  const lines = STATE.events
    .slice(-10)
    .map((x) => `<div>${escape_html(x)}</div>`)
    .join("");

  hud.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <div style="font-weight:800;color:#fff;">VC DEBUG</div>
      <button id="vcDbgClear" style="padding:4px 8px;border:0;border-radius:8px;background:#234;color:#fff;">Clear</button>
      <button id="vcDbgHide" style="padding:4px 8px;border:0;border-radius:8px;background:#432;color:#fff;">Hide</button>
    </div>

    <div><b>screen</b>: ${escape_html(STATE.screen || "-")}</div>
    <div><b>story</b>: ${escape_html(STATE.story_id || "-")} &nbsp; <b>node</b>: ${escape_html(STATE.node_id || "-")}</div>
    <div><b>pills</b>: ${STATE.pills === null ? "-" : String(STATE.pills)}</div>
    <div><b>css</b>: ${escape_html(STATE.css_last || "-")}</div>
    <div><b>last</b>: ${escape_html(STATE.last_event || "-")}</div>
    <hr style="border:0;border-top:1px solid rgba(255,255,255,0.15);margin:6px 0;" />
    <div>${lines}</div>
  `;

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

  hud.querySelector("#vcDbgHide")?.addEventListener(
    "click",
    () => {
      // Hide HUD only (debug still enabled; we keep hooks for continued logging)
      hud.style.display = "none";
      push_event("HUD hidden");
      STATE.last_event = "HUD hidden";
    },
    { once: true }
  );
}

function enable_debug_tools() {
  if (_inited) return;
  _inited = true;

  _enabled = true;
  STATE.enabled = true;

  // Create HUD after DOM is ready
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
    update: debug_update,
    showHud() {
      if (hud) hud.style.display = "block";
      push_event("HUD shown");
      STATE.last_event = "HUD shown";
      render();
    },
    hideHud() {
      if (hud) hud.style.display = "none";
      push_event("HUD hidden");
      STATE.last_event = "HUD hidden";
    }
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
