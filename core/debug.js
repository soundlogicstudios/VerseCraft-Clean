// core/debug.js
// phase 1: console-only debug tools
// gated behind ?debug=1 or ?=debug1
// exposes window.vc ONLY when enabled

import { go, get_current_screen } from "./screen-manager.js";

let enabled = false;

function debug_enabled() {
  const qs = location.search || "";
  return qs.includes("debug=1") || qs.includes("=debug1");
}

function active_layer() {
  return (
    document.querySelector(".screen.is-active #hitboxLayer") ||
    document.querySelector("#hitboxLayer")
  );
}

function hitboxes() {
  return Array.from(document.querySelectorAll(".hitbox"));
}

function snapshot() {
  const screen =
    get_current_screen?.() ||
    document.body?.dataset?.screen ||
    "unknown";

  const layer = active_layer();
  const hbs = hitboxes();
  const first = hbs[0];
  const rect = first ? first.getBoundingClientRect() : null;

  return {
    screen,
    hash: location.hash,
    hitbox_count: hbs.length,
    layer_found: !!layer,
    layer_pointer_events: layer
      ? getComputedStyle(layer).pointerEvents
      : null,
    first_hitbox: first
      ? {
          dataset: { ...first.dataset },
          rect: rect
            ? {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                w: Math.round(rect.width),
                h: Math.round(rect.height)
              }
            : null
        }
      : null
  };
}

function show_hitboxes(on = true) {
  const layer = active_layer();
  if (!layer) return { ok: false, reason: "no hitboxLayer" };

  if (on) layer.classList.add("debug-hitboxes");
  else layer.classList.remove("debug-hitboxes");

  return { ok: true, debug_hitboxes: on };
}

function paint_hitbox(index = 0) {
  const hb = hitboxes()[index];
  if (!hb) return { ok: false, reason: "no hitbox at index" };

  hb.style.background = "rgba(255,0,0,0.25)";
  hb.style.outline = "3px solid rgba(255,0,0,0.9)";
  hb.style.zIndex = "999999";

  return { ok: true, index };
}

function clear_paint() {
  hitboxes().forEach((hb) => {
    hb.style.background = "";
    hb.style.outline = "";
    hb.style.zIndex = "";
  });
  return { ok: true };
}

async function reload_screen() {
  const screen =
    get_current_screen?.() ||
    (location.hash || "").replace("#", "") ||
    "splash";

  await go(screen);
  return snapshot();
}

export function init_debug() {
  if (!debug_enabled()) return;
  if (enabled) return;
  enabled = true;

  // expose a single, intentional debug surface
  window.vc = {
    snap: () => snapshot(),
    go: async (screen_id) => {
      await go(screen_id);
      return snapshot();
    },
    hitboxes: () => hitboxes(),
    show_hitboxes: () => show_hitboxes(true),
    hide_hitboxes: () => show_hitboxes(false),
    paint_hitbox: (i = 0) => paint_hitbox(i),
    clear_paint: () => clear_paint(),
    reload: async () => await reload_screen()
  };

  console.log("[debug] vc tools enabled");
}
