// core/input.js
// phase 1: ios-safe delegated hitbox actions (go only + additive clear_all_saves)
//
// ADDITIVE:
// - Supports action: "clear_all_saves" (arg ignored)
// - Calls core/save_manager.js which owns destructive storage operations
//
// NOTE:
// - Keeps existing "go" behavior unchanged.
// - Uses capture phase pointerup for iOS reliability.

import { go } from "./screen-manager.js";
import { clear_all_saves } from "./save_manager.js";

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

  // ADDITIVE: destructive action (arg ignored)
  if (action === "clear_all_saves") {
    try {
      const result = clear_all_saves();
      console.log("[input] clear_all_saves ok", result);
    } catch (err) {
      console.error("[input] clear_all_saves FAILED", err);
    }
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

      if (action === "go" && arg) {
        go(arg);
        return;
      }

      if (action === "clear_all_saves") {
        try {
          const result = clear_all_saves();
          console.log("[input] clear_all_saves ok", result);
        } catch (err) {
          console.error("[input] clear_all_saves FAILED", err);
        }
      }
    },
    true
  );

  console.log("[input] initialized");
}
