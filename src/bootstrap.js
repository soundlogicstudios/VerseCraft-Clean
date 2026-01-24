// src/bootstrap.js
// phase 1: bootstrap (screen manager + input + debug ui pill)

import { init_screen_manager } from "../core/screen-manager.js";
import { init_input } from "../core/input.js";
import { init_debug_ui } from "../core/debug_ui.js";

function on_ready(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

on_ready(async () => {
  try {
    init_debug_ui(); // shows only with ?debug=1 or ?=debug1
    init_input();
    await init_screen_manager();
  } catch (e) {
    console.error("[bootstrap] init failed", e);
  }
});
