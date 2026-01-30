// src/core/launcher_content.js
// Phase 3 — Launcher content injection (blurb + cover/preview image)
//
// UPDATED (Performance + Safety):
// - Primary source: content/catalog/catalog.json (via core/catalog.js)
// - Fallback: legacy STORY_SOURCES mapping (prevents breaking live site)
// - Uses normal caching by default; add ?nocache=1 to force no-store
// - Memoizes story JSON per storyId to avoid repeat fetches

import { resolve_story } from "./catalog.js";

let _inited = false;

const _story_cache = new Map(); // storyJsonUrl -> story object (session cache)

function cache_mode() {
  const params = new URLSearchParams(location.search);
  return params.has("nocache") ? "no-store" : "default";
}

function is_launcher_screen(screen) {
  return typeof screen === "string" && screen.startsWith("launcher_");
}

function story_id_from_launcher(screen) {
  return String(screen || "").replace(/^launcher_/, "");
}

function get_active_screen_el(screen_id) {
  return document.querySelector(`.screen.is-active[data-screen="${screen_id}"]`);
}

function ensure_ui_layer(screen_el) {
  let layer = screen_el.querySelector(".ui-layer.launcher-content-layer");
  if (layer) return layer;

  layer = document.createElement("div");
  layer.className = "ui-layer launcher-content-layer";
  screen_el.appendChild(layer);
  return layer;
}

async function safe_fetch_json(url) {
  if (!url) return null;

  // in-memory cache first
  if (_story_cache.has(url)) return _story_cache.get(url);

  try {
    const res = await fetch(url, { cache: cache_mode() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _story_cache.set(url, data);
    return data;
  } catch {
    return null;
  }
}

function get_blurb_from_story(story) {
  return (
    story?.blurb ||
    story?.meta?.blurb ||
    story?.meta?.description ||
    story?.description ||
    ""
  );
}

function render_launcher_content(screen_id, titleText, blurbText, imgUrl) {
  const screen_el = get_active_screen_el(screen_id);
  if (!screen_el) return;

  const layer = ensure_ui_layer(screen_el);

  // Reuse nodes if they exist (avoids image re-decoding churn)
  let img = layer.querySelector("img.launcher-preview");
  let blurb = layer.querySelector("div.launcher-blurb");

  if (!img) {
    img = document.createElement("img");
    img.className = "launcher-preview";
    img.alt = titleText || "Story Preview";
    layer.appendChild(img);
  }

  if (!blurb) {
    blurb = document.createElement("div");
    blurb.className = "launcher-blurb";
    layer.appendChild(blurb);
  }

  img.alt = titleText || "Story Preview";
  if (imgUrl && img.src !== imgUrl) img.src = imgUrl;

  blurb.textContent = blurbText || "";
}

// ------------------------------------------------------------
// Legacy fallback mapping (kept for safety / live site)
// ------------------------------------------------------------
const STORY_SOURCES = {
  // Starter
  world_of_lorecraft: {
    storyJson: "./content/starter/packs/stories/world_of_lorecraft.json",
    image: "./content/starter/packs/covers/world-of-lorecraft.webp"
  },

  // Founders
  backrooms: {
    storyJson: "./content/founders/packs/stories/backrooms.json",
    image: "./content/founders/packs/covers/backrooms.webp"
  },
  timecop: {
    storyJson: "./content/founders/packs/stories/timecop.json",
    image: "./content/founders/packs/covers/timecop.webp"
  },
  wastelands: {
    storyJson: "./content/founders/packs/stories/wastelands.json",
    image: "./content/founders/packs/covers/wastelands.webp"
  },
  code_blue: {
    storyJson: "./content/founders/packs/stories/code_blue.json",
    image: "./content/founders/packs/covers/code-blue.webp"
  },
  crimson_seagull: {
    storyJson: "./content/founders/packs/stories/crimson_seagull.json",
    image: "./content/founders/packs/covers/crimson-seagull.webp"
  },
  oregon_trail: {
    storyJson: "./content/founders/packs/stories/oregon_trail.json",
    image: "./content/founders/packs/covers/oregon-trail.webp"
  },
  relic_of_cylara: {
    storyJson: "./content/founders/packs/stories/relic_of_cylara.json",
    image: "./content/founders/packs/covers/relic-of-cylara.webp"
  },
  tale_of_icarus: {
    storyJson: "./content/founders/packs/stories/tale_of_icarus.json",
    image: "./content/founders/packs/covers/tale-of-icarus.webp"
  },
  cosmos: {
    storyJson: "./content/founders/packs/stories/cosmos.json",
    image: "./content/founders/packs/covers/cosmos.webp"
  },
  king_solomon: {
    storyJson: "./content/founders/packs/stories/king_solomon.json",
    image: "./content/founders/packs/covers/king-solomon.webp"
  },
  dead_drop_protocol: {
    storyJson: "./content/founders/packs/stories/dead_drop_protocol.json",
    image: "./content/founders/packs/covers/dead-drop-protocol.webp"
  }
};

async function get_sources_for_story(story_id) {
  // 1) Catalog-first
  const resolved = await resolve_story(story_id);
  if (resolved?.storyJsonUrl) {
    return {
      storyJson: resolved.storyJsonUrl,
      image: resolved.coverUrl || ""
    };
  }

  // 2) Legacy fallback
  return STORY_SOURCES[story_id] || null;
}

async function hydrate_launcher(screen_id) {
  const story_id = story_id_from_launcher(screen_id);
  const src = await get_sources_for_story(story_id);
  if (!src) return;

  const story = await safe_fetch_json(src.storyJson);

  const titleText =
    story?.meta?.title ||
    story?.title ||
    story_id;

  const blurbText = get_blurb_from_story(story);

  render_launcher_content(screen_id, titleText, blurbText, src.image);
}

function schedule(screen_id) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => hydrate_launcher(screen_id))
  );
}

export function init_launcher_content() {
  if (_inited) return;
  _inited = true;

  window.addEventListener("vc:screenchange", (e) => {
    const screen = e?.detail?.screen;
    if (is_launcher_screen(screen)) schedule(screen);
  });

  // Keep these, but they can be chatty on iOS; schedule is cheap now.
  window.addEventListener("resize", () => {
    const active = document.querySelector(".screen.is-active");
    const screen = active?.dataset?.screen;
    if (is_launcher_screen(screen)) schedule(screen);
  });

  window.addEventListener("orientationchange", () => {
    const active = document.querySelector(".screen.is-active");
    const screen = active?.dataset?.screen;
    if (is_launcher_screen(screen)) schedule(screen);
  });
}
