// core/launcher_labels.js
// Launcher Labels — render labels FROM hitbox geometry (no hard-coded positions)
//
// Goal:
// - Labels track launcher hitboxes automatically
// - Works for launcher + launcher_* screens
// - Never blocks taps (pointer-events: none)
// - Safe: does nothing on non-launcher screens

const LABEL_MAP = {
  // Preferred launcher IDs (if you adopt these)
  start_story: "Start",
  back_to_library: "Back To Library",

  // Common library paging IDs (if they exist on launcher screens)
  prev_page: "Prev",
  next_page: "Next",

  // If any launcher uses menu/settings etc
  back_to_menu: "Back",
  open_settings: "Settings",

  // If older launcher files still use these IDs
  start: "Start",
  back: "Back"
};

function q(sel, root = document) {
  return root.querySelector(sel);
}

function qa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function is_launcher_screen(screen_id) {
  return screen_id === "launcher" || screen_id.startsWith("launcher_");
}

function get_active_screen_id() {
  return (
    document.body?.dataset?.screen ||
    document.documentElement?.dataset?.screen ||
    (location.hash || "").replace("#", "") ||
    ""
  );
}

function get_screen_el(screen_id) {
  return q(`.screen[data-screen="${screen_id}"]`);
}

function ensure_label_layer(screen_el) {
  let layer = screen_el.querySelector(".ui-layer.launcher-label-layer");
  if (layer) return layer;

  layer = document.createElement("div");
  layer.className = "ui-layer launcher-label-layer";
  screen_el.appendChild(layer);
  return layer;
}

function clear_labels(screen_el) {
  const layer = screen_el.querySelector(".ui-layer.launcher-label-layer");
  if (layer) layer.innerHTML = "";
}

function pick_label_text(hb_id, action, arg) {
  if (hb_id && LABEL_MAP[hb_id]) return LABEL_MAP[hb_id];

  // Fallbacks based on behavior (only if id is unknown)
  const a = (action || "").toLowerCase().trim();
  const g = (arg || "").trim();

  if (a === "go") {
    if (g === "last_library" || g.startsWith("library")) return "Back To Library";
    if (g === "menu") return "Back";
    if (g === "settings") return "Settings";
    if (g.startsWith("story_")) return "Start";
  }

  return ""; // unknown: do not label
}

function render_labels_for_launcher(screen_id) {
  const screen_el = get_screen_el(screen_id);
  if (!screen_el) return;

  const hitbox_layer = screen_el.querySelector(".hitbox-layer");
  if (!hitbox_layer) return;

  const hitboxes = qa(".hitbox", hitbox_layer);
  if (!hitboxes.length) {
    clear_labels(screen_el);
    return;
  }

  const label_layer = ensure_label_layer(screen_el);
  label_layer.innerHTML = ""; // reset each screenchange

  hitboxes.forEach((hb) => {
    const hb_id = hb.dataset.hitboxId || hb.getAttribute("data-hitbox-id") || hb.getAttribute("aria-label") || "";
    const action = hb.dataset.action || "";
    const arg = hb.dataset.arg || "";

    const text = pick_label_text(hb_id, action, arg);
    if (!text) return;

    const label = document.createElement("div");
    label.className = "launcher-label";
    label.textContent = text;

    // **Critical**: tie label geometry to hitbox geometry (percent-based)
    label.style.left = hb.style.left;
    label.style.top = hb.style.top;
    label.style.width = hb.style.width;
    label.style.height = hb.style.height;

    // Small auto-size hint based on hitbox height (still safe)
    // Example: 7% height on 9:16 screens is a good "button label"
    label.style.fontSize = "clamp(14px, 2.2vh, 22px)";

    label_layer.appendChild(label);
  });
}

export function init_launcher_labels() {
  // Render on every screen change
  window.addEventListener("vc:screenchange", (e) => {
    const screen_id = e?.detail?.screen || get_active_screen_id();
    if (!screen_id || !is_launcher_screen(screen_id)) return;
    render_labels_for_launcher(screen_id);
  });

  // Render once on boot (if we land on a launcher)
  const initial = get_active_screen_id();
  if (initial && is_launcher_screen(initial)) {
    render_labels_for_launcher(initial);
  }

  console.log("[launcher_labels] hitbox-mapped labels enabled");
}
