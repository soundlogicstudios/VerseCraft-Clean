// core/launcher_labels.js
// Phase 2B — Launcher static labels
// Title + Start + Continue + Back To Library
// Overlay-only. Does NOT touch navigation or hitboxes.

let _inited = false;

// Only runs on launcher_* screens
function is_launcher_screen(screen) {
  return typeof screen === "string" && screen.startsWith("launcher_");
}

function story_id_from_launcher(screen) {
  // launcher_code_blue -> code_blue
  return String(screen || "").replace(/^launcher_/, "");
}

// Canonical explicit titles (ALL 12 — no exceptions, no heuristics)
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
  return document.querySelector(
    `.screen.is-active[data-screen="${screen_id}"]`
  );
}

function ensure_ui_layer(screen_el) {
  let layer = screen_el.querySelector(".ui-layer.launcher-label-layer");
  if (layer) return layer;

  layer = document.createElement("div");
  layer.className = "ui-layer launcher-label-layer";
  screen_el.appendChild(layer);
  return layer;
}

function render_launcher_labels(screen_id) {
  const screen_el = get_active_screen_el(screen_id);
  if (!screen_el) return;

  const layer = ensure_ui_layer(screen_el);
  layer.innerHTML = "";

  const story_id = story_id_from_launcher(screen_id);

  const title = document.createElement("div");
  title.className = "launcher-label launcher-title";
  title.textContent = get_title(story_id);

  const start = document.createElement("div");
  start.className = "launcher-label launcher-start";
  start.textContent = "Start";

  const cont = document.createElement("div");
  cont.className = "launcher-label launcher-continue";
  cont.textContent = "Continue";

  const back = document.createElement("div");
  back.className = "launcher-label launcher-back";
  back.textContent = "Back To Library";

  layer.appendChild(title);
  layer.appendChild(start);
  layer.appendChild(cont);
  layer.appendChild(back);
}

function schedule_render(screen_id) {
  requestAnimationFrame(() => render_launcher_labels(screen_id));
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
