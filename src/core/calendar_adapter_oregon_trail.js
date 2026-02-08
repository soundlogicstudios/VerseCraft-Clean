// src/core/calendar_adapter_oregon_trail.js
const STORY_ID = "oregon_trail";
const START_DATE = new Date(1836, 1, 14); // Month is 0-indexed! 1 = February

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

// Compute the "story day index" (number of advances)
function get_day_index(save) {
  // The simplest way: count node hops from S01 to current node.
  // Or: store `dayIndex` directly in save, update it on advance.
  return save?.dayIndex ?? 0;
}

function set_day_index(storyId, nodeId, dayIndex) {
  let save = safe_read_save(storyId) || {};
  save.nodeId = nodeId;
  save.dayIndex = dayIndex;
  save.updatedAt = Date.now();
  safe_write_save(storyId, save);
}

// Format like "February 14, 1836"
function format_date(date) {
  return date.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  });
}

function get_date_for_index(idx) {
  const d = new Date(START_DATE.getTime());
  d.setDate(d.getDate() + idx * 3);
  return d;
}

// ---- HUD RENDER ----

function render_date_hud(parent, dateStr) {
  let el = parent.querySelector(".oregon-date-hud");
  if (!el) {
    el = document.createElement("div");
    el.className = "oregon-date-hud";
    // Style this as you wish!
    el.style.position = "absolute";
    el.style.top = "24px";
    el.style.right = "24px";
    el.style.padding = "10px 18px";
    el.style.background = "rgba(14,12,10,0.92)";
    el.style.borderRadius = "12px";
    el.style.color = "#f5ebd7";
    el.style.fontWeight = "bold";
    el.style.fontSize = "1.08em";
    el.style.letterSpacing = "0.03em";
    el.style.zIndex = "100";
    parent.appendChild(el);
  }
  el.textContent = dateStr;
}

// ---- INTEGRATION ----

// Called when character panel is shown (screen change to 'character_oregon_trail')
export function update_oregon_date_hud() {
  const screen = document.querySelector('.screen.is-active[data-screen="character_oregon_trail"]');
  if (!screen) return;
  const save = safe_read_save(STORY_ID);
  const dayIndex = get_day_index(save);
  const date = get_date_for_index(dayIndex);
  render_date_hud(screen, format_date(date));
}

// Called when advancing story (e.g. after user picks a choice)
export function increment_oregon_date_on_advance(nodeId) {
  const save = safe_read_save(STORY_ID) || {};
  const oldIdx = get_day_index(save);
  const newIdx = oldIdx + 1;
  set_day_index(STORY_ID, nodeId, newIdx);
}

export function init_calendar_adapter() {
  // Hook into screen changes
  window.addEventListener("vc:screenchange", (e) => {
    if (e?.detail?.screen === "character_oregon_trail") {
      setTimeout(update_oregon_date_hud, 32);
    }
  });
}
