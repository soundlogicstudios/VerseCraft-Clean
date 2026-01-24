// core/input.js
// phase 1: ios-safe delegated hitbox actions (go only)

import { go } from "./screen-manager.js";

let _bound = false;

function on_pointerup(e) {
  const hb = e.target?.closest?.(".hitbox");
  if (!hb) return;

  // prevent any overlays from hijacking the tap
  e.preventDefault();
  e.stopPropagation();

  const action = (hb.dataset.action || "").trim().toLowerCase();
  const arg = (hb.dataset.arg || "").trim();

  if (action === "go" && arg) {
    go(arg);
    return;
  }

  console.warn("[input] hitbox missing/unknown action:", { action, arg, hb });
}

export function init_input() {
  if (_bound) return;
  _bound = true;

  // capture phase is key on iOS
  document.addEventListener("pointerup", on_pointerup, true);

  // optional: also support click fallback
  document.addEventListener(
    "click",
    (e) => {
      const hb = e.target?.closest?.(".hitbox");
      if (!hb) return;
      e.preventDefault();
      e.stopPropagation();
      const action = (hb.dataset.action || "").trim().toLowerCase();
      const arg = (hb.dataset.arg || "").trim();
      if (action === "go" && arg) go(arg);
    },
    true
  );

  console.log("[input] initialized");
}
