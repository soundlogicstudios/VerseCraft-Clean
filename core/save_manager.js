// core/save_manager.js
// VerseCraft — Save Manager (Phase 1)
//
// Owns destructive save operations so UI modules never delete storage directly.
//
// CURRENT BEHAVIOR:
// - clear_all_saves(): removes known save keys, including per-story vc_save_<storyId>
// - Leaves unrelated localStorage entries alone
//
// ADDITIVE & SAFE:
// - Only touches keys we own (prefix-based / known names).

const LOG = "[save_manager]";

// Known map-style keys (legacy-friendly)
const MAP_KEYS = [
  "vc_state_by_story",
  "vc_saves",
  "versecraft_saves",
  "versecraft_state_by_story"
];

// Per-story prefixes (we own these)
const PREFIXES = [
  "vc_save_",                 // current runtime: vc_save_<storyId>
  "vc_story_state_",          // legacy
  "versecraft_story_state_"   // legacy
];

function is_owned_key(key) {
  const k = String(key || "");
  if (!k) return false;
  if (MAP_KEYS.includes(k)) return true;
  return PREFIXES.some((p) => k.startsWith(p));
}

export function clear_all_saves() {
  let removed = 0;
  const removedKeys = [];

  try {
    // Remove map keys first
    for (const k of MAP_KEYS) {
      if (localStorage.getItem(k) !== null) {
        localStorage.removeItem(k);
        removed++;
        removedKeys.push(k);
      }
    }

    // Remove prefixed keys (iterate snapshot to avoid index issues)
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }

    for (const k of keys) {
      if (!is_owned_key(k)) continue;
      localStorage.removeItem(k);
      removed++;
      removedKeys.push(k);
    }
  } catch (err) {
    console.error(LOG, "clear_all_saves FAILED", err);
    throw err;
  }

  try {
    window.dispatchEvent(new CustomEvent("vc:savescleared", { detail: { removed, removedKeys } }));
  } catch (_) {}

  console.log(LOG, "clear_all_saves removed", removed, "keys");
  return { removed, removedKeys };
}

export function init_save_manager() {
  // reserved for future: confirmations, telemetry hooks, etc.
  console.log(LOG, "initialized");
}
