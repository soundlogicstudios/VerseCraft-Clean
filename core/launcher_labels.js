// core/launcher_labels.js
// Phase 2B: Launcher static labels (Title + Start/Continue/Back)
// Nav-safe, hitbox-safe: pointer-events none; overlays only.

let _inited = false;

function is_launcher_screen(screen) {
  return typeof screen === "string" && screen.startsWith("launcher_");
}

function story_id_from_launcher(screen) {
  // "launcher_code_blue" -> "code_blue"
  return String(screen || "").replace(/^launcher_/, "");
}

function to_title_case(id) {
  const cleaned = String(id || "").replace(/[-_]+/g, " ").trim();
  if (!cleaned) return "Untitled";
  return cleaned
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

const TITLE_OVERRIDES = {
  timecop: "Time Cop",
  relic_of_cylara: "Relic of Cylara",
  world_of_lorecraft: "World of Lorecraft",
  code_blue: "Code Blue",
  oregon_trail: "Oregon Trail",
  crimson_seagull: "Crimson Seagull",
  tale_of_icarus: "Tale of Icarus",
  wastelands: "Wastelands",
  backrooms: "Backrooms",
};

function pretty_title(story_id) {
  return TITLE_OVERRIDES[story_id] || to_title_case(story_id);
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

function render_launcher_labels(screen_id) {
  const screen_el = get_active_screen_el(screen_id);
  if (!screen_el) return;

  const layer = ensure_ui_layer(screen_el);
  layer.innerHTML = "";

  const story_id = story_id_from_launcher(screen_id);

  const title = document.createElement("div");
  title.className = "launcher-label launcher-title";
  title.textContent = pretty_title(story_id);

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
