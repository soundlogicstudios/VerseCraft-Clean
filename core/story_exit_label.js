// core/story_exit_labels.js
// Additive overlay: show labels aligned to existing story hitboxes.
// Never blocks taps (ui-layer pointer-events: none).
// No storage. No navigation changes.

let _mounted = false;

function is_story_screen(screen_id) {
  if (!screen_id) return false;
  return screen_id === "story" || screen_id.startsWith("story_");
}

function ensure_ui_layer(screen_el) {
  let ui = screen_el.querySelector(".ui-layer");
  if (ui) return ui;

  ui = document.createElement("div");
  ui.className = "ui-layer";
  screen_el.appendChild(ui);
  return ui;
}

function find_hitbox(screen_el, hitbox_id) {
  // screen-manager sets data-hitbox-id attribute
  return screen_el.querySelector(`.hitbox[data-hitbox-id="${hitbox_id}"]`);
}

function make_label(text) {
  const label = document.createElement("div");
  label.className = "story-exit-label";
  label.textContent = text;
  return label;
}

function align_label_to_hitbox(label, hb) {
  // Align using the existing % inline styles on the hitbox (contract-safe)
  // These are set in screen-manager: left/top/width/height in %
  if (hb.style.left) label.style.left = hb.style.left;
  if (hb.style.top) label.style.top = hb.style.top;
  if (hb.style.width) label.style.width = hb.style.width;
  if (hb.style.height) label.style.height = hb.style.height;
}

function apply_labels_to_screen(screen_el) {
  if (!screen_el) return;

  const screen_id = screen_el.dataset.screen || "";
  if (!is_story_screen(screen_id)) return;

  const ui = ensure_ui_layer(screen_el);

  // Remove any prior labels for this screen to avoid duplicates
  ui.querySelectorAll(".story-exit-label").forEach((n) => n.remove());

  // Canonical label targets (must match hitbox JSON ids)
  const map = [
    { id: "exit_story", text: "Exit Story" },
    { id: "open_character", text: "Character" },
    { id: "open_inventory", text: "Inventory" }
  ];

  map.forEach(({ id, text }) => {
    const hb = find_hitbox(screen_el, id);
    if (!hb) return;

    const label = make_label(text);
    align_label_to_hitbox(label, hb);
    ui.appendChild(label);
  });
}

function refresh_active_screen() {
  const active = document.querySelector(".screen.is-active");
  if (!active) return;

  // Wait a frame so hitboxes are present in DOM after screen change
  requestAnimationFrame(() => apply_labels_to_screen(active));
}

export function init_story_exit_labels() {
  if (_mounted) return;
  _mounted = true;

  window.addEventListener("vc:screenchange", refresh_active_screen);

  // Initial pass (in case boot lands directly on a story hash)
  Promise.resolve().then(refresh_active_screen);

  console.log("[story_exit_labels] initialized");
}
