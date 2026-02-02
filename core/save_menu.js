// core/save_menu.js
// Save Menu overlay — temporary "library-like rows" using existing slot hitboxes
//
// REQUIREMENTS MET:
// - Does NOT change hitbox positioning/geometry
// - Does NOT change launcher labels or launcher hitboxes
// - Aligns save rows to the existing hitboxes (slot_0/1/2) so it "eyeballs" correctly
// - Pulls cover images via catalog (launcher-like behavior)
// - Shows simple save metadata text (storyId + scene + timestamp if available)
// - Safe if saves are missing: shows "Empty Slot" and leaves slot routing to menu
//
// NOTE:
// This is VISUAL hydration + safe slot binding only.
// It does NOT invent new save logic.
// It reads best-effort from localStorage if present.

import { preload_catalog, resolve_story } from "./catalog.js";

let _inited = false;

const SCREEN_ID = "saves";
const SLOT_IDS = ["slot_0", "slot_1", "slot_2"];
const EMPTY_TARGET = "menu";

// Best-effort discovery keys (non-breaking)
const CANDIDATE_KEYS = [
  "vc_state_by_story",
  "vc_saves",
  "versecraft_saves",
  "versecraft_state_by_story"
];

function cache_mode() {
  const params = new URLSearchParams(location.search);
  return params.has("nocache") ? "no-store" : "default";
}

function get_active_screen_el(screen_id) {
  return document.querySelector(`.screen.is-active[data-screen="${screen_id}"]`);
}

function ensure_ui_layer(screen_el) {
  let layer = screen_el.querySelector(".ui-layer.save-menu-layer");
  if (layer) return layer;

  layer = document.createElement("div");
  layer.className = "ui-layer save-menu-layer";
  layer.style.position = "absolute";
  layer.style.inset = "0";
  layer.style.pointerEvents = "none";
  layer.style.zIndex = "45";
  screen_el.appendChild(layer);
  return layer;
}

function ensure_css() {
  if (document.getElementById("vc_save_menu_css")) return;

  const style = document.createElement("style");
  style.id = "vc_save_menu_css";
  style.textContent = `
    .save-menu-layer { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }

    .vc-save-row {
      position: absolute;
      display: flex;
      align-items: center;
      gap: 12px;
      pointer-events: none; /* do NOT intercept hitbox taps */
      z-index: 1;
    }

    .vc-save-cover {
      height: 100%;
      aspect-ratio: 3 / 4;
      border-radius: 12px;
      object-fit: cover;
      box-shadow: 0 10px 18px rgba(0,0,0,0.35);
      background: rgba(0,0,0,0.22);
      flex: 0 0 auto;
    }

    .vc-save-text {
      flex: 1 1 auto;
      min-width: 0;
      color: rgba(255,255,255,0.98);
      text-shadow: 0 2px 6px rgba(0,0,0,0.85);
    }

    .vc-save-title {
      font-weight: 950;
      letter-spacing: 0.02em;
      font-size: clamp(16px, 2.4vh, 26px);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.05;
    }

    .vc-save-detail {
      margin-top: 6px;
      font-weight: 650;
      opacity: 0.92;
      font-size: clamp(12px, 1.8vh, 18px);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* light scrim behind text for readability on bright art */
    .vc-save-scrim {
      position: absolute;
      inset: 0;
      border-radius: 14px;
      background: rgba(0,0,0,0.32);
      box-shadow: 0 10px 18px rgba(0,0,0,0.25);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      z-index: 0;
      pointer-events: none;
    }

    .vc-save-row > * { position: relative; z-index: 1; }
  `;
  document.head.appendChild(style);
}

function safe_json_parse(s) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return null;
  }
}

function normalize_save_record(storyId, obj) {
  const sid = String(storyId || obj?.storyId || obj?.id || "").trim();
  if (!sid) return null;

  const nodeId = String(obj?.nodeId ?? obj?.node ?? obj?.scene ?? obj?.at ?? obj?.current ?? "").trim();
  const ts = Number(obj?.ts ?? obj?.time ?? obj?.timestamp ?? obj?.updatedAt ?? obj?.lastPlayed) || 0;

  return { storyId: sid, nodeId, ts };
}

function collect_saves_from_storage() {
  const out = [];

  // Map-style keys
  for (const k of CANDIDATE_KEYS) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;

    const parsed = safe_json_parse(raw);
    if (!parsed || typeof parsed !== "object") continue;

    for (const [storyId, obj] of Object.entries(parsed)) {
      const rec = normalize_save_record(storyId, obj);
      if (rec) out.push(rec);
    }
  }

  // Per-story keys (best-effort)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    const m =
      key.match(/^vc_story_state_(.+)$/) ||
      key.match(/^versecraft_story_state_(.+)$/) ||
      key.match(/^vc_save_(.+)$/);

    if (!m) continue;

    const storyId = String(m[1] || "").trim();
    const parsed = safe_json_parse(localStorage.getItem(key) || "");
    if (!parsed) continue;

    const rec = normalize_save_record(storyId, parsed);
    if (rec) out.push(rec);
  }

  // De-dupe by storyId (keep newest ts)
  const best = new Map();
  for (const r of out) {
    const prev = best.get(r.storyId);
    if (!prev) best.set(r.storyId, r);
    else {
      const a = Number(prev.ts || 0);
      const b = Number(r.ts || 0);
      if (b >= a) best.set(r.storyId, r);
    }
  }

  const list = Array.from(best.values());
  list.sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
  return list;
}

function find_hitbox(screen_el, id) {
  const boxes = Array.from(screen_el.querySelectorAll(".hitbox-layer .hitbox"));
  const want = String(id || "").toLowerCase();
  return boxes.find((b) => String(b.getAttribute("data-hitbox-id") || "").toLowerCase() === want) || null;
}

function rect_to_pct(screen_rect, rect) {
  const left = ((rect.left - screen_rect.left) / screen_rect.width) * 100;
  const top = ((rect.top - screen_rect.top) / screen_rect.height) * 100;
  const width = (rect.width / screen_rect.width) * 100;
  const height = (rect.height / screen_rect.height) * 100;
  return { left, top, width, height };
}

function fmt_time(ts) {
  const n = Number(ts || 0);
  if (!n) return "";
  try {
    return new Date(n).toLocaleString();
  } catch (_) {
    return "";
  }
}

async function cover_for_story(storyId) {
  const resolved = await resolve_story(storyId);
  return resolved?.coverUrl || "";
}

// Only change binding target, never geometry
function bind_slot_target(screen_el, slotId, target) {
  const hb = find_hitbox(screen_el, slotId);
  if (!hb) return;
  hb.dataset.action = "go";
  hb.dataset.arg = target || EMPTY_TARGET;
}

function render_row(layer, pct, slotIndex, slotData) {
  const row = document.createElement("div");
  row.className = "vc-save-row";
  row.dataset.slot = String(slotIndex);

  row.style.left = `${pct.left}%`;
  row.style.top = `${pct.top}%`;
  row.style.width = `${pct.width}%`;
  row.style.height = `${pct.height}%`;

  // Scrim behind the whole row (library-like separation)
  const scrim = document.createElement("div");
  scrim.className = "vc-save-scrim";
  row.appendChild(scrim);

  const img = document.createElement("img");
  img.className = "vc-save-cover";
  img.alt = slotData?.storyId ? `${slotData.storyId} cover` : "Empty slot";

  const textWrap = document.createElement("div");
  textWrap.className = "vc-save-text";

  const title = document.createElement("div");
  title.className = "vc-save-title";

  const detail = document.createElement("div");
  detail.className = "vc-save-detail";

  if (slotData?.storyId) {
    if (slotData.coverUrl) img.src = slotData.coverUrl;

    // keep it simple for now; we can upgrade to real story titles later if desired
    title.textContent = slotData.storyId;

    const parts = [];
    if (slotData.nodeId) parts.push(`Scene: ${slotData.nodeId}`);
    const t = fmt_time(slotData.ts);
    if (t) parts.push(`Last: ${t}`);
    detail.textContent = parts.join("  •  ") || "In progress";
  } else {
    // Empty slot visuals
    title.textContent = "Empty Slot";
    detail.textContent = "No save found";
  }

  textWrap.appendChild(title);
  textWrap.appendChild(detail);

  row.appendChild(img);
  row.appendChild(textWrap);

  layer.appendChild(row);
}

async function hydrate() {
  const screen_el = get_active_screen_el(SCREEN_ID);
  if (!screen_el) return;

  ensure_css();
  await preload_catalog();

  const layer = ensure_ui_layer(screen_el);
  layer.innerHTML = "";

  const screen_rect = screen_el.getBoundingClientRect();
  if (!screen_rect.width || !screen_rect.height) return;

  // Pull up to 3 saves, newest first
  const saves = collect_saves_from_storage();

  // Build slot payloads
  const slots = [];
  for (let i = 0; i < SLOT_IDS.length; i++) {
    const rec = saves[i] || null;

    if (rec?.storyId) {
      let coverUrl = "";
      try {
        coverUrl = await cover_for_story(rec.storyId);
      } catch (_) {}

      slots.push({
        storyId: rec.storyId,
        nodeId: rec.nodeId || "",
        ts: rec.ts || 0,
        coverUrl
      });
    } else {
      slots.push(null);
    }
  }

  // Render each row aligned to the existing hitbox rect (temporary “library row” vibe)
  for (let i = 0; i < SLOT_IDS.length; i++) {
    const hb = find_hitbox(screen_el, SLOT_IDS[i]);
    if (!hb) continue;

    const pct = rect_to_pct(screen_rect, hb.getBoundingClientRect());
    render_row(layer, pct, i, slots[i]);

    // Bind hitbox target: if slot has a story save, go to story_<id>; else keep menu
    if (slots[i]?.storyId) {
      bind_slot_target(screen_el, SLOT_IDS[i], `story_${slots[i].storyId}`);
    } else {
      bind_slot_target(screen_el, SLOT_IDS[i], EMPTY_TARGET);
    }
  }
}

function schedule_hydrate() {
  // Allow layout to settle (iOS-friendly)
  requestAnimationFrame(() => requestAnimationFrame(() => hydrate()));
}

export function init_save_menu() {
  if (_inited) return;
  _inited = true;

  window.addEventListener("vc:screenchange", (e) => {
    const screen = e?.detail?.screen;
    if (screen !== SCREEN_ID) return;
    schedule_hydrate();
  });

  // Keep aligned on device rotation/resize
  window.addEventListener("resize", () => {
    const active = document.querySelector(".screen.is-active");
    if (active?.dataset?.screen === SCREEN_ID) schedule_hydrate();
  });

  window.addEventListener("orientationchange", () => {
    const active = document.querySelector(".screen.is-active");
    if (active?.dataset?.screen === SCREEN_ID) schedule_hydrate();
  });

  // If user lands directly on #saves, hydrate after first paint
  try {
    const hash = String(location.hash || "").replace("#", "");
    if (hash === SCREEN_ID) schedule_hydrate();
  } catch (_) {}
}
