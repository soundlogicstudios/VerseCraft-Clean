// core/screen-manager.js
// phase 1: minimal modular screen manager
// responsibilities:
// - read screen_registry.json
// - switch active screen
// - load per-screen css
// - load per-screen hitboxes
// no story logic, no controllers yet

let registry = null;
let current_screen = null;

// cache loaded css so we never reload it
const loaded_css = new Set();

async function fetch_json(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`[screen-manager] failed to load ${path} (${res.status})`);
  }
  return res.json();
}

function get_screen_element(screen_id) {
  return document.querySelector(
    `.screen[data-screen="${screen_id}"]`
  );
}

function hide_all_screens() {
  document
    .querySelectorAll(".screen[data-screen]")
    .forEach((el) => el.classList.remove("is-active"));
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
  link.href = href;
  document.head.appendChild(link);

  loaded_css.add(href);
}

async function apply_hitboxes(hitbox_path, screen_id) {
  if (!hitbox_path) return;

  const data = await fetch_json(hitbox_path);

  const screen_el = get_screen_element(screen_id);
  if (!screen_el) return;

  const layer =
    screen_el.querySelector("#hitboxLayer") ||
    document.querySelector("#hitboxLayer");

  if (!layer) {
    console.warn(`[screen-manager] no #hitboxLayer for ${screen_id}`);
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

    btn.setAttribute("aria-label", hb.id || "hitbox");

    layer.appendChild(btn);
  });
}

export async function init_screen_manager() {
  if (registry) return;

  registry = await fetch_json("sec/screen_registry.json");

  const start =
    (location.hash || "").replace("#", "") ||
    registry.start_screen;

  await go(start);
}

export async function go(screen_id) {
  if (!registry) {
    await init_screen_manager();
    return;
  }

  const screen_cfg = registry.screens[screen_id];
  if (!screen_cfg) {
    console.warn(`[screen-manager] unknown screen: ${screen_id}`);
    return;
  }

  hide_all_screens();

  // load css once
  load_css_once(screen_cfg.css);

  // activate screen
  current_screen = screen_id;
  show_screen(screen_id);

  // update hash (navigation-safe)
  try {
    history.replaceState(null, "", `#${screen_id}`);
  } catch (_) {}

  // apply hitboxes for this screen
  try {
    await apply_hitboxes(screen_cfg.hitboxes, screen_id);
  } catch (err) {
    console.error(
      `[screen-manager] hitbox error on ${screen_id}`,
      err
    );
  }

  // notify future systems (story, controllers, etc.)
  window.dispatchEvent(
    new CustomEvent("vc:screenchange", {
      detail: { screen: screen_id }
    })
  );
}

export function get_current_screen() {
  return current_screen;
}

