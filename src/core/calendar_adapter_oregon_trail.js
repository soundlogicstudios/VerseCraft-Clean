// src/core/calendar_adapter_oregon_trail.js

const STORY_ID = "oregon_trail";
const START_DATE = new Date(1836, 1, 14); // February 14, 1836
const DEFAULTS = { dayIndex: 0, food: 200, ammo: 50 };

function save_key(storyId) {
  return `vc_save_${storyId}`;
}

function safe_read_save(storyId) {
  try {
    const raw = localStorage.getItem(save_key(storyId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function safe_write_save(storyId, obj) {
  try {
    localStorage.setItem(save_key(storyId), JSON.stringify(obj));
  } catch (_) {}
}

function get_state() {
  return Object.assign({}, DEFAULTS, safe_read_save(STORY_ID) || {});
}

function set_state(s) {
  s.updatedAt = Date.now();
  safe_write_save(STORY_ID, s);
}

function get_date_for_index(idx) {
  const d = new Date(START_DATE.getTime());
  d.setDate(d.getDate() + idx * 3);
  return d;
}

function format_date(date) {
  return date.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  });
}

// --- HUD ---
function render_date_hud(parent, dateStr, food, ammo) {
  let el = parent.querySelector(".oregon-date-hud");
  if (!el) {
    el = document.createElement("div");
    el.className = "oregon-date-hud";
    el.style.position = "absolute";
    el.style.top = "24px";
    el.style.right = "24px";
    el.style.padding = "12px 24px";
    el.style.background = "rgba(14,12,10,0.95)";
    el.style.borderRadius = "13px";
    el.style.color = "#f5ebd7";
    el.style.fontWeight = "bold";
    el.style.fontSize = "1.08em";
    el.style.letterSpacing = "0.03em";
    el.style.boxShadow = "0 2px 12px #2226";
    el.style.zIndex = "110";
    parent.appendChild(el);
  }
  el.innerHTML = `<span>${dateStr}</span> <span style="margin-left:22px;">🍖 ${food} lbs</span> <span style="margin-left:18px;">🔫 ${ammo} rounds</span>`;
}

export function update_oregon_date_hud() {
  const screen = document.querySelector('.screen.is-active[data-screen="character_oregon_trail"]');
  if (!screen) return;
  const s = get_state();
  const date = get_date_for_index(s.dayIndex);
  render_date_hud(screen, format_date(date), s.food, s.ammo);
}

// Called on story advance (after user picks a choice)
export function increment_oregon_date_on_advance(nodeId) {
  const s = get_state();
  s.dayIndex += 1;
  s.nodeId = nodeId;
  set_state(s);
}

export function adjust_food(delta) {
  const s = get_state();
  s.food = Math.max(0, (s.food || 0) + delta);
  set_state(s);
}

export function adjust_ammo(delta) {
  const s = get_state();
  s.ammo = Math.max(0, (s.ammo || 0) + delta);
  set_state(s);
}

export function init_calendar_adapter() {
  // Show HUD when character panel for Oregon Trail is shown
  window.addEventListener("vc:screenchange", (e) => {
    if (e?.detail?.screen === "character_oregon_trail") {
      setTimeout(update_oregon_date_hud, 30);
    }
  });
}
