// core/story_runtime.js
// VerseCraft Story Runtime (Catalog-first, fallback-safe)
//
// Mounts on screens named: story_<storyId>
// Loads story JSON via:
//   1) catalog resolver (content/catalog/catalog.json)
//   2) fallback map (legacy hardcoded paths)
// Renders into a runtime overlay layer INSIDE the active story screen.
// Does NOT touch hitbox navigation (exit/character/inventory remain hitboxes).
//
// UI goals (testbed):
// - Long narrative scrolls INSIDE panel (not whole page)
// - Always show 4 choice buttons
// - Missing options render as "Not a choice" (disabled)
// - No DOM leakage: unmounts when leaving the story screen

import { resolve_story } from "./catalog.js";

let _inited = false;

// Session caches (speed + less iOS churn)
const _story_cache = new Map(); // storyJsonUrl -> story JSON
const _state_by_story = new Map(); // storyId -> { nodeId }

// Debug: always on for now (prints source + storyId + node)
const LOG_PREFIX = "[story-runtime]";

function cache_mode() {
  const params = new URLSearchParams(location.search);
  return params.has("nocache") ? "no-store" : "default";
}

function is_story_screen(screen) {
  return typeof screen === "string" && screen.startsWith("story_");
}

function story_id_from_screen(screen) {
  return String(screen || "").replace(/^story_/, "");
}

function get_active_screen_el(screen_id) {
  return document.querySelector(`.screen.is-active[data-screen="${screen_id}"]`);
}

function ensure_runtime_layer(screen_el) {
  let layer = screen_el.querySelector(".ui-layer.story-runtime-layer");
  if (layer) return layer;

  layer = document.createElement("div");
  layer.className = "ui-layer story-runtime-layer";
  screen_el.appendChild(layer);
  return layer;
}

function ensure_runtime_css() {
  if (document.getElementById("vc_story_runtime_css")) return;

  const style = document.createElement("style");
  style.id = "vc_story_runtime_css";
  style.textContent = `
    /* Story runtime overlay lives inside the active story screen */
    .story-runtime-layer {
      position: absolute;
      inset: 0;
      z-index: 50;
      pointer-events: none; /* enable only on our buttons/scroll area */
    }

    /* Scroll container (only this scrolls) */
    .vc-story-scroll {
      position: absolute;
      left: 6%;
      top: 18%;
      width: 68%;
      height: 46%;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      pointer-events: auto;

      /* readability */
      background: rgba(0,0,0,0.35);
      border-radius: 14px;
      padding: 14px 14px 18px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.35);
    }

    /* Text formatting */
    .vc-story-title {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      font-weight: 800;
      font-size: 18px;
      margin: 0 0 10px 0;
      color: #fff;
      text-shadow: 0 2px 6px rgba(0,0,0,0.6);
    }

    .vc-story-body {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.35;
      color: #fff;
      text-shadow: 0 2px 6px rgba(0,0,0,0.65);
    }

    .vc-story-body p { margin: 0 0 12px 0; }
    .vc-story-body strong { font-weight: 800; }

    /* Choice buttons */
    .vc-choice-btn {
      position: absolute;
      left: 4.36%;
      width: 71.8%;
      height: 4.7%;

      display: flex;
      align-items: center;
      justify-content: center;

      pointer-events: auto;

      border: 0;
      border-radius: 14px;

      /* accessible contrast */
      color: #000;
      background: rgba(255,255,255,0.55);
      box-shadow: 0 8px 22px rgba(0,0,0,0.45);
      text-shadow: none;

      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      font-weight: 800;
      font-size: 16px;
      letter-spacing: 0.2px;

      padding: 0 10px;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    .vc-choice-btn .vc-choice-label {
      /* black text with subtle scrim behind it */
      color: #000;
      background: rgba(220,220,220,0.75);
      padding: 3px 10px;
      border-radius: 10px;
      max-width: 95%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .vc-choice-btn[disabled] {
      opacity: 0.55;
      filter: grayscale(0.3);
    }

    /* Default calibrated tops (your current numbers) */
    #vc_choice0 { top: 70.72%; }
    #vc_choice1 { top: 78.14%; }
    #vc_choice2 { top: 84.70%; }
    #vc_choice3 { top: 91.70%; }

    /* Prevent whole-page scroll while story runtime is active */
    body.vc-story-active {
      overflow: hidden !important;
      height: 100% !important;
      overscroll-behavior: none;
      touch-action: manipulation;
    }
  `;
  document.head.appendChild(style);
}

async function safe_fetch_json(url) {
  if (!url) return null;

  if (_story_cache.has(url)) return _story_cache.get(url);

  try {
    const res = await fetch(url, { cache: cache_mode() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _story_cache.set(url, data);
    return data;
  } catch (e) {
    console.warn(`${LOG_PREFIX} failed to load json`, url, e);
    return null;
  }
}

// Legacy fallback mapping (same idea as launcher)
const STORY_SOURCES_FALLBACK = {
  // Starter
  world_of_lorecraft: "./content/starter/packs/stories/world_of_lorecraft.json",

  // Founders
  backrooms: "./content/founders/packs/stories/backrooms.json",
  timecop: "./content/founders/packs/stories/timecop.json",
  wastelands: "./content/founders/packs/stories/wastelands.json",
  code_blue: "./content/founders/packs/stories/code_blue.json",
  crimson_seagull: "./content/founders/packs/stories/crimson_seagull.json",
  oregon_trail: "./content/founders/packs/stories/oregon_trail.json",
  relic_of_cylara: "./content/founders/packs/stories/relic_of_cylara.json",
  tale_of_icarus: "./content/founders/packs/stories/tale_of_icarus.json",
  cosmos: "./content/founders/packs/stories/cosmos.json",
  king_solomon: "./content/founders/packs/stories/king_solomon.json",
  dead_drop_protocol: "./content/founders/packs/stories/dead_drop_protocol.json"
};

async function resolve_story_json_url(story_id) {
  const resolved = await resolve_story(story_id);
  if (resolved?.storyJsonUrl) {
    console.log(`${LOG_PREFIX} source=CATALOG`, story_id, resolved.storyJsonUrl);
    return resolved.storyJsonUrl;
  }
  const legacy = STORY_SOURCES_FALLBACK[story_id] || "";
  if (legacy) console.log(`${LOG_PREFIX} source=FALLBACK`, story_id, legacy);
  else console.log(`${LOG_PREFIX} source=MISSING`, story_id);
  return legacy || null;
}

// ---------- Formatting (simple + safe) ----------
// Supported:
// - First line like: "# Title" becomes title
// - Blank lines split paragraphs
// - **bold** inside paragraphs
function escape_html(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function format_story_text(raw) {
  const text = String(raw || "");
  const lines = text.split("\n");

  let title = "";
  let startIndex = 0;

  if (lines[0]?.startsWith("# ")) {
    title = lines[0].slice(2).trim();
    startIndex = 1;
  }

  const body = lines.slice(startIndex).join("\n").trim();

  // paragraph split on blank lines
  const paras = body.split(/\n\s*\n/g).map(p => p.trim()).filter(Boolean);

  const htmlParas = paras.map(p => {
    // escape then bold
    let safe = escape_html(p);
    safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // single newlines inside paragraph -> <br>
    safe = safe.replace(/\n/g, "<br/>");
    return `<p>${safe}</p>`;
  });

  return { title, bodyHtml: htmlParas.join("") };
}

function normalize_options(options) {
  const out = [];
  const arr = Array.isArray(options) ? options : [];
  for (let i = 0; i < 4; i++) {
    const opt = arr[i];
    if (opt && typeof opt === "object") {
      out.push({
        label: String(opt.label || "").trim(),
        to: String(opt.to || "").trim()
      });
    } else {
      out.push(null);
    }
  }
  return out;
}

// ---------- Runtime Mount/Unmount ----------
function unmount(layer) {
  if (!layer) return;
  layer.innerHTML = "";
  document.body.classList.remove("vc-story-active");
}

function render_runtime(layer, story_id, story, node_id) {
  ensure_runtime_css();
  document.body.classList.add("vc-story-active");

  const scenes = story?.scenes || {};
  const node = scenes?.[node_id];

  const rawText = node?.text || "";
  const optsRaw = node?.options || [];

  const { title, bodyHtml } = format_story_text(rawText);
  const options = normalize_options(optsRaw);

  layer.innerHTML = "";

  // Scroll box
  const scroll = document.createElement("div");
  scroll.className = "vc-story-scroll";

  const h = document.createElement("div");
  h.className = "vc-story-title";
  h.textContent =
    title ||
    story?.meta?.title ||
    story?.title ||
    story_id;

  const body = document.createElement("div");
  body.className = "vc-story-body";
  body.innerHTML = bodyHtml || "";

  scroll.appendChild(h);
  scroll.appendChild(body);
  layer.appendChild(scroll);

  // Choice buttons
  const btns = [];
  for (let i = 0; i < 4; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "vc-choice-btn";
    btn.id = `vc_choice${i}`;

    const span = document.createElement("span");
    span.className = "vc-choice-label";
    span.textContent = "Not a choice";

    btn.appendChild(span);

    const opt = options[i];
    if (opt && opt.to) {
      span.textContent = opt.label || `Choice ${i + 1}`;
      btn.disabled = false;
      btn.dataset.to = opt.to;
    } else {
      btn.disabled = true;
      btn.dataset.to = "";
    }

    btns.push(btn);
    layer.appendChild(btn);
  }

  // Click handling (local; no global leakage)
  btns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.disabled) return;

      const to = String(btn.dataset.to || "").trim();
      if (!to) return;

      const state = _state_by_story.get(story_id) || { nodeId: story.start || "S01" };
      state.nodeId = to;
      _state_by_story.set(story_id, state);

      console.log(`${LOG_PREFIX} ${story_id} -> ${to}`);
      render_runtime(layer, story_id, story, to);

      // keep scroll at top on node change
      try { scroll.scrollTop = 0; } catch {}
    });
  });

  console.log(`${LOG_PREFIX} rendered`, { story_id, node_id });
}

async function mount_story(screen_id) {
  const story_id = story_id_from_screen(screen_id);
  const screen_el = get_active_screen_el(screen_id);
  if (!screen_el) return;

  const layer = ensure_runtime_layer(screen_el);

  const storyUrl = await resolve_story_json_url(story_id);
  if (!storyUrl) {
    unmount(layer);
    return;
  }

  const story = await safe_fetch_json(storyUrl);
  if (!story) {
    unmount(layer);
    return;
  }

  // isolate state per storyId
  let state = _state_by_story.get(story_id);
  if (!state) {
    state = { nodeId: story.start || "S01" };
    _state_by_story.set(story_id, state);
  }

  render_runtime(layer, story_id, story, state.nodeId);
}

export function init_story_runtime() {
  if (_inited) return;
  _inited = true;

  // Initial CSS injection (once)
  ensure_runtime_css();

  window.addEventListener("vc:screenchange", (e) => {
    const screen = e?.detail?.screen;

    // Unmount from any previously active story screen(s)
    document.querySelectorAll(".ui-layer.story-runtime-layer").forEach((layer) => {
      const parent = layer.closest(".screen");
      const sid = parent?.dataset?.screen || "";
      if (!is_story_screen(sid) || sid !== screen) {
        unmount(layer);
      }
    });

    if (is_story_screen(screen)) {
      mount_story(screen);
    }
  });

  console.log(`${LOG_PREFIX} initialized`);
}
