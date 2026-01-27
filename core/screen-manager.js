// core/screen-manager.js
// phase 1: minimal modular screen manager (explicit registry path)

let registry = null;
let current_screen = null;

const loaded_css = new Set();
const REGISTRY_PATH = "./sec/screen_registry.json";

// ADDITIVE: remember last library page (in-memory only; no storage)
let last_library_screen = "library";
const LIBRARY_SCREENS = new Set(["library", "library1", "library2"]);

// ADDITIVE: special token for "return to last library page"
const LAST_LIBRARY_TOKEN = "last_library";

// ============================================================
// ADDITIVE (Plan A): remember last STORY screen (in-memory only)
// - Any screen id that starts with "story_" counts as a story panel
// - Character/Inventory can route back via "last_story"
// ============================================================

let last_story_screen = "story_world_of_lorecraft"; // safe default (adjust if you want)
const LAST_STORY_TOKEN = "last_story";

function is_story_screen(screen_id) {
  return typeof screen_id === "string" && screen_id.startsWith("story_");
}

async function fetch_json(path) {
  const url = new URL(path, window.location.href).toString();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`[screen-manager] failed to load ${path} -> ${res.status} (${url})`);
  }
  return res.json();
}

function get_screen_element(screen_id) {
  return document.querySelector(`.screen[data-screen="${screen_id}"]`);
}

function hide_all_screens() {
  document.querySelectorAll(".screen[data-screen]").forEach((el) => {
    el.classList.remove("is-active");
  });
}

function show_screen(screen_id) {
  const el = get_screen_element(screen_id);
  if (!el) {
    console.warn(`[screen-manager] missing screen element: ${screen_id}`);
    return;
  }
  el.classList.add("is-active");
  document.documentElement.setAttribute("data-screen", screen_id);
  document.body.setAttribute("data-screen", screen_id);
}

function load_css_once(href) {
  if (!href || loaded_css.has(href)) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `./${href.replace(/^\.?\//, "")}`;
  document.head.appendChild(link);

  loaded_css.add(href);
}

async function apply_hitboxes(hitbox_path, screen_id) {
  if (!hitbox_path) return;

  const normalized = `./${hitbox_path.replace(/^\.?\//, "")}`;
  const data = await fetch_json(normalized);

  const screen_el = get_screen_element(screen_id);
  if (!screen_el) return;

  // IMPORTANT: class-based layer per screen
  const layer = screen_el.querySelector(".hitbox-layer");

  if (!layer) {
    console.warn(`[screen-manager] no .hitbox-layer for ${screen_id}`);
    return;
  }

  layer.innerHTML = "";

  if (!Array.isArray(data.hitboxes)) return;

  data.hitboxes.forEach((hb) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hitbox";

    btn.style.left = `${hb.x}%`;
    btn.style.top = `${hb.y}%`;
    btn.style.width = `${hb.w}%`;
    btn.style.height = `${hb.h}%`;

    if (hb.action) btn.dataset.action = hb.action;
    if (hb.arg !== undefined) btn.dataset.arg = hb.arg;

    // keep a stable id label for debug
    if (hb.id) btn.setAttribute("data-hitbox-id", hb.id);
    btn.setAttribute("aria-label", hb.id || "hitbox");

    layer.appendChild(btn);
  });
}

export async function init_screen_manager() {
  if (registry) return;

  registry = await fetch_json(REGISTRY_PATH);

  const start = (location.hash || "").replace("#", "") || registry.start_screen;

  await go(start);
}

// ADDITIVE: resolve special navigation tokens before screen lookup
function resolve_target(screen_id) {
  if (screen_id === LAST_LIBRARY_TOKEN) {
    return last_library_screen || "library";
  }
  if (screen_id === LAST_STORY_TOKEN) {
    return last_story_screen || "story_world_of_lorecraft";
  }
  return screen_id;
}

export async function go(screen_id) {
  if (!registry) {
    await init_screen_manager();
    return;
  }

  const resolved_id = resolve_target(screen_id);

  const screen_cfg = registry.screens?.[resolved_id];
  if (!screen_cfg) {
    console.warn(`[screen-manager] unknown screen: ${resolved_id}`);
    return;
  }

  hide_all_screens();
  load_css_once(screen_cfg.css);

  current_screen = resolved_id;
  show_screen(resolved_id);

  // ADDITIVE: record last library page when entering any library screen
  if (LIBRARY_SCREENS.has(resolved_id)) {
    last_library_screen = resolved_id;
  }

  // ADDITIVE: record last story panel when entering any story_* screen
  if (is_story_screen(resolved_id)) {
    last_story_screen = resolved_id;
  }

  try {
    history.replaceState(null, "", `#${resolved_id}`);
  } catch (_) {}

  try {
    await apply_hitboxes(screen_cfg.hitboxes, resolved_id);
  } catch (err) {
    console.error(`[screen-manager] hitbox error on ${resolved_id}`, err);
  }

  window.dispatchEvent(
    new CustomEvent("vc:screenchange", { detail: { screen: resolved_id } })
  );
}

export function get_current_screen() {
  return current_screen;
}

// ADDITIVE: expose last library screen for verification/debug if needed
export function get_last_library_screen() {
  return last_library_screen;
}

// ADDITIVE: expose last story screen for verification/debug if needed
export function get_last_story_screen() {
  return last_story_screen;
}

