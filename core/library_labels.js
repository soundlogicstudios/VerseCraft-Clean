// core/library_labels.js
// Phase 2A: Library row title overlays (no hitbox changes)
// - Creates pointer-events:none labels aligned to existing slot_* hitboxes
// - Runs only on library / library1 / library2 screens

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
  king_solomon: "King Solomon",
  cosmos: "Cosmos",
  dead_drop_protocol: "Dead Drop Protocol",
};

function to_title_case(id) {
  const cleaned = String(id || "")
    .replace(/[-_]+/g, " ")
    .trim();
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

function extract_story_id_from_launcher_arg(arg) {
  // hitbox arg is like "launcher_code_blue"
  const s = String(arg || "");
  if (!s.startsWith("launcher_")) return null;
  return s.slice("launcher_".length);
}

function apply_rect_geometry(label_el, target_el, screen_el) {
  // In this build, hitboxes are commonly positioned via per-screen CSS handles
  // (not inline styles). So we align labels using DOM rects.
  const sr = screen_el.getBoundingClientRect();
  const r = target_el.getBoundingClientRect();

  const left = ((r.left - sr.left) / sr.width) * 100;
  const top = ((r.top - sr.top) / sr.height) * 100;
  const width = (r.width / sr.width) * 100;
  const height = (r.height / sr.height) * 100;

  // Clamp to sane ranges (prevents NaNs from collapsing to top-left).
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  label_el.style.left = clamp(left, -50, 150).toFixed(4) + "%";
  label_el.style.top = clamp(top, -50, 150).toFixed(4) + "%";
  label_el.style.width = clamp(width, 0, 200).toFixed(4) + "%";
  label_el.style.height = clamp(height, 0, 200).toFixed(4) + "%";
}

function render_library_titles_for(screen_id) {
  const screen_el = get_active_screen_el(screen_id);
  if (!screen_el) return;

  const hitbox_layer = screen_el.querySelector(".hitbox-layer");
  if (!hitbox_layer) return;

  const slot_buttons = Array.from(
    hitbox_layer.querySelectorAll('.hitbox[data-hitbox-id^="slot_"]')
  );

  const label_layer = ensure_label_layer(screen_el);
  label_layer.innerHTML = "";

  // Sort by slot number so labels are stable
  slot_buttons.sort((a, b) => {
    const ai = parseInt((a.getAttribute("data-hitbox-id") || "").replace("slot_", ""), 10);
    const bi = parseInt((b.getAttribute("data-hitbox-id") || "").replace("slot_", ""), 10);
    return (isNaN(ai) ? 0 : ai) - (isNaN(bi) ? 0 : bi);
  });

  slot_buttons.forEach((btn) => {
    const slot_id = btn.getAttribute("data-hitbox-id") || "";
    const launcher_arg = btn.dataset.arg || "";
    const story_id = extract_story_id_from_launcher_arg(launcher_arg);

    const label = document.createElement("div");
    label.className = "library-row-title";
    label.setAttribute("data-slot", slot_id);

    // Align label to the hitbox geometry (CSS-driven), via rect conversion.
    apply_rect_geometry(label, btn, screen_el);

    label.textContent = pretty_title(story_id);

    label_layer.appendChild(label);
  });
}

export function init_library_labels() {
  if (_inited) return;
  _inited = true;

  let _last = null;

  function rerender_if_library_active() {
    if (!_last || !LIBRARY_SCREENS.has(_last)) return;
    // Re-align after orientation changes / resize.
    requestAnimationFrame(() => render_library_titles_for(_last));
  }

  window.addEventListener("vc:screenchange", (e) => {
    const screen = e?.detail?.screen;
    if (!LIBRARY_SCREENS.has(screen)) return;

    _last = screen;

    // Defer one frame so hitboxes are guaranteed injected
    requestAnimationFrame(() => {
      render_library_titles_for(screen);
    });
  });

  window.addEventListener("resize", rerender_if_library_active);
  window.addEventListener("orientationchange", rerender_if_library_active);
}
