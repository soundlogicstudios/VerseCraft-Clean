// src/bootstrap.js
// phase 1: minimal bootstrap (loads nothing except screen manager)

import { init_screen_manager } from "../core/screen-manager.js";

function on_ready(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

on_ready(async () => {
  try {
    await init_screen_manager();
  } catch (e) {
    console.error("[bootstrap] init failed", e);
  }
});
