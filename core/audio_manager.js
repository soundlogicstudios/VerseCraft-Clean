// core/audio_manager.js
// VerseCraft — Global BGM wiring (screen-driven, iOS-safe) with built-in diagnostics
//
// Adds:
// - Console diagnostics on every screen change: screen_id -> track_key -> src -> fetch status
// - window.VC_AUDIO_STATUS() helper to inspect current state

let _audio = null;
let _unlocked = false;
let _currentSrc = "";
let _desiredSrc = "";
let _last = { screen: "", key: "", src: "", fetch: null, playError: "" };

// Paths/casing are contracts — using EXACT paths you provided.
// IMPORTANT: Backrooms filename contains a space: "backrooms_ theme.mp3"
const TRACKS = {
  backrooms: "./content/audio/packs/founders/backrooms/backrooms_ theme.mp3",
  crimson_seagull: "./content/audio/packs/founders/crimson_seagull/crimson_seagull_theme.mp3",
  relic_of_cylara: "./content/audio/packs/founders/relic_of_cylara/relic-of-cylara-theme.mp3",
  tale_of_icarus: "./content/audio/packs/founders/tale_of_icarus/tale_of_icarus_theme.mp3",
  code_blue: "./content/audio/packs/founders/code_blue/code_blue_theme.mp3",
  timecop: "./content/audio/packs/founders/timecop/timecop_theme.mp3",

  cosmos: "./content/audio/packs/founders/cosmos/cosmos_theme.mp3",
  dead_drop_protocol: "./content/audio/packs/founders/dead_drop_protocol/dead_drop_protocol_theme.mp3",
  oregon_trail: "./content/audio/packs/founders/oregon_trail/oregon_trail_theme.mp3",

  wastelands: "./content/audio/packs/founders/wastelands/wastelands_theme.mp3",
  king_solomon: "./content/audio/packs/founders/king_solomon/king_solomon_theme.mp3",
  world_of_lorecraft: "./content/audio/packs/starter/world_of_lorecraft/world_of_lorecraft_theme.mp3"
};

// Trigger music on these screens (launcher + story).
const SCREEN_TO_TRACK = {
  launcher_backrooms: "backrooms",
  story_backrooms: "backrooms",

  launcher_crimson_seagull: "crimson_seagull",
  story_crimson_seagull: "crimson_seagull",

  launcher_relic_of_cylara: "relic_of_cylara",
  story_relic_of_cylara: "relic_of_cylara",

  launcher_tale_of_icarus: "tale_of_icarus",
  story_tale_of_icarus: "tale_of_icarus",

  launcher_code_blue: "code_blue",
  story_code_blue: "code_blue",

  launcher_timecop: "timecop",
  story_timecop: "timecop",

  launcher_cosmos: "cosmos",
  story_cosmos: "cosmos",

  launcher_dead_drop_protocol: "dead_drop_protocol",
  story_dead_drop_protocol: "dead_drop_protocol",

  launcher_oregon_trail: "oregon_trail",
  story_oregon_trail: "oregon_trail",

  launcher_wastelands: "wastelands",
  story_wastelands: "wastelands",

  launcher_king_solomon: "king_solomon",
  story_king_solomon: "king_solomon",

  launcher_world_of_lorecraft: "world_of_lorecraft",
  story_world_of_lorecraft: "world_of_lorecraft",

  // ADDITIVE: keep music persistent when entering Lorecraft's dedicated inventory screen
  inventory_world_of_lorecraft: "world_of_lorecraft"
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

  a.setAttribute("playsinline", "");
  a.setAttribute("webkit-playsinline", "");

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

async function fetch_status(src) {
  if (!src) return { ok: false, status: "no_src" };
  try {
    const res = await fetch(src, { cache: "no-store" });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: "fetch_error", error: String(e?.message || e) };
  }
}

async function try_play(src) {
  const a = ensure_audio();

  if (!src) {
    stop_music();
    return;
  }

  _desiredSrc = src;
  _last.playError = "";

  if (_currentSrc !== src) {
    a.pause();
    a.src = src;
    _currentSrc = src;
  }

  // Check fetch every time we switch tracks (catches 404 immediately)
  _last.fetch = await fetch_status(src);
  console.log("[audio] fetch", { src, ..._last.fetch });

  if (!_unlocked) {
    console.log("[audio] armed (waiting for user gesture)", { src });
    return;
  }

  try {
    await a.play();
    console.log("[audio] playing", { src });
  } catch (e) {
    _last.playError = String(e?.message || e);
    console.warn("[audio] play failed", { src, error: _last.playError });
  }
}

function resolve_for_screen(screen_id) {
  const key = SCREEN_TO_TRACK[screen_id] || "";
  const src = key ? (TRACKS[key] || "") : "";
  return { key, src };
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
  console.log("[audio] unlocked by gesture");
  if (_desiredSrc) try_play(_desiredSrc);
}

function on_screen_change(e) {
  const screen_id = e?.detail?.screen || get_active_screen_id();
  const { key, src } = resolve_for_screen(screen_id);

  _last.screen = screen_id;
  _last.key = key;
  _last.src = src;

  console.log("[audio] screenchange", { screen_id, track_key: key, src });

  if (!src) {
    if (STOP_WHEN_UNMAPPED) stop_music();
    return;
  }

  try_play(src);
}

export function init_audio_manager() {
  ensure_audio();

  // Debug helper you can call from console any time
  window.VC_AUDIO_STATUS = function VC_AUDIO_STATUS() {
    const a = ensure_audio();
    return {
      unlocked: _unlocked,
      last: { ..._last },
      desired_src: _desiredSrc,
      current_src: _currentSrc,
      audio: {
        paused: a.paused,
        readyState: a.readyState,
        networkState: a.networkState,
        currentTime: a.currentTime,
        volume: a.volume
      }
    };
  };

  document.addEventListener("pointerup", on_unlock_gesture, { capture: true, once: true });
  document.addEventListener("touchend", on_unlock_gesture, { capture: true, once: true });

  window.addEventListener("vc:screenchange", on_screen_change);

  // Arm initial screen if mapped
  const initial = get_active_screen_id();
  const { src } = resolve_for_screen(initial);
  if (src) try_play(src);

  console.log("[audio] audio manager initialized");
}
