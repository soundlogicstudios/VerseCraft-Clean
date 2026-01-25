// src/bootstrap.js
// Single-pass bootstrap (screen manager + input + debug UI + UI label overlays)

import { init_screen_manager } from "../core/screen-manager.js";
import { init_input } from "../core/input.js";
import { init_debug_ui } from "../core/debug_ui.js";
import { init_library_labels } from "../core/library_labels.js";

let _booted = false;

async function boot_once() {
  if (_booted) return;
  _booted = true;

  try {
    // Debug UI is safe to init first (it only shows when enabled)
    init_debug_ui();

    // Input + router/screen manager
    init_input();

    // Optional UI overlays: load safely so a missing file can't black-screen the app
try {
  const mod = await import("../core/launcher_labels.js");
  mod?.init_launcher_labels?.();
} catch (e) {
  console.warn("[bootstrap] launcher labels not loaded", e);
}

    // UI overlays that listen to vc:screenchange
    init_library_labels();

    await init_screen_manager();
  } catch (e) {
    console.error("[bootstrap] init failed", e);
    // allow retry if init truly failed before completing
    _booted = false;
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      boot_once();
    },
    { once: true }
  );
} else {
  boot_once();
}
