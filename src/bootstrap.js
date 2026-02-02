// src/bootstrap.js
// BOOT IMPORT AUDIT (Layout B: /core at repo root)
// - No static imports (static import failure = total black screen)
// - Dynamic imports so we can SEE which file is missing in Network/Console
//
// CANON CHANGE (Option A):
// - Remove debug_ui.js completely (no second debug panel)
// - Unified debug HUD lives in core/debug_tools.js (gear icon bottom-right)
// - Keeps debug_tools HARD-GATED behind ?debug=1

let _booted = false;

const CORE_BASE = "../core";
const ENABLE_AUDIO = true;

function has_debug_flag() {
  try {
    const params = new URLSearchParams(location.search);
    const v = params.get("debug");
    return v === "1" || v === "true" || v === "yes";
  } catch (_) {
    return false;
  }
}

function boot_log(...args) {
  try {
    console.log("[boot]", ...args);
  } catch (_) {}
}

async function safe_import(path) {
  try {
    boot_log("import ->", path);
    const mod = await import(path);
    boot_log("import ok ->", path);
    return mod;
  } catch (e) {
    console.error("[boot] import FAILED ->", path, e);
    return null;
  }
}

async function boot_once() {
  if (_booted) return;
  _booted = true;

  boot_log("starting (dynamic import audit)");
  boot_log("CORE_BASE =", CORE_BASE);

  try {
    // Core required (if this fails, nothing else matters)
    const modScreen = await safe_import(`${CORE_BASE}/screen-manager.js`);
    const modInput = await safe_import(`${CORE_BASE}/input.js`);
    const modLibraryLabels = await safe_import(`${CORE_BASE}/library_labels.js`);

    if (!modScreen?.init_screen_manager) {
      console.error("[boot] FATAL: screen-manager.js did not load or missing init_screen_manager()");
      return;
    }

    // Unified debug HUD (HARD GATE)
    if (has_debug_flag()) {
      const modDbgTools = await safe_import(`${CORE_BASE}/debug_tools.js`);
      try { modDbgTools?.init_debug_tools?.(); } catch (e) { console.warn("[boot] debug_tools init failed", e); }
    }

    // Initialize what we have (each optional)
    try { modInput?.init_input?.(); } catch (e) { console.warn("[boot] input init failed", e); }
    try { modLibraryLabels?.init_library_labels?.(); } catch (e) { console.warn("[boot] library_labels init failed", e); }

    if (ENABLE_AUDIO) {
      const modAudio = await safe_import(`${CORE_BASE}/audio_manager.js`);
      try { modAudio?.init_audio_manager?.(); } catch (e) { console.warn("[boot] audio init failed", e); }
    }

    // Optional overlays (safe)
    const modLauncherLabels = await safe_import(`${CORE_BASE}/launcher_labels.js`);
    try { modLauncherLabels?.init_launcher_labels?.(); } catch (e) { console.warn("[boot] launcher_labels init failed", e); }

    const modLauncherContent = await safe_import(`${CORE_BASE}/launcher_content.js`);
    try { modLauncherContent?.init_launcher_content?.(); } catch (e) { console.warn("[boot] launcher_content init failed", e); }

    const modStory = await safe_import(`${CORE_BASE}/story_runtime.js`);
    try { modStory?.init_story_runtime?.(); } catch (e) { console.warn("[boot] story_runtime init failed", e); }

    const modSaves = await safe_import(`${CORE_BASE}/save_menu.js`);
    try { modSaves?.init_save_menu?.(); } catch (e) { console.warn("[boot] save_menu init failed", e); }

    // Start router LAST
    await modScreen.init_screen_manager();

    boot_log("boot complete");
  } catch (e) {
    console.error("[boot] unexpected boot failure", e);
    _booted = false;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot_once, { once: true });
} else {
  boot_once();
}
