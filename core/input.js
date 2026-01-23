// core/input.js
// phase 1: single delegated hitbox handler
// reads data-action and data-arg from .hitbox buttons
// supports: action="go" (routes to another screen)

import { go } from "./screen-manager.js";

let bound = false;

function handle_hitbox_click(e) {
  const el = e.target?.closest?.(".hitbox");
  if (!el) return;

  const action = (el.dataset.action || "").trim().toLowerCase();
  const arg = el.dataset.arg;

  if (!action) return;

  // prevent ghost clicks / double tap zoom interference
  e.preventDefault();

  if (action === "go") {
    if (!arg) return;
    go(String(arg).trim().toLowerCase());
    return;
  }

  console.warn("[input] unknown action:", action, "arg:", arg);
}

export function init_input() {
  if (bound) return;
  bound = true;

  // capture phase makes this reliable even with overlays
  document.addEventListener("click", handle_hitbox_click, true);

  // optional: iOS touchstart for slightly snappier taps
  document.addEventListener(
    "touchstart",
    (e) => {
      const el = e.target?.closest?.(".hitbox");
      if (el) e.preventDefault();
    },
    { passive: false, capture: true }
  );

  console.log("[input] initialized");
}
