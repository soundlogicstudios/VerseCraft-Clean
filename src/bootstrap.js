// src/bootstrap.js
// phase 1: minimal bootstrap + hard diagnostics for ios safari

import { init_screen_manager } from "../core/screen-manager.js";

function on_ready(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

function log_error(prefix, e) {
  // safari often shows Error {} unless we print these explicitly
  console.error(prefix);
  try { console.error("name:", e?.name); } catch (_) {}
  try { console.error("message:", e?.message); } catch (_) {}
  try { console.error("stack:", e?.stack); } catch (_) {}
  try { console.error("raw:", e); } catch (_) {}
}

window.addEventListener("error", (ev) => {
  console.error("[global error]", ev?.message || ev);
});

window.addEventListener("unhandledrejection", (ev) => {
  console.error("[unhandled rejection]", ev?.reason || ev);
});

on_ready(async () => {
  try {
    console.log("[bootstrap] starting...");
    await init_screen_manager();
    console.log("[bootstrap] ok");
  } catch (e) {
    log_error("[bootstrap] init failed", e);
  }
});
