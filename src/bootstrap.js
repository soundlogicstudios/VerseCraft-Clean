// src/bootstrap.js
// Single-pass bootstrap (screen manager + input + debug UI + overlays)

import { init_screen_manager } from "../core/screen-manager.js";
import { init_input } from "../core/input.js";
import { init_debug_ui } from "../core/debug_ui.js";
import { init_library_labels } from "../core/library_labels.js";

let _booted = false;

async function boot_once() {
  if (_booted) return;
  _booted = true;

  try {
    init_debug_ui();
    init_input();

    // Phase 1 (already working)
    init_library_labels();

    // Optional overlays: load safely so they can NEVER kill boot
    try {
      const modLabels = await import("../core/launcher_labels.js");
      modLabels?.init_launcher_labels?.();
    } catch (e) {
      console.warn("[bootstrap] launcher labels not loaded", e);
    }

    try {
      const modContent = await import("../core/launcher_content.js");
      modContent?.init_launcher_content?.();
    } catch (e) {
      console.warn("[bootstrap] launcher content not loaded", e);
    }

    // Settings volume slider UI (safe optional)
    try {
      const modVol = await import("../core/settings_volume_ui.js");
      modVol?.init_settings_volume_ui?.();
    } catch (e) {
      console.warn("[bootstrap] settings volume ui not loaded", e);
    }

    await init_screen_manager();
  } catch (e) {
    console.error("[bootstrap] init failed", e);
    _booted = false;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot_once, { once: true });
} else {
  boot_once();
}
