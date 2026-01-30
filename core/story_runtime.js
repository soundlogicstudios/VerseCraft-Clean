// core/story_runtime.js
// VerseCraft Clean — Story Runtime (Catalog-first, UI-shell pill reuse)
// FULL FILE REPLACEMENT
//
// Goals (CANON for Clean repo integration):
// - Reuse existing UI shell choice pills (#choice0–#choice3) if present (NO duplicates)
// - Populate pill labels + bind navigation from story JSON (scenes/start/options)
// - Disable missing options: show "Not a choice" and do NOT allow forward navigation
// - Lock page scroll; only narrative container scrolls (iOS-friendly)
// - No story title injection into the narrative panel (title belongs in art/launcher)
// - Safe caching to avoid repeated slow fetches
//
// Expected story JSON (engine-compatible):
// {
//   "meta": {...},
//   "start": "S01",
//   "scenes": {
//     "S01": { "text": "...", "options":[{"label":"Short","to":"S02"}] }
//   }
// }
//
// Dependencies:
// - catalog resolver: ./core/catalog.js exports resolve_story(storyId) -> { storyJsonUrl, ... } or null
// - screen manager emits: window.dispatchEvent(new CustomEvent("vc:screenchange",{detail:{screen}}))
//
// Note: This runtime does NOT use .hitbox navigation for choices; it binds directly to the pills.

import { resolve_story } from "./catalog.js";

let _inited = false;

const STORY_CACHE = new Map(); // url -> story json
const STATE_BY_STORY = new Map(); // storyId -> { nodeId }
const BOUND_PILLS = new WeakSet(); // prevent rebinding listeners

const LOG_PREFIX = "[story-runtime]";

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
    /* Runtime layer sits above art but below hitboxes if your hitbox layer is higher. */
    .story-runtime-layer {
      position: absolute;
      inset: 0;
      z-index: 40;
      pointer-events: none; /* runtime enables pointer events only on interactive children */
    }

    /* Lock page scroll (only narrative scrolls) */
    body.vc-story-scrolllock {
      overflow: hidden !important;
      height: 100% !important;
      overscroll-behavior: none;
      touch-action: manipulation;
    }

    /* Narrative scroller (you can tune these values later) */
    .vc-story-scroll {
      position: absolute;
      left: 6%;
      top: 23%;
      width: 68%;
      height: 44%;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      pointer-events: auto;

      /* readability */
      background: rgba(0,0,0,0.30);
      border-radius: 14px;
      padding: 14px 14px 18px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.35);
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

    /* Optional: if your pills are plain elements, this improves readability without changing layout. */
    .vc-choice-readable {
      color: #000 !important;
      background: rgba(220,220,220,0.72) !important;
      border-radius: 10px;
      padding: 3px 10px;
      display: inline-block;
      max-width: 95%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);
}

function escape_html(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function format_story_text(raw) {
  // Simple, safe formatting:
  // - Paragraphs separated by blank lines
  // - **bold** supported
  // - Single newlines preserved as <br/>
  const text = String(raw || "");
  const paras = text
    .trim()
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const html = paras
    .map((p) => {
      let safe = escape_html(p);
      safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      safe = safe.replace(/\n/g, "<br/>");
      return `<p>${safe}</p>`;
    })
    .join("");

  return html;
}

async function safe_fetch_json(url) {
  if (!url) return null;
  if (STORY_CACHE.has(url)) return STORY_CACHE.get(url);

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    STORY_CACHE.set(url, data);
    return data;
  } catch (e) {
    console.warn(`${LOG_PREFIX} failed to load story json`, url, e);
    return null;
  }
}

async function resolve_story_json_url(story_id) {
  // Catalog-first resolver
  try {
    const resolved = await resolve_story(story_id);
    if (resolved && resolved.storyJsonUrl) return resolved.storyJsonUrl;
  } catch (e) {
    console.warn(`${LOG_PREFIX} catalog resolve failed`, story_id, e);
  }
  return null;
}

function find_choice_pills(screen_el) {
  // Canon IDs for UI shell pills:
  const ids = ["choice0", "choice1", "choice2", "choice3"];
  const pills = ids
    .map((id) => screen_el.querySelector(`#${id}`))
    .filter(Boolean);

  return pills;
}

function set_pill_label(pill, label) {
  // If pill has an inner label span, prefer it; otherwise set pill text.
  const labelEl =
    pill.querySelector?.(".vc-choice-label") ||
    pill.querySelector?.(".choice-label") ||
    pill.querySelector?.("[data-choice-label]") ||
    null;

  if (labelEl) {
    labelEl.textContent = label;
    // readability scrim on the label element only
    labelEl.classList.add("vc-choice-readable");
  } else {
    pill.textContent = label;
    // if this is a plain element, wrap readability via class
    pill.classList.add("vc-choice-readable");
  }
}

function set_pill_disabled(pill, disabled) {
  // Works for <button>, and also for other elements (we set aria/state).
  try {
    pill.disabled = !!disabled;
  } catch (_) {}

  pill.setAttribute("aria-disabled", disabled ? "true" : "false");

  if (disabled) {
    pill.dataset.vcTo = "";
    pill.style.pointerEvents = "auto"; // still allow taps but do nothing (consistent feel)
    pill.style.opacity = "0.65";
  } else {
    pill.style.pointerEvents = "auto";
    pill.style.opacity = "1";
  }
}

function bind_pill_click(pill, get_to) {
  if (BOUND_PILLS.has(pill)) return;

  // make non-buttons accessible/clickable
  if (pill.tagName !== "BUTTON") {
    pill.setAttribute("role", "button");
    pill.setAttribute("tabindex", "0");
  }

  const handler = (e) => {
    // Prevent UI shell hitboxes/overlays from swallowing taps
    e.preventDefault();
    e.stopPropagation();

    const to = String(get_to() || "").trim();
    if (!to) return;
    pill.dispatchEvent(
      new CustomEvent("vc:storychoice", { bubbles: true, detail: { to } })
    );
  };

  pill.addEventListener("click", handler, true);
  pill.addEventListener(
    "pointerup",
    (e) => {
      // iOS sometimes behaves better with pointerup capture
      handler(e);
    },
    true
  );

  // keyboard activation for non-buttons
  pill.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter" || e.key === " ") {
        handler(e);
      }
    },
    true
  );

  BOUND_PILLS.add(pill);
}

function unmount(layer) {
  if (!layer) return;
  layer.innerHTML = "";
  document.body.classList.remove("vc-story-scrolllock");
}

function normalize_options(options) {
  const arr = Array.isArray(options) ? options : [];
  const out = [];
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

function render(screen_el, layer, story_id, story, node_id) {
  ensure_runtime_css();
  document.body.classList.add("vc-story-scrolllock");

  const scenes = story?.scenes || {};
  const node = scenes?.[node_id] || null;

  const text = node?.text || "";
  const options = normalize_options(node?.options);

  // Render narrative scroll box (runtime owns this)
  layer.innerHTML = "";

  const scroll = document.createElement("div");
  scroll.className = "vc-story-scroll";

  const body = document.createElement("div");
  body.className = "vc-story-body";
  body.innerHTML = format_story_text(text);

  scroll.appendChild(body);
  layer.appendChild(scroll);

  // Bind + populate UI shell pills (runtime reuses these)
  const pills = find_choice_pills(screen_el);

  if (pills.length !== 4) {
    console.warn(
      `${LOG_PREFIX} expected 4 pills (#choice0–#choice3) but found ${pills.length}`
    );
  }

  for (let i = 0; i < 4; i++) {
    const pill = pills[i];
    if (!pill) continue;

    const opt = options[i];

    if (opt && opt.to) {
      const label = opt.label || `Choice ${i + 1}`;
      set_pill_label(pill, label);
      pill.dataset.vcTo = opt.to;
      set_pill_disabled(pill, false);
    } else {
      set_pill_label(pill, "Not a choice");
      pill.dataset.vcTo = "";
      set_pill_disabled(pill, true);
    }

    bind_pill_click(pill, () => pill.dataset.vcTo || "");
  }

  // Choice routing: listen once per screen render (delegated via custom event)
  // (We attach to screen element so it auto-scopes per story screen.)
  if (!screen_el.dataset.vcStoryBound) {
    screen_el.dataset.vcStoryBound = "1";

    screen_el.addEventListener(
      "vc:storychoice",
      (e) => {
        const to = String(e?.detail?.to || "").trim();
        if (!to) return;

        const state = STATE_BY_STORY.get(story_id) || { nodeId: story.start || "S01" };
        state.nodeId = to;
        STATE_BY_STORY.set(story_id, state);

        render(screen_el, layer, story_id, story, to);

        try {
          scroll.scrollTop = 0;
        } catch (_) {}
      },
      true
    );
  }

  console.log(`${LOG_PREFIX} rendered`, { story_id, node_id });
}

async function mount_story(screen_id) {
  const story_id = story_id_from_screen(screen_id);
  const screen_el = get_active_screen_el(screen_id);
  if (!screen_el) return;

  const layer = ensure_runtime_layer(screen_el);

  const storyUrl = await resolve_story_json_url(story_id);
  if (!storyUrl) {
    console.warn(`${LOG_PREFIX} no storyJsonUrl for`, story_id);
    unmount(layer);
    return;
  }

  const story = await safe_fetch_json(storyUrl);
  if (!story || !story.scenes) {
    console.warn(`${LOG_PREFIX} story missing/invalid scenes`, { story_id, storyUrl });
    unmount(layer);
    return;
  }

  let state = STATE_BY_STORY.get(story_id);
  if (!state) {
    state = { nodeId: story.start || "S01" };
    STATE_BY_STORY.set(story_id, state);
  }

  render(screen_el, layer, story_id, story, state.nodeId);
}

export function init_story_runtime() {
  if (_inited) return;
  _inited = true;

  ensure_runtime_css();

  window.addEventListener("vc:screenchange", (e) => {
    const screen = e?.detail?.screen;

    // Unmount runtime layers from inactive story screens
    document.querySelectorAll(".ui-layer.story-runtime-layer").forEach((layer) => {
      const parent = layer.closest(".screen");
      const sid = parent?.dataset?.screen || "";
      if (!is_story_screen(sid) || sid !== screen) {
        unmount(layer);
      }
    });

    if (is_story_screen(screen)) {
      mount_story(screen);
    } else {
      document.body.classList.remove("vc-story-scrolllock");
    }
  });

  console.log(`${LOG_PREFIX} initialized`);
}
