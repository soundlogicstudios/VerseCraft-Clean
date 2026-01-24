// core/screen-manager.js
// phase 1: minimal modular screen manager (explicit registry path)

let registry = null;
let current_screen = null;

const loaded_css = new Set();
const REGISTRY_PATH = "./sec/screen_registry.json";

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

  const screen_cfg = registry.screens?.[screen_id];
  if (!screen_cfg) {
    console.warn(`[screen-manager] unknown screen: ${screen_id}`);
    return;
  }

  hide_all_screens();
  load_css_once(screen_cfg.css);

  current_screen = screen_id;
  show_screen(screen_id);

  try {
    history.replaceState(null, "", `#${screen_id}`);
  } catch (_) {}

  try {
    await apply_hitboxes(screen_cfg.hitboxes, screen_id);
  } catch (err) {
    console.error(`[screen-manager] hitbox error on ${screen_id}`, err);
  }

  window.dispatchEvent(
    new CustomEvent("vc:screenchange", { detail: { screen: screen_id } })
  );
}

export function get_current_screen() {
  return current_screen;
}

