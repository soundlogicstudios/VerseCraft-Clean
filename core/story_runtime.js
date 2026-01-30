// core/story_runtime.js
// VerseCraft Clean — Story Runtime (Catalog-first)
// FULL FILE REPLACEMENT
//
// Supports multiple story JSON dialects:
//
// A) Canon (new):
//   start: "S01"
//   scenes: { "S01": { text:"...", options:[{label,to}...] } }
//
// B) Legacy:
//   start: "S01"
//   sections: [ { id:"S01", text:"...", choices:[{label,to/next/...}] } ]
//
// C) Alternate legacy:
//   nodes: { "S01": { text:"...", choices/options:[...] } }
//
// Runtime rules:
// - Reuse existing choice pills (#choice0–#choice3) if present
// - If missing, CREATE them once (so pills never disappear again)
// - Disable missing options: show "Not a choice" and do NOT allow forward navigation
// - Lock page scroll; only narrative container scrolls (iOS-friendly)
// - No story title injection into the narrative panel
// - Cache loaded story JSON to reduce repeated fetch slowness

import { resolve_story } from "./catalog.js";

let _inited = false;

const STORY_CACHE = new Map();      // url -> normalized story
const STATE_BY_STORY = new Map();   // storyId -> { nodeId }
const BOUND_PILLS = new WeakSet();  // prevent rebinding listeners
const BOUND_SCREENS = new WeakSet();// prevent rebinding screen listener

const LOG_PREFIX = "[story-runtime]";

// Your calibrated defaults (Option B) — used only if pills are missing and we must create them
const DEFAULT_PILL_GEOM = [
  { id: "choice0", left: 4.36, top: 70.72, width: 71.8, height: 4.7 },
  { id: "choice1", left: 4.63, top: 78.14, width: 71.8, height: 4.7 },
  { id: "choice2", left: 4.37, top: 84.70, width: 71.8, height: 4.7 },
  { id: "choice3", left: 4.36, top: 91.70, width: 71.8, height: 4.7 }
];

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
    .story-runtime-layer {
      position: absolute;
      inset: 0;
      z-index: 40;
      pointer-events: none;
    }

    /* Lock page scroll (only narrative scrolls) */
    body.vc-story-scrolllock {
      overflow: hidden !important;
      height: 100% !important;
      overscroll-behavior: none;
      touch-action: manipulation;
    }

    /* Narrative scroller (safe default; tune later) */
    .vc-story-scroll {
      position: absolute;
      left: 6%;
      top: 23%;
      width: 68%;
      height: 44%;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      pointer-events: auto;

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

    /* Fallback-created pills (only used when #choice0–3 are missing) */
    .vc-choice-pill {
      position: absolute;
      z-index: 60;
      border: 0;
      border-radius: 14px;
      background: rgba(220,220,220,0.72);
      color: #000;
      font: 600 16px/1.1 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      text-shadow: none;
      padding: 0 14px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      pointer-events: auto;
      box-shadow: 0 8px 18px rgba(0,0,0,0.35);
    }

    .vc-choice-pill[aria-disabled="true"] {
      opacity: 0.65;
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

  return html || "<p></p>";
}

// -------------------------
// Normalization (multi-schema)
// -------------------------

function pick_text(node) {
  return (
    node?.text ??
    node?.body ??
    node?.narrative ??
    node?.content ??
    ""
  );
}

function normalize_choice(ch) {
  if (typeof ch === "string") {
    const label = ch.trim();
    return label ? { label, to: "" } : null;
  }
  if (!ch || typeof ch !== "object") return null;

  const label = String(
    ch.label ??
    ch.text ??
    ch.title ??
    ch.name ??
    ""
  ).trim();

  const to = String(
    ch.to ??
    ch.next ??
    ch.go ??
    ch.target ??
    ch.id ??
    ""
  ).trim();

  if (!label && !to) return null;
  return { label: label || "Continue", to };
}

function normalize_node(id, node) {
  const text = pick_text(node);

  const rawChoices =
    node?.options ??
    node?.choices ??
    node?.choice ??
    node?.links ??
    [];

  const arr = Array.isArray(rawChoices) ? rawChoices : [];
  const options = arr.map(normalize_choice).filter(Boolean);

  return { id, text, options };
}

function normalize_story(raw) {
  if (!raw || typeof raw !== "object") return null;

  const start =
    String(raw.start ?? raw.entry ?? raw.begin ?? raw.root ?? "S01").trim() || "S01";

  // Canon: scenes object
  if (raw.scenes && typeof raw.scenes === "object") {
    const scenes = {};
    for (const [id, node] of Object.entries(raw.scenes)) {
      scenes[id] = normalize_node(id, node);
    }
    return { ...raw, start, scenes };
  }

  // Legacy: nodes object
  if (raw.nodes && typeof raw.nodes === "object") {
    const scenes = {};
    for (const [id, node] of Object.entries(raw.nodes)) {
      scenes[id] = normalize_node(id, node);
    }
    return { ...raw, start, scenes };
  }

  // Legacy: sections array
  if (Array.isArray(raw.sections)) {
    const scenes = {};
    for (const sec of raw.sections) {
      const id = String(sec?.id ?? sec?.key ?? sec?.name ?? "").trim();
      if (!id) continue;
      scenes[id] = normalize_node(id, sec);
    }
    return { ...raw, start, scenes };
  }

  return { ...raw, start, scenes: {} };
}

async function safe_fetch_story(url) {
  if (!url) return null;
  if (STORY_CACHE.has(url)) return STORY_CACHE.get(url);

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const normalized = normalize_story(raw);
    STORY_CACHE.set(url, normalized);
    return normalized;
  } catch (e) {
    console.warn(`${LOG_PREFIX} failed to load story json`, url, e);
    return null;
  }
}

async function resolve_story_json_url(story_id) {
  try {
    const resolved = await resolve_story(story_id);
    if (resolved && resolved.storyJsonUrl) return resolved.storyJsonUrl;
  } catch (e) {
    console.warn(`${LOG_PREFIX} catalog resolve failed`, story_id, e);
  }
  return null;
}

// -------------------------
// Choice pills: reuse or create
// -------------------------

function find_choice_pills(screen_el) {
  const ids = ["choice0", "choice1", "choice2", "choice3"];
  return ids.map((id) => screen_el.querySelector(`#${id}`)).filter(Boolean);
}

function create_choice_pills_if_missing(screen_el) {
  let pills = find_choice_pills(screen_el);
  if (pills.length === 4) return pills;

  // Create pills once per screen
  if (screen_el.dataset.vcChoicePillsCreated === "1") {
    // try again (maybe DOM moved)
    pills = find_choice_pills(screen_el);
    return pills;
  }

  screen_el.dataset.vcChoicePillsCreated = "1";

  DEFAULT_PILL_GEOM.forEach((g) => {
    // If someone later adds real pills, do not double-create
    if (document.getElementById(g.id)) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = g.id;
    btn.className = "vc-choice-pill";

    btn.style.left = `${g.left}%`;
    btn.style.top = `${g.top}%`;
    btn.style.width = `${g.width}%`;
    btn.style.height = `${g.height}%`;

    btn.textContent = "Not a choice";
    btn.dataset.vcTo = "";
    btn.setAttribute("aria-disabled", "true");

    // Append directly to the screen so it layers correctly over the art
    screen_el.appendChild(btn);
  });

  pills = find_choice_pills(screen_el);
  console.log(`${LOG_PREFIX} created fallback pills:`, pills.map(p => p.id));
  return pills;
}

function set_pill_label(pill, label) {
  pill.textContent = label;
}

function set_pill_disabled(pill, disabled) {
  try { pill.disabled = !!disabled; } catch (_) {}
  pill.setAttribute("aria-disabled", disabled ? "true" : "false");

  if (disabled) {
    pill.dataset.vcTo = "";
    pill.style.opacity = "0.65";
  } else {
    pill.style.opacity = "1";
  }
}

function bind_pill_click(pill, get_to) {
  if (BOUND_PILLS.has(pill)) return;

  const handler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const to = String(get_to() || "").trim();
    if (!to) return;
    pill.dispatchEvent(new CustomEvent("vc:storychoice", { bubbles: true, detail: { to } }));
  };

  pill.addEventListener("click", handler, true);
  pill.addEventListener("pointerup", handler, true);

  BOUND_PILLS.add(pill);
}

function unmount(layer) {
  if (!layer) return;
  layer.innerHTML = "";
  document.body.classList.remove("vc-story-scrolllock");
}

function normalize_options_for_render(options) {
  const out = [];
  const arr = Array.isArray(options) ? options : [];
  for (let i = 0; i < 4; i++) out.push(arr[i] || null);
  return out;
}

function render(screen_el, layer, story_id, story, node_id) {
  ensure_runtime_css();
  document.body.classList.add("vc-story-scrolllock");

  const node = story?.scenes?.[node_id] || null;
  const text = node?.text || "";
  const options = normalize_options_for_render(node?.options);

  // Narrative box
  layer.innerHTML = "";
  const scroll = document.createElement("div");
  scroll.className = "vc-story-scroll";

  const body = document.createElement("div");
  body.className = "vc-story-body";
  body.innerHTML = format_story_text(text);

  scroll.appendChild(body);
  layer.appendChild(scroll);

  // Pills: reuse or create
  const pills = create_choice_pills_if_missing(screen_el);

  for (let i = 0; i < 4; i++) {
    const pill = pills[i];
    if (!pill) continue;

    const opt = options[i];
    const label = opt?.label ? String(opt.label).trim() : "";
    const to = opt?.to ? String(opt.to).trim() : "";

    if (to) {
      set_pill_label(pill, label || `Choice ${i + 1}`);
      pill.dataset.vcTo = to;
      set_pill_disabled(pill, false);
    } else {
      set_pill_label(pill, "Not a choice");
      pill.dataset.vcTo = "";
      set_pill_disabled(pill, true);
    }

    bind_pill_click(pill, () => pill.dataset.vcTo || "");
  }

  // Bind delegated story choice handler once per screen element
  if (!BOUND_SCREENS.has(screen_el)) {
    screen_el.addEventListener("vc:storychoice", (e) => {
      const to = String(e?.detail?.to || "").trim();
      if (!to) return;

      const state = STATE_BY_STORY.get(story_id) || { nodeId: story.start || "S01" };
      state.nodeId = to;
      STATE_BY_STORY.set(story_id, state);

      render(screen_el, layer, story_id, story, to);

      try { scroll.scrollTop = 0; } catch (_) {}
    }, true);

    BOUND_SCREENS.add(screen_el);
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

  const story = await safe_fetch_story(storyUrl);
  if (!story || !story.scenes || Object.keys(story.scenes).length === 0) {
    console.warn(`${LOG_PREFIX} story missing/invalid scenes after normalize`, { story_id, storyUrl });
    unmount(layer);
    return;
  }

  let state = STATE_BY_STORY.get(story_id);
  if (!state) {
    state = { nodeId: story.start || "S01" };
    STATE_BY_STORY.set(story_id, state);
  }

  // If start node missing, fall back to first scene key
  if (!story.scenes[state.nodeId]) {
    const firstKey = Object.keys(story.scenes)[0];
    state.nodeId = firstKey || (story.start || "S01");
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
