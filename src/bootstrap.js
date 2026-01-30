// src/bootstrap.js
// Single-pass bootstrap (screen manager + input + debug UI + overlays + audio)

import { init_screen_manager } from "../core/screen-manager.js";
import { init_input } from "../core/input.js";
import { init_debug_ui } from "../core/debug_ui.js";
import { init_library_labels } from "../core/library_labels.js";
import { init_audio_manager } from "../core/audio_manager.js";

let _booted = false;

const ENABLE_AUDIO = true;

async function boot_once() {
  if (_booted) return;
  _booted = true;

  try {
    init_debug_ui();
    init_input();

    // Phase 1 (already working)
    init_library_labels();

    // Audio wiring (iOS-safe: plays only after first user gesture)
    if (ENABLE_AUDIO) {
      try {
        init_audio_manager();
      } catch (e) {
        console.warn("[bootstrap] audio manager not loaded", e);
      }
    }

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

    // ADDITIVE: Story runtime (catalog-first, fallback-safe)
    // Mounts on story_* screens only; never touches hitbox navigation.
    try {
      const modStory = await import("../core/story_runtime.js");
      modStory?.init_story_runtime?.();
    } catch (e) {
      console.warn("[bootstrap] story runtime not loaded", e);
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
