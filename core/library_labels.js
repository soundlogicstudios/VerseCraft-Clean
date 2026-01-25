// core/library_labels.js
// Phase 2A: Library row title overlays (nav-safe, hitbox-safe)
// Fix: Horizontal centering is now controlled by CSS variables so it can match the banner FRAME.
// Vertical placement still follows the slot_* hitboxes so labels track your debug XY changes.
//
// CSS variables (set per screen in styles/screens/library*.css):
//   --vc-lib-label-left: 12%;
//   --vc-lib-label-width: 76%;
//   --vc-lib-label-y-offset: 0%;   (optional small vertical tweak)

let _inited = false;

const LIBRARY_SCREENS = new Set(["library", "library1", "library2"]);

const TITLE_OVERRIDES = {
  backrooms: "Backrooms",
  timecop: "Time Cop",
  relic_of_cylara: "Relic of Cylara",
  world_of_lorecraft: "World of Lorecraft",
  oregon_trail: "Oregon Trail",
  wastelands: "Wastelands",
  tale_of_icarus: "Tale of Icarus",
  crimson_seagull: "Crimson Seagull",
  code_blue: "Code Blue",
};

function to_title_case(id) {
  const cleaned = String(id || "").replace(/[-_]+/g, " ").trim();
  if (!cleaned) return "Untitled";
  return cleaned
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

function pretty_title(story_id) {
  if (!story_id) return "Untitled";
  return TITLE_OVERRIDES[story_id] || to_title_case(story_id);
}

function extract_story_id_from_launcher_arg(arg) {
  // hitbox arg is like "launcher_code_blue"
  const s = String(arg || "");
  if (!s.startsWith("launcher_")) return null;
  return s.slice("launcher_".length);
}

function get_active_screen_el(screen_id) {
  return document.querySelector(`.screen.is-active[data-screen="${screen_id}"]`);
}

function ensure_label_layer(screen_el) {
  let layer = screen_el.querySelector(".ui-layer.library-title-layer");
  if (layer) return layer;

  layer = document.createElement("div");
  layer.className = "ui-layer library-title-layer";
  screen_el.appendChild(layer);
  return layer;
}

function css_var(screen_el, name, fallback) {
  const v = getComputedStyle(screen_el).getPropertyValue(name);
  const trimmed = (v || "").trim();
  return trimmed || fallback;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function render_library_titles_for(screen_id) {
  const screen_el = get_active_screen_el(screen_id);
  if (!screen_el) return;

  const hitbox_layer = screen_el.querySelector(".hitbox-layer");
  if (!hitbox_layer) return;

  const screen_rect = screen_el.getBoundingClientRect();
  if (!screen_rect.width || !screen_rect.height) return;

  // Horizontal alignment controlled by CSS variables so it matches your banner frame.
  const label_left = css_var(screen_el, "--vc-lib-label-left", "12%");
  const label_width = css_var(screen_el, "--vc-lib-label-width", "76%");
  const y_offset_str = css_var(screen_el, "--vc-lib-label-y-offset", "0%");
  const y_offset = parseFloat(y_offset_str) || 0;

  const slot_buttons = Array.from(
    hitbox_layer.querySelectorAll('.hitbox[data-hitbox-id^="slot_"]')
  );

  // Stable ordering
  slot_buttons.sort((a, b) => {
    const ai = parseInt((a.getAttribute("data-hitbox-id") || "").replace("slot_", ""), 10);
    const bi = parseInt((b.getAttribute("data-hitbox-id") || "").replace("slot_", ""), 10);
    return (isNaN(ai) ? 0 : ai) - (isNaN(bi) ? 0 : bi);
  });

  const label_layer = ensure_label_layer(screen_el);
  label_layer.innerHTML = "";

  slot_buttons.forEach((btn) => {
    const slot_id = btn.getAttribute("data-hitbox-id") || "";
    const launcher_arg = btn.dataset.arg || "";
    const story_id = extract_story_id_from_launcher_arg(launcher_arg);

    const r = btn.getBoundingClientRect();

    // Vertical center of the hitbox, converted to % of the active screen
    const center_y_px = (r.top - screen_rect.top) + r.height / 2;
    const center_y_pct = clamp((center_y_px / screen_rect.height) * 100, 0, 100);

    const label = document.createElement("div");
    label.className = "library-row-title";
    label.setAttribute("data-slot", slot_id);

    // Horizontal placement: tuned to the banner frame via CSS vars
    label.style.left = label_left;
    label.style.width = label_width;

    // Vertical placement: follows hitbox row, with optional tiny tweak
    label.style.top = `${center_y_pct + y_offset}%`;
    label.style.height = `${Math.max(6, (r.height / screen_rect.height) * 100)}%`;

    // Center the text within its own box
    label.style.transform = "translateY(-50%)";

    label.textContent = pretty_title(story_id);
    label_layer.appendChild(label);
  });
}

function schedule_render(screen_id) {
  // Ensure hitboxes are injected before we measure
  requestAnimationFrame(() => render_library_titles_for(screen_id));
}

export function init_library_labels() {
  if (_inited) return;
  _inited = true;

  window.addEventListener("vc:screenchange", (e) => {
    const screen = e?.detail?.screen;
    if (!LIBRARY_SCREENS.has(screen)) return;
    schedule_render(screen);
  });

  // Keep aligned on rotation / iOS URL bar resize changes
  window.addEventListener("resize", () => {
    const active = document.querySelector(".screen.is-active");
    const screen = active?.dataset?.screen;
    if (LIBRARY_SCREENS.has(screen)) schedule_render(screen);
  });

  window.addEventListener("orientationchange", () => {
    const active = document.querySelector(".screen.is-active");
    const screen = active?.dataset?.screen;
    if (LIBRARY_SCREENS.has(screen)) schedule_render(screen);
  });
}
