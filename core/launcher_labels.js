// core/launcher_labels.js
// Phase 2B — Launcher static labels (HITBOX-BOUND)
// Fix: positions are derived from actual hitbox geometry (getBoundingClientRect),
// just like the library label fix. No reliance on inline styles or per-screen CSS.

let _inited = false;

function is_launcher_screen(screen) {
  return typeof screen === "string" && screen.startsWith("launcher_");
}

function story_id_from_launcher(screen) {
  return String(screen || "").replace(/^launcher_/, "");
}

// Canonical explicit titles (ALL 12)
const STORY_TITLES = {
  world_of_lorecraft: "World of Lorecraft",
  crimson_seagull: "Crimson Seagull",
  oregon_trail: "Oregon Trail",
  backrooms: "Backrooms",
  wastelands: "Wastelands",
  tale_of_icarus: "Tale of Icarus",
  code_blue: "Code Blue",
  relic_of_cylara: "Relic of Cylara",
  timecop: "Time Cop",
  king_solomon: "King Solomon",
  cosmos: "Cosmos",
  dead_drop_protocol: "Dead Drop Protocol",
};

function get_title(story_id) {
  return STORY_TITLES[story_id] || "Untitled";
}

function get_active_screen_el(screen_id) {
  return document.querySelector(`.screen.is-active[data-screen="${screen_id}"]`);
}

function ensure_ui_layer(screen_el) {
  let layer = screen_el.querySelector(".ui-layer.launcher-label-layer");
  if (layer) return layer;

  layer = document.createElement("div");
  layer.className = "ui-layer launcher-label-layer";
  screen_el.appendChild(layer);
  return layer;
}

function find_hitbox(screen_el, want) {
  // Hitboxes are injected as: .hitbox[data-hitbox-id="..."]
  // We'll match by substring to avoid guessing exact ids.
  const boxes = Array.from(screen_el.querySelectorAll(".hitbox-layer .hitbox"));
  const w = String(want).toLowerCase();
  return (
    boxes.find((b) => String(b.getAttribute("data-hitbox-id") || "").toLowerCase() === w) ||
    boxes.find((b) => String(b.getAttribute("data-hitbox-id") || "").toLowerCase().includes(w)) ||
    null
  );
}

function rect_to_pct(screen_rect, rect) {
  const left = ((rect.left - screen_rect.left) / screen_rect.width) * 100;
  const top = ((rect.top - screen_rect.top) / screen_rect.height) * 100;
  const width = (rect.width / screen_rect.width) * 100;
  const height = (rect.height / screen_rect.height) * 100;

  return { left, top, width, height };
}

function style_label_box(el, boxPct) {
  // Inline placement so missing CSS can't send it to 0,0
  el.style.position = "absolute";
  el.style.left = `${boxPct.left}%`;
  el.style.top = `${boxPct.top}%`;
  el.style.width = `${boxPct.width}%`;
  el.style.height = `${boxPct.height}%`;

  // Center text inside the hitbox region
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.pointerEvents = "none";
  el.style.textAlign = "center";

  // Minimal readable styling even if base.css is wrong/missing
  el.style.color = "rgba(255,255,255,0.95)";
  el.style.textShadow = "0 2px 6px rgba(0,0,0,0.75)";
  el.style.fontWeight = "800";
  el.style.letterSpacing = "0.02em";
  el.style.whiteSpace = "nowrap";
  el.style.fontSize = "clamp(14px, 2.2vh, 26px)";
}

function render_launcher_labels(screen_id) {
  const screen_el = get_active_screen_el(screen_id);
  if (!screen_el) return;

  const screen_rect = screen_el.getBoundingClientRect();
  if (!screen_rect.width || !screen_rect.height) return;

  const layer = ensure_ui_layer(screen_el);
  layer.innerHTML = "";

  const story_id = story_id_from_launcher(screen_id);

  // ---- TITLE (not hitbox-bound; safe default at top center) ----
  const title = document.createElement("div");
  title.className = "launcher-label launcher-title";
  title.textContent = get_title(story_id);
  // Inline fallback placement (top title zone)
  title.style.position = "absolute";
  title.style.left = "12%";
  title.style.top = "12%";
  title.style.width = "76%";
  title.style.height = "8%";
  title.style.display = "flex";
  title.style.alignItems = "center";
  title.style.justifyContent = "center";
  title.style.pointerEvents = "none";
  title.style.textAlign = "center";
  title.style.color = "rgba(255,255,255,0.95)";
  title.style.textShadow = "0 2px 6px rgba(0,0,0,0.75)";
  title.style.fontWeight = "900";
  title.style.letterSpacing = "0.02em";
  title.style.whiteSpace = "nowrap";
  title.style.fontSize = "clamp(18px, 3vh, 34px)";
  layer.appendChild(title);

  // ---- HITBOX-BOUND BUTTON LABELS ----
  const hbBack = find_hitbox(screen_el, "back");
  const hbStart = find_hitbox(screen_el, "start");
  const hbContinue = find_hitbox(screen_el, "continue");

  if (hbBack) {
    const r = hbBack.getBoundingClientRect();
    const pct = rect_to_pct(screen_rect, r);
    const back = document.createElement("div");
    back.className = "launcher-label launcher-back";
    back.textContent = "Back To Library";
    style_label_box(back, pct);
    // Left align looks better for back text
    back.style.justifyContent = "flex-start";
    back.style.paddingLeft = "2.5%";
    layer.appendChild(back);
  }

  if (hbStart) {
    const r = hbStart.getBoundingClientRect();
    const pct = rect_to_pct(screen_rect, r);
    const start = document.createElement("div");
    start.className = "launcher-label launcher-start";
    start.textContent = "Start";
    style_label_box(start, pct);
    layer.appendChild(start);
  }

  if (hbContinue) {
    const r = hbContinue.getBoundingClientRect();
    const pct = rect_to_pct(screen_rect, r);
    const cont = document.createElement("div");
    cont.className = "launcher-label launcher-continue";
    cont.textContent = "Continue";
    style_label_box(cont, pct);
    layer.appendChild(cont);
  }

  // If any hitbox wasn't found, log it so you can adjust ids in hitbox JSON.
  if (!hbBack) console.warn("[launcher_labels] back hitbox not found (data-hitbox-id contains 'back')");
  if (!hbStart) console.warn("[launcher_labels] start hitbox not found (data-hitbox-id contains 'start')");
  if (!hbContinue) console.warn("[launcher_labels] continue hitbox not found (data-hitbox-id contains 'continue')");
}

function schedule_render(screen_id) {
  // Two frames gives hitbox injection time in your screen manager flow
  requestAnimationFrame(() => requestAnimationFrame(() => render_launcher_labels(screen_id)));
}

export function init_launcher_labels() {
  if (_inited) return;
  _inited = true;

  window.addEventListener("vc:screenchange", (e) => {
    const screen = e?.detail?.screen;
    if (!is_launcher_screen(screen)) return;
    schedule_render(screen);
  });

  window.addEventListener("resize", () => {
    const active = document.querySelector(".screen.is-active");
    const screen = active?.dataset?.screen;
    if (is_launcher_screen(screen)) schedule_render(screen);
  });

  window.addEventListener("orientationchange", () => {
    const active = document.querySelector(".screen.is-active");
    const screen = active?.dataset?.screen;
    if (is_launcher_screen(screen)) schedule_render(screen);
  });
}
