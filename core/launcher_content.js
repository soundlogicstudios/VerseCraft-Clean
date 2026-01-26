// core/launcher_content.js
// Phase 3 — Launcher content injection (blurb + cover/preview image)
// Overlay-only: does not touch navigation or hitboxes.
// Works even if catalog is empty by using explicit storyId -> asset/json paths.

let _inited = false;

function is_launcher_screen(screen) {
  return typeof screen === "string" && screen.startsWith("launcher_");
}

function story_id_from_launcher(screen) {
  return String(screen || "").replace(/^launcher_/, "");
}

// --- CANONICAL 12 story IDs ---
// IMPORTANT: These paths MUST match your repo exactly (case + hyphen/underscore).
// If any path 404s, launcher will simply show fallback content (and log warnings).
const STORY_SOURCES = {
  // Starter (example: adjust if your real path differs)
  world_of_lorecraft: {
    storyJson: "./content/starter/packs/stories/world_of_lorecraft.json",
    image: "./content/starter/packs/covers/world_of_lorecraft.webp",
  },

  // Founders pack (example: adjust if your real path differs)
  backrooms: {
    storyJson: "./content/founders/packs/stories/backrooms.json",
    image: "./content/founders/packs/covers/backrooms.webp",
  },
  timecop: {
    storyJson: "./content/founders/packs/stories/timecop.json",
    image: "./content/founders/packs/covers/timecop.webp",
  },
  relic_of_cylara: {
    storyJson: "./content/founders/packs/stories/relic_of_cylara.json",
    image: "./content/founders/packs/covers/relic_of_cylara.webp",
  },
  oregon_trail: {
    storyJson: "./content/founders/packs/stories/oregon_trail.json",
    image: "./content/founders/packs/covers/oregon_trail.webp",
  },
  wastelands: {
    storyJson: "./content/founders/packs/stories/wastelands.json",
    image: "./content/founders/packs/covers/wastelands.webp",
  },
  tale_of_icarus: {
    storyJson: "./content/founders/packs/stories/tale_of_icarus.json",
    image: "./content/founders/packs/covers/tale_of_icarus.webp",
  },
  code_blue: {
    storyJson: "./content/founders/packs/stories/code_blue.json",
    image: "./content/founders/packs/covers/code_blue.webp",
  },
  crimson_seagull: {
    storyJson: "./content/founders/packs/stories/crimson_seagull.json",
    image: "./content/founders/packs/covers/crimson_seagull.webp",
  },
  king_solomon: {
    storyJson: "./content/founders/packs/stories/king_solomon.json",
    image: "./content/founders/packs/covers/king_solomon.webp",
  },
  cosmos: {
    storyJson: "./content/founders/packs/stories/cosmos.json",
    image: "./content/founders/packs/covers/cosmos.webp",
  },
  dead_drop_protocol: {
    storyJson: "./content/founders/packs/stories/dead_drop_protocol.json",
    image: "./content/founders/packs/covers/dead_drop_protocol.webp",
  },
};

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
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn("[launcher_content] story json load failed:", url, e);
    return null;
  }
}

function get_blurb_from_story(story) {
  // tolerate common fields
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
  layer.innerHTML = "";

  // Preview image
  const img = document.createElement("img");
  img.className = "launcher-preview";
  img.alt = titleText || "Story Preview";
  img.src = imgUrl || "";
  layer.appendChild(img);

  // Blurb
  const blurb = document.createElement("div");
  blurb.className = "launcher-blurb";
  blurb.textContent = blurbText || "";
  layer.appendChild(blurb);
}

async function hydrate_launcher(screen_id) {
  const story_id = story_id_from_launcher(screen_id);
  const src = STORY_SOURCES[story_id];

  // If not mapped, we still render empty content so it doesn't look broken
  if (!src) {
    console.warn("[launcher_content] No STORY_SOURCES entry for:", story_id);
    render_launcher_content(screen_id, story_id, "", "");
    return;
  }

  const story = await safe_fetch_json(src.storyJson);
  const titleText = story?.meta?.title || story?.title || story_id;
  const blurbText = get_blurb_from_story(story);

  render_launcher_content(screen_id, titleText, blurbText, src.image);
}

function schedule(screen_id) {
  // ensure hitboxes + screen are settled
  requestAnimationFrame(() => requestAnimationFrame(() => hydrate_launcher(screen_id)));
}

export function init_launcher_content() {
  if (_inited) return;
  _inited = true;

  window.addEventListener("vc:screenchange", (e) => {
    const screen = e?.detail?.screen;
    if (!is_launcher_screen(screen)) return;
    schedule(screen);
  });

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
