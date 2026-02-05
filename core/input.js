// core/input.js
// phase 1: ios-safe delegated hitbox actions (go + clear_saves)

import { go } from "./screen-manager.js";

let _bound = false;

function clear_all_saves() {
  // Remove known map keys (safe)
  const MAP_KEYS = [
    "vc_state_by_story",
    "vc_saves",
    "versecraft_saves",
    "versecraft_state_by_story"
  ];

  try {
    MAP_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch (_) {}

  // Remove per-story save keys (Phase 1 uses vc_save_<storyId>)
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // Keep this list conservative to avoid nuking unrelated stuff.
      if (
        key.startsWith("vc_save_") ||
        key.startsWith("vc_story_state_") ||
        key.startsWith("versecraft_story_state_")
      ) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch (_) {}

  // Notify overlays to rehydrate (save menu, etc.)
  try {
    window.dispatchEvent(new CustomEvent("vc:savescleared"));
  } catch (_) {}
}

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

  // ADDITIVE: clear all saves
  if (action === "clear_saves") {
    // arg convention: "all"
    if (!arg || arg === "all") {
      clear_all_saves();
      return;
    }
    console.warn("[input] clear_saves unknown arg:", arg);
    clear_all_saves();
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

      if (action === "clear_saves") {
        if (!arg || arg === "all") {
          clear_all_saves();
          return;
        }
        clear_all_saves();
      }
    },
    true
  );

  console.log("[input] initialized");
}
