// src/bootstrap.js
// Single-pass bootstrap (screen manager + input + debug UI)
// Removes redundancy from prior IIFE + on_ready double-init.

import { init_screen_manager } from "../core/screen-manager.js";
import { init_input } from "../core/input.js";
import { init_debug_ui } from "../core/debug_ui.js";

let _booted = false;

async function boot_once() {
  if (_booted) return;
  _booted = true;

  try {
    // Debug UI should be safe to call first (it conditionally shows on ?debug=1)
    init_debug_ui();
    init_input();
    await init_screen_manager();
  } catch (e) {
    console.error("[bootstrap] init failed", e);
    // Allow retry if something truly catastrophic happens before init completes
    _booted = false;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    boot_once();
  }, { once: true });
} else {
  boot_once();
}
