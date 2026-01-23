// src/bootstrap.js
// phase 1: minimal bootstrap (screen manager + input only)

import { init_screen_manager } from "../core/screen-manager.js";
import { init_input } from "../core/input.js";

function on_ready(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

on_ready(async () => {
  try {
    init_input();
    await init_screen_manager();
  } catch (e) {
    console.error("[bootstrap] init failed", e);
  }
});
