// src/bootstrap.js
// phase 1: bootstrap (screen manager + input + optional debug)

import { init_screen_manager } from "../core/screen-manager.js";
import { init_input } from "../core/input.js";
import { init_debug } from "../core/debug.js";

function on_ready(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

function debug_enabled() {
  const qs = location.search || "";
  return qs.includes("debug=1") || qs.includes("=debug1");
}

on_ready(async () => {
  try {
    if (debug_enabled()) {
      init_debug();
      console.log("[debug] enabled via query string");
    }

    init_input();
    await init_screen_manager();
  } catch (e) {
    console.error("[bootstrap] init failed", e);
  }
});
