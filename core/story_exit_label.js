// core/story_exit_label.js
// Additive overlay: show "Exit Story" aligned to an existing story hitbox.
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

function find_exit_anchor_hitbox(screen_el) {
  // Prefer a dedicated exit_story hitbox if it exists; otherwise fall back to back_to_launcher.
  return (
    screen_el.querySelector('.hitbox[data-hitbox-id="exit_story"]') ||
    screen_el.querySelector('.hitbox[data-hitbox-id="back_to_launcher"]') ||
    null
  );
}

function apply_label_to_screen(screen_el) {
  if (!screen_el) return;

  const screen_id = screen_el.dataset.screen || "";
  if (!is_story_screen(screen_id)) return;

  const anchor = find_exit_anchor_hitbox(screen_el);
  if (!anchor) return;

  const ui = ensure_ui_layer(screen_el);

  // Remove any prior label for this screen to avoid duplicates
  ui.querySelectorAll(".story-exit-label").forEach((n) => n.remove());

  const label = document.createElement("div");
  label.className = "story-exit-label";
  label.textContent = "Exit Story";

  // Align using the existing % styles on the hitbox (contract-safe)
  const left = anchor.style.left || "";
  const top = anchor.style.top || "";
  const width = anchor.style.width || "";
  const height = anchor.style.height || "";

  if (left) label.style.left = left;
  if (top) label.style.top = top;
  if (width) label.style.width = width;
  if (height) label.style.height = height;

  ui.appendChild(label);
}

function refresh_active_screen() {
  const active = document.querySelector(".screen.is-active");
  if (!active) return;
  apply_label_to_screen(active);
}

export function init_story_exit_label() {
  if (_mounted) return;
  _mounted = true;

  // On every screen change, re-align label on story screens
  window.addEventListener("vc:screenchange", () => {
    refresh_active_screen();
  });

  // Initial pass (in case boot lands directly on a story hash)
  // Use a microtask so hitboxes are likely already applied.
  Promise.resolve().then(refresh_active_screen);

  console.log("[story_exit_label] initialized");
}
