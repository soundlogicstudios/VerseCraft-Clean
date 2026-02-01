// src/core/save_menu.js
// Save Menu overlay (3 slots)
// - Reads per-story saves from localStorage: vc_save_<storyId>
// - Uses catalog.js to resolve cover + story JSON url (for title, if wanted)
// - Renders cover images into three banner boxes (visual-only overlay)
// - Renders save info text into a single text area
// - Patches EXISTING hitboxes slot_0/1/2 by changing data-arg only (NO geometry change)

import { resolve_story, preload_catalog } from "./catalog.js";

let _inited = false;

function has_debug_flag() {
  try {
    const params = new URLSearchParams(location.search);
    const v = params.get("debug");
    return v === "1" || v === "true" || v === "yes";
  } catch (_) {
    return false;
  }
}

function dbg_log(...args) {
  if (!has_debug_flag()) return;
  try {
    console.log("[save-menu]", ...args);
  } catch (_) {}
}

function is_saves_screen(screen) {
  return String(screen || "") === "saves";
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
  layer.style.zIndex = "50";
  screen_el.appendChild(layer);
  return layer;
}

// Minimal, safe default geometry.
// You will change ONLY these numbers to match your three banner boxes + text area.
// (This is overlay geometry, NOT hitbox geometry.)
const DEFAULT_LAYOUT = {
  slots: [
    { left: 8, top: 22, width: 84, height: 12 }, // slot_0
    { left: 8, top: 40, width: 84, height: 12 }, // slot_1
    { left: 8, top: 58, width: 84, height: 12 }  // slot_2
  ],
  info: { left: 8, top: 74, width: 84, height: 20 } // text panel
};

function style_box(el, pct) {
  el.style.position = "absolute";
  el.style.left = `${pct.left}%`;
  el.style.top = `${pct.top}%`;
  el.style.width = `${pct.width}%`;
  el.style.height = `${pct.height}%`;
}

function ensure_runtime_css() {
  if (document.getElementById("vc_save_menu_css")) return;

  const style = document.createElement("style");
  style.id = "vc_save_menu_css";
  style.textContent = `
    .save-menu-layer { pointer-events: none; }

    .vc-save-slot {
      position: absolute;
      overflow: hidden;
      border-radius: 12px;
      pointer-events: none;
      background: rgba(0,0,0,0.22);
      box-shadow: 0 10px 20px rgba(0,0,0,0.35);
    }

    .vc-save-slot img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transform: translateZ(0);
    }

    .vc-save-slot .vc-save-empty {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font: 900 18px/1.1 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: rgba(255,255,255,0.92);
      text-shadow: 0 2px 6px rgba(0,0,0,0.85);
      letter-spacing: 0.06em;
      background: rgba(0,0,0,0.35);
    }

    .vc-save-info {
      position: absolute;
      overflow: hidden;
      border-radius: 14px;
      pointer-events: none;
      background: rgba(0,0,0,0.50);
      border: 1px solid rgba(255,255,255,0.10);
      box-shadow: 0 10px 24px rgba(0,0,0,0.40);
      padding: 12px 14px;
      color: rgba(255,255,255,0.95);
      text-shadow: 0 2px 6px rgba(0,0,0,0.85);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    }

    .vc-save-info .t {
      font-weight: 900;
      font-size: 18px;
      margin-bottom: 8px;
      letter-spacing: 0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .vc-save-info .m {
      font-weight: 650;
      font-size: 14px;
      line-height: 1.25;
      opacity: 0.96;
      white-space: pre-wrap;
    }
  `;
  document.head.appendChild(style);
}

function read_all_saves() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("vc_save_")) continue;

      const storyId = k.replace(/^vc_save_/, "");
      const raw = localStorage.getItem(k) || "";
      let parsed = null;

      try {
        parsed = JSON.parse(raw);
      } catch (_) {
        parsed = null;
      }

      // Expected shape (we’ll accept minimal)
      const nodeId = String(parsed?.nodeId || parsed?.node_id || parsed?.node || "").trim();
      const updatedAt = Number(parsed?.updatedAt || parsed?.updated_at || parsed?.ts || 0) || 0;

      out.push({ storyId, nodeId, updatedAt, key: k });
    }
  } catch (e) {
    dbg_log("localStorage read failed", e);
  }

  // Most recent first
  out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return out;
}

function fmt_time(ts) {
  try {
    if (!ts) return "Unknown time";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "Unknown time";
    return d.toLocaleString();
  } catch (_) {
    return "Unknown time";
  }
}

function find_hitbox_by_id(screen_el, want) {
  const w = String(want || "").toLowerCase();
  const boxes = Array.from(screen_el.querySelectorAll(".hitbox-layer .hitbox"));
  return (
    boxes.find((b) => String(b.getAttribute("data-hitbox-id") || "").toLowerCase() === w) ||
    null
  );
}

function patch_slot_hitboxes(screen_el, slots) {
  // slots: [{storyId,...}, ...] length 3
  for (let i = 0; i < 3; i++) {
    const hb = find_hitbox_by_id(screen_el, `slot_${i}`);
    if (!hb) continue;

    const s = slots[i] || null;

    // If empty, keep it inert (go nowhere)
    if (!s?.storyId) {
      hb.dataset.action = "go";
      hb.dataset.arg = "menu"; // safe default; change later if you prefer no-op
      continue;
    }

    hb.dataset.action = "go";
    hb.dataset.arg = `story_${s.storyId}`;
  }
}

async function safe_fetch_story_title(url) {
  if (!url) return "";
  try {
    const res = await fetch(url, { cache: "default" });
    if (!res.ok) return "";
    const data = await res.json();
    return String(data?.meta?.title || data?.title || "").trim();
  } catch {
    return "";
  }
}

function render_slots_and_info(layer, layout, resolvedSlots, selectedIndex) {
  layer.innerHTML = "";

  // Slots
  for (let i = 0; i < 3; i++) {
    const box = layout.slots[i];
    const slot = document.createElement("div");
    slot.className = "vc-save-slot";
    style_box(slot, box);

    const s = resolvedSlots[i] || null;
    if (s?.coverUrl) {
      const img = document.createElement("img");
      img.alt = s.title || s.storyId || "Save";
      img.src = s.coverUrl;
      slot.appendChild(img);
    } else {
      const empty = document.createElement("div");
      empty.className = "vc-save-empty";
      empty.textContent = "EMPTY";
      slot.appendChild(empty);
    }

    // subtle highlight for selected (visual only)
    if (i === selectedIndex) {
      slot.style.outline = "2px solid rgba(255,255,255,0.30)";
      slot.style.boxShadow = "0 12px 28px rgba(0,0,0,0.55)";
    }

    layer.appendChild(slot);
  }

  // Info panel
  const info = document.createElement("div");
  info.className = "vc-save-info";
  style_box(info, layout.info);

  const s = resolvedSlots[selectedIndex] || null;
  const title = document.createElement("div");
  title.className = "t";
  title.textContent = s?.title ? s.title : (s?.storyId ? `Save: ${s.storyId}` : "No Save Selected");

  const meta = document.createElement("div");
  meta.className = "m";

  if (!s?.storyId) {
    meta.textContent =
      "Select a save slot.\n\nIf a slot is EMPTY, you have not made progress in that story yet.";
  } else {
    meta.textContent =
      `Story Id: ${s.storyId}\n` +
      `Last Node: ${s.nodeId || "Unknown"}\n` +
      `Updated: ${fmt_time(s.updatedAt)}`;
  }

  info.appendChild(title);
  info.appendChild(meta);
  layer.appendChild(info);
}

function bind_selection(screen_el, onSelect) {
  // We do NOT intercept taps. We only listen in capture and read which hitbox fired.
  // This is visual-only selection; navigation still happens by hitbox arg (patched).
  // If you prefer selection without navigation, we can switch slot hitboxes to "select"
  // later. For now, first tap selects, second tap can be used to go (future polish).

  if (screen_el.dataset.vcSaveMenuBound === "1") return;
  screen_el.dataset.vcSaveMenuBound = "1";

  screen_el.addEventListener(
    "pointerup",
    (e) => {
      const hb = e.target?.closest?.(".hitbox");
      if (!hb) return;

      const id = String(hb.getAttribute("data-hitbox-id") || "");
      if (id === "slot_0") onSelect(0);
      else if (id === "slot_1") onSelect(1);
      else if (id === "slot_2") onSelect(2);
    },
    true
  );
}

async function hydrate_saves_screen() {
  ensure_runtime_css();

  const screen_el = get_active_screen_el("saves");
  if (!screen_el) return;

  const layer = ensure_ui_layer(screen_el);

  // Load catalog so covers resolve
  await preload_catalog();

  const saves = read_all_saves();
  const top3 = [saves[0] || null, saves[1] || null, saves[2] || null];

  // Resolve catalog (cover/storyJsonUrl) + (optional) title from story JSON
  const resolvedSlots = [];
  for (let i = 0; i < 3; i++) {
    const s = top3[i];
    if (!s?.storyId) {
      resolvedSlots.push(null);
      continue;
    }

    const r = await resolve_story(s.storyId);
    const coverUrl = r?.coverUrl || "";
    const storyJsonUrl = r?.storyJsonUrl || "";

    // Title is optional. If you want zero network fetch here, remove this.
    const title = (await safe_fetch_story_title(storyJsonUrl)) || "";

    resolvedSlots.push({
      storyId: s.storyId,
      nodeId: s.nodeId,
      updatedAt: s.updatedAt,
      coverUrl,
      title
    });
  }

  // Selection state (in-memory, per session)
  let selected = Number(screen_el.dataset.vcSaveSelected || 0) || 0;
  if (selected < 0 || selected > 2) selected = 0;

  // Patch slot hitboxes to route to story_<id>
  patch_slot_hitboxes(screen_el, resolvedSlots);

  // Render
  render_slots_and_info(layer, DEFAULT_LAYOUT, resolvedSlots, selected);

  // Bind selection (visual)
  bind_selection(screen_el, (idx) => {
    screen_el.dataset.vcSaveSelected = String(idx);
    render_slots_and_info(layer, DEFAULT_LAYOUT, resolvedSlots, idx);
  });

  dbg_log("hydrated", { saves: saves.map((x) => x.storyId), top3: resolvedSlots.map((x) => x?.storyId) });
}

function schedule() {
  requestAnimationFrame(() => requestAnimationFrame(() => hydrate_saves_screen()));
}

export function init_save_menu() {
  if (_inited) return;
  _inited = true;

  ensure_runtime_css();

  window.addEventListener("vc:screenchange", (e) => {
    const screen = e?.detail?.screen;
    if (!is_saves_screen(screen)) return;
    schedule();
  });

  window.addEventListener("resize", () => {
    const active = document.querySelector(".screen.is-active");
    const screen = active?.dataset?.screen;
    if (is_saves_screen(screen)) schedule();
  });

  window.addEventListener("orientationchange", () => {
    const active = document.querySelector(".screen.is-active");
    const screen = active?.dataset?.screen;
    if (is_saves_screen(screen)) schedule();
  });
}
