// core/audio_manager.js
// VerseCraft — Global BGM wiring (screen-driven, iOS-safe) + AUDIT MODE
//
// Notes:
// - iOS Safari blocks autoplay until a user gesture occurs.
// - We unlock on first pointerup/touchend, then start the current screen's track.
// - This version adds an on-screen audit panel when ?=debug1 or ?debug=1 is present.
// - Additive only.

let _audio = null;
let _unlocked = false;
let _currentSrc = "";
let _desiredSrc = "";
let _lastScreen = "";

// Paths/casing are contracts — using EXACT paths you provided.
// IMPORTANT: Backrooms filename contains a space: "backrooms_ theme.mp3"
const TRACKS = {
  backrooms: "./content/audio/packs/founders/backrooms/backrooms_ theme.mp3",
  crimson_seagull: "./content/audio/packs/founders/crimson_seagull/crimson_seagull_theme.mp3",
  relic_of_cylara: "./content/audio/packs/founders/relic_of_cylara/relic-of-cylara-theme.mp3",
  tale_of_icarus: "./content/audio/packs/founders/tale_of_icarus/tale_of_icarus_theme.mp3",
  code_blue: "./content/audio/packs/founders/code_blue/code_blue_theme.mp3",
  timecop: "./content/audio/packs/founders/timecop/timecop_theme.mp3"
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
  story_tale_of_icarus: "tale_of_icarus",

  launcher_code_blue: "code_blue",
  story_code_blue: "code_blue",

  launcher_timecop: "timecop",
  story_timecop: "timecop"
};

// Default volume (0.0 - 1.0)
const DEFAULT_VOLUME = 0.85;

// If true: stop music when leaving a mapped screen.
const STOP_WHEN_UNMAPPED = true;

/* -------------------- Debug / Audit -------------------- */

function debug_enabled() {
  const qs = location.search || "";
  return qs.includes("debug=1") || qs.includes("=debug1");
}

let _auditMounted = false;
let _auditEl = null;

function audit_mount_once() {
  if (!debug_enabled() || _auditMounted) return;
  _auditMounted = true;

  const style = document.createElement("style");
  style.id = "vc_audio_audit_styles";
  style.textContent = `
    #vcAudioAudit{
      position:fixed; left:10px; right:10px; top:10px;
      z-index:9999998;
      background:rgba(0,0,0,.75); color:#fff;
      border:1px solid rgba(255,255,255,.22);
      border-radius:12px;
      padding:10px 12px;
      font:700 12px system-ui;
      max-height:40vh;
      overflow:auto;
      display:none;
    }
    #vcAudioAudit button{
      margin-right:8px;
      padding:8px 10px;
      border-radius:10px;
      border:1px solid rgba(255,255,255,.22);
      background:rgba(255,255,255,.10);
      color:#fff;
      font:800 12px system-ui;
    }
    #vcAudioAudit pre{
      margin:8px 0 0 0;
      white-space:pre-wrap;
      word-break:break-word;
      font:600 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }
    #vcAudioPill{
      position:fixed; right:12px; top:12px; z-index:9999999;
      padding:10px 14px; border-radius:999px;
      background:rgba(0,0,0,.8); color:#fff;
      font:900 13px system-ui; border:1px solid rgba(255,255,255,.3);
    }
  `;
  document.head.appendChild(style);

  const pill = document.createElement("button");
  pill.id = "vcAudioPill";
  pill.textContent = "Audio";

  const panel = document.createElement("div");
  panel.id = "vcAudioAudit";
  panel.innerHTML = `
    <div>
      <button id="vcAudioClose">Close</button>
      <button id="vcAudioRefresh">Refresh</button>
      <button id="vcAudioStop">Stop</button>
    </div>
    <pre id="vcAudioAuditText"></pre>
  `;

  document.body.appendChild(panel);
  document.body.appendChild(pill);

  const txt = panel.querySelector("#vcAudioAuditText");
  const btnClose = panel.querySelector("#vcAudioClose");
  const btnRefresh = panel.querySelector("#vcAudioRefresh");
  const btnStop = panel.querySelector("#vcAudioStop");

  function render() {
    const a = ensure_audio();
    const snap = {
      unlocked: _unlocked,
      last_screen: _lastScreen,
      desired_src: _desiredSrc || "",
      current_src: _currentSrc || "",
      audio: {
        paused: a.paused,
        ended: a.ended,
        readyState: a.readyState,
        networkState: a.networkState,
        currentTime: Number.isFinite(a.currentTime) ? Math.round(a.currentTime * 10) / 10 : null,
        volume: a.volume
      },
      mapping_hit: SCREEN_TO_TRACK[_lastScreen] || null
    };
    txt.textContent = JSON.stringify(snap, null, 2);
  }

  pill.onclick = () => {
    panel.style.display = panel.style.display === "block" ? "none" : "block";
    render();
  };
  btnClose.onclick = () => (panel.style.display = "none");
  btnRefresh.onclick = render;
  btnStop.onclick = () => {
    stop_music();
    render();
  };

  _auditEl = panel;
}

async function audit_fetch_status(src) {
  if (!src) return { ok: false, status: "no_src" };
  try {
    const res = await fetch(src, { cache: "no-store" });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: "fetch_error", error: String(e?.message || e) };
  }
}

function audit_log(msg, obj) {
  if (!debug_enabled()) return;
  console.log(`[audio] ${msg}`, obj || "");
}

/* -------------------- Core audio -------------------- */

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
  if (!_unlocked) {
    audit_log("armed (waiting for unlock)", { src });
    return;
  }

  // Audit fetch status in debug mode to catch 404s immediately
  if (debug_enabled()) {
    const st = await audit_fetch_status(src);
    audit_log("track fetch status", { src, ...st });
  }

  try {
    await a.play();
    audit_log("playing", { src });
  } catch (e) {
    audit_log("play blocked/failed", { src, error: String(e?.message || e) });
  }
}

function resolve_track_for_screen(screen_id) {
  const key = SCREEN_TO_TRACK[screen_id];
  if (!key) return { key: null, src: "" };
  return { key, src: TRACKS[key] || "" };
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

  audit_log("unlocked");
  if (_desiredSrc) try_play(_desiredSrc);
}

function on_screen_change(e) {
  const screen_id = e?.detail?.screen || get_active_screen_id();
  _lastScreen = screen_id;

  const { key, src } = resolve_track_for_screen(screen_id);

  audit_log("screenchange", { screen_id, track_key: key, src });

  if (!src) {
    if (STOP_WHEN_UNMAPPED) stop_music();
    return;
  }

  try_play(src);
}

export function init_audio_manager() {
  ensure_audio();
  audit_mount_once();

  // Unlock audio on first user interaction (capture phase for iOS reliability)
  document.addEventListener("pointerup", on_unlock_gesture, { capture: true, once: true });
  document.addEventListener("touchend", on_unlock_gesture, { capture: true, once: true });

  // React to navigation
  window.addEventListener("vc:screenchange", on_screen_change);

  // Arm track if we loaded directly into a mapped screen
  const initial = get_active_screen_id();
  _lastScreen = initial;

  const { src } = resolve_track_for_screen(initial);
  if (src) try_play(src);

  audit_log("audio manager initialized");
}
