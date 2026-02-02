// core/save_menu.js
// Save Menu overlay — visual polish pass (row spacing + centering)
//
// Canonical screen: settings_clear_save
// This pass:
// - Does NOT touch hitboxes
// - Spreads rows slightly farther apart top → bottom
// - Applies per-row upward nudges for centering inside frames

import { preload_catalog, resolve_story } from "./catalog.js";

let _inited = false;

const SCREEN_ID = "settings_clear_save";
const SLOT_IDS = ["slot_0", "slot_1", "slot_2"];
const EMPTY_TARGET = "menu";

// Per-row vertical adjustments (px)
const ROW_NUDGE_Y = [-5, -15, -20];

// Stretch rows apart visually (top → bottom)
const ROW_SPREAD_FACTOR = 1.08;

const TITLE_MAP = {
  world_of_lorecraft: "World of Lorecraft",
  crimson_seagull: "Crimson Seagull",
  oregon_trail: "Oregon Trail",
  backrooms: "Backrooms",
  wastelands: "Wastelands",
  tale_of_icarus: "Tale of Icarus",
  code_blue: "Code Blue",
  relic_of_cylara: "Relic of Cylara",
  timecop: "TimeCop",
  king_solomon: "King Solomon",
  cosmos: "Cosmos",
  dead_drop_protocol: "Dead Drop Protocol"
};

function get_active_screen_el(id) {
  return document.querySelector(`.screen.is-active[data-screen="${id}"]`);
}

function ensure_layer(screen) {
  let layer = screen.querySelector(".ui-layer.save-menu-layer");
  if (layer) return layer;
  layer = document.createElement("div");
  layer.className = "ui-layer save-menu-layer";
  layer.style.position = "absolute";
  layer.style.inset = "0";
  layer.style.pointerEvents = "none";
  layer.style.zIndex = "45";
  screen.appendChild(layer);
  return layer;
}

function ensure_css() {
  if (document.getElementById("vc_save_menu_css")) return;
  const s = document.createElement("style");
  s.id = "vc_save_menu_css";
  s.textContent = `
    .vc-save-row {
      position: absolute;
      display: flex;
      align-items: center;
      gap: 14px;
      pointer-events: none;
    }
    .vc-save-cover {
      height: 100%;
      aspect-ratio: 3 / 4;
      border-radius: 12px;
      object-fit: cover;
      box-shadow: 0 10px 18px rgba(0,0,0,0.35);
    }
    .vc-save-text {
      color: #fff;
      text-shadow: 0 2px 6px rgba(0,0,0,0.85);
      text-transform: none;
    }
    .vc-save-title {
      font-weight: 900;
      font-size: clamp(16px, 2.4vh, 26px);
      line-height: 1.05;
    }
    .vc-save-detail {
      margin-top: 6px;
      opacity: 0.9;
      font-size: clamp(12px, 1.8vh, 18px);
    }
  `;
  document.head.appendChild(s);
}

function find_hitbox(screen, id) {
  return Array.from(screen.querySelectorAll(".hitbox-layer .hitbox"))
    .find(b => b.dataset.hitboxId === id);
}

function rect_to_pct(sr, r) {
  return {
    left: ((r.left - sr.left) / sr.width) * 100,
    top: ((r.top - sr.top) / sr.height) * 100,
    width: (r.width / sr.width) * 100,
    height: (r.height / sr.height) * 100
  };
}

function collect_saves() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    const m = k.match(/^vc_story_state_(.+)$/);
    if (!m) continue;
    try {
      const v = JSON.parse(localStorage.getItem(k));
      out.push({ storyId: m[1], nodeId: v.nodeId, ts: v.ts || 0 });
    } catch {}
  }
  const byId = new Map();
  for (const r of out) {
    const p = byId.get(r.storyId);
    if (!p || r.ts > p.ts) byId.set(r.storyId, r);
  }
  return Array.from(byId.values()).sort((a,b)=>b.ts-a.ts);
}

async function hydrate() {
  const screen = get_active_screen_el(SCREEN_ID);
  if (!screen) return;

  ensure_css();
  await preload_catalog();

  const layer = ensure_layer(screen);
  layer.innerHTML = "";

  const sr = screen.getBoundingClientRect();
  const saves = collect_saves();

  for (let i = 0; i < SLOT_IDS.length; i++) {
    const hb = find_hitbox(screen, SLOT_IDS[i]);
    if (!hb) continue;

    const pct = rect_to_pct(sr, hb.getBoundingClientRect());

    // widen spacing progressively
    pct.top *= ROW_SPREAD_FACTOR;

    const row = document.createElement("div");
    row.className = "vc-save-row";
    row.style.left = pct.left + "%";
    row.style.top = pct.top + "%";
    row.style.width = pct.width + "%";
    row.style.height = pct.height + "%";
    row.style.transform = `translateY(${ROW_NUDGE_Y[i] || 0}px)`;

    const img = document.createElement("img");
    img.className = "vc-save-cover";

    const txt = document.createElement("div");
    txt.className = "vc-save-text";

    const t = document.createElement("div");
    t.className = "vc-save-title";

    const d = document.createElement("div");
    d.className = "vc-save-detail";

    const rec = saves[i];
    if (rec) {
      const resolved = await resolve_story(rec.storyId);
      img.src = resolved?.coverUrl || "";
      t.textContent = TITLE_MAP[rec.storyId] || rec.storyId;
      d.textContent = `Scene: ${rec.nodeId}`;
      hb.dataset.action = "go";
      hb.dataset.arg = "story_" + rec.storyId;
    } else {
      t.textContent = "Empty Slot";
      d.textContent = "No save found";
      hb.dataset.action = "go";
      hb.dataset.arg = EMPTY_TARGET;
    }

    txt.appendChild(t);
    txt.appendChild(d);
    row.appendChild(img);
    row.appendChild(txt);
    layer.appendChild(row);
  }
}

function schedule() {
  requestAnimationFrame(() => requestAnimationFrame(hydrate));
}

export function init_save_menu() {
  if (_inited) return;
  _inited = true;

  window.addEventListener("vc:screenchange", e => {
    if (e?.detail?.screen === SCREEN_ID) schedule();
  });

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
}
