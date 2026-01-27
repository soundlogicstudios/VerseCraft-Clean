// core/audio_manager.js
// VerseCraft — Global BGM wiring (screen-driven, iOS-safe)
//
// Notes:
// - iOS Safari blocks autoplay until a user gesture occurs.
// - We "unlock" on first pointerup/touchend, then start the current screen's track.
// - Single audio element, looping, lightweight, additive.

let _audio = null;
let _unlocked = false;
let _currentSrc = "";
let _desiredSrc = "";

// Paths/casing are contracts — using EXACT paths you provided.
// IMPORTANT: Backrooms filename contains a space: "backrooms_ theme.mp3"
const TRACKS = {
  backrooms: "./content/audio/packs/founders/backrooms/backrooms_ theme.mp3",
  crimson_seagull: "./content/audio/packs/founders/crimson_seagull/crimson_seagull_theme.mp3",
  relic_of_cylara: "./content/audio/packs/founders/relic_of_cylara/relic-of-cylara-theme.mp3",
  tale_of_icarus: "./content/audio/packs/founders/tale_of_icarus/tale_of_icarus_theme.mp3"
};

// Trigger music on these screens.
// If you only want music inside the story (not launcher), remove the launcher_* keys.
const SCREEN_TO_TRACK = {
  launcher_backrooms: "backrooms",
  story_backrooms: "backrooms",

  launcher_crimson_seagull: "crimson_seagull",
  story_crimson_seagull: "crimson_seagull",

  launcher_relic_of_cylara: "relic_of_cylara",
  story_relic_of_cylara: "relic_of_cylara",

  launcher_tale_of_icarus: "tale_of_icarus",
  story_tale_of_icarus: "tale_of_icarus"
};

// Default volume (0.0 - 1.0)
const DEFAULT_VOLUME = 0.85;

// If true: stop music when leaving a mapped screen.
const STOP_WHEN_UNMAPPED = true;

function ensure_audio() {
  if (_audio) return _audio;

  const a = document.createElement("audio");
  a.preload = "auto";
  a.loop = true;
  a.volume = DEFAULT_VOLUME;

  // iOS inline playback
  a.setAttribute("playsinline", "");
  a.setAttribute("webkit-playsinline", "");

  // keep it out of layout
  a.style.position = "fixed";
  a.style.left = "-9999px";
  a.style.top = "-9999px";
  a.style.width = "1px";
  a.style.height = "1px";
  a.style.opacity = "0";

  document.body.appendChild(a);
  _audio = a;
  return a;
}

function stop_music() {
  const a = ensure_audio();
  a.pause();
  a.removeAttribute("src");
  a.load();
  _currentSrc = "";
  _desiredSrc = "";
}

async function try_play(src) {
  const a = ensure_audio();

  if (!src) {
    stop_music();
    return;
  }

  _desiredSrc = src;

  // Only swap source if changed
  if (_currentSrc !== src) {
    a.pause();
    a.src = src;
    _currentSrc = src;
  }

  // iOS: must have a user gesture first
  if (!_unlocked) return;

  try {
    await a.play();
  } catch (e) {
    // If blocked, we stay armed and will try again after next gesture
    console.warn("[audio] play blocked/failed", e);
  }
}

function resolve_track_for_screen(screen_id) {
  const key = SCREEN_TO_TRACK[screen_id];
  if (!key) return "";
  return TRACKS[key] || "";
}

function get_active_screen_id() {
  return (
    document.body?.dataset?.screen ||
    document.documentElement?.getAttribute?.("data-screen") ||
    (location.hash || "").replace("#", "") ||
    ""
  );
}

function on_unlock_gesture() {
  if (_unlocked) return;
  _unlocked = true;

  // If we already wanted something, try now
  if (_desiredSrc) {
    try_play(_desiredSrc);
  }
}

function on_screen_change(e) {
  const screen_id = e?.detail?.screen || get_active_screen_id();
  const src = resolve_track_for_screen(screen_id);

  if (!src) {
    if (STOP_WHEN_UNMAPPED) stop_music();
    return;
  }

  try_play(src);
}

export function init_audio_manager() {
  ensure_audio();

  // Unlock audio on first user interaction (capture phase for iOS reliability)
  document.addEventListener("pointerup", on_unlock_gesture, { capture: true, once: true });
  document.addEventListener("touchend", on_unlock_gesture, { capture: true, once: true });

  // React to navigation
  window.addEventListener("vc:screenchange", on_screen_change);

  // Arm track if we loaded directly into a mapped screen
  const initial = get_active_screen_id();
  const initialSrc = resolve_track_for_screen(initial);
  if (initialSrc) try_play(initialSrc);

  console.log("[audio] audio manager initialized");
}
