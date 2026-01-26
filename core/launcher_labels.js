// core/launcher_labels.js
// Launcher Labels — robust mapping to hitboxes
//
// Fix for "labels shoved into top-left":
// - Do NOT rely on hb.style.left/top/width/height (can be empty/overridden).
// - Compute geometry from getBoundingClientRect and convert to % of hitbox-layer.
//
// Behavior:
// - Only runs on launcher / launcher_* screens
// - Labels never block taps (ui-layer pointer-events: none)
// - Labels auto-refresh on screen change + after hitboxes are applied

const LABEL_MAP = {
  start_story: "Start",
  back_to_library: "Back To Library",
  prev_page: "Prev",
  next_page: "Next",
  back_to_menu: "Back",
  open_settings: "Settings",
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
    document.documentElement?.getAttribute?.("data-screen") ||
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

function hitbox_id(hb) {
  return hb?.dataset?.hitboxId || hb?.getAttribute?.("data-hitbox-id") || hb?.getAttribute?.("aria-label") || "";
}

function pick_label_text(hb_id, action, arg) {
  if (hb_id && LABEL_MAP[hb_id]) return LABEL_MAP[hb_id];

  const a = (action || "").toLowerCase().trim();
  const g = (arg || "").trim();

  if (a === "go") {
    if (g === "last_library" || g.startsWith("library")) return "Back To Library";
    if (g === "menu") return "Back";
    if (g === "settings") return "Settings";
    if (g.startsWith("story_")) return "Start";
  }

  return "";
}

function rect_to_pct(rect, layerRect) {
  const x = ((rect.left - layerRect.left) / layerRect.width) * 100;
  const y = ((rect.top - layerRect.top) / layerRect.height) * 100;
  const w = (rect.width / layerRect.width) * 100;
  const h = (rect.height / layerRect.height) * 100;

  // clamp to sane bounds
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const r2 = (n) => Math.round(n * 100) / 100;

  return {
    x: r2(clamp(x, 0, 100)),
    y: r2(clamp(y, 0, 100)),
    w: r2(clamp(w, 0, 100)),
    h: r2(clamp(h, 0, 100))
  };
}

function render_labels_for_launcher(screen_id) {
  const screen_el = get_screen_el(screen_id);
  if (!screen_el) return;

  const hitbox_layer = screen_el.querySelector(".hitbox-layer");
  if (!hitbox_layer) return;

  const layerRect = hitbox_layer.getBoundingClientRect();
  if (!layerRect.width || !layerRect.height) return;

  const hitboxes = qa(".hitbox", hitbox_layer);
  const label_layer = ensure_label_layer(screen_el);
  label_layer.innerHTML = "";

  if (!hitboxes.length) return;

  hitboxes.forEach((hb) => {
    const id = hitbox_id(hb);
    const text = pick_label_text(id, hb.dataset.action || "", hb.dataset.arg || "");
    if (!text) return;

    const hbRect = hb.getBoundingClientRect();
    const pct = rect_to_pct(hbRect, layerRect);

    const label = document.createElement("div");
    label.className = "launcher-label";
    label.textContent = text;

    // Position label to match real hitbox geometry
    label.style.left = `${pct.x}%`;
    label.style.top = `${pct.y}%`;
    label.style.width = `${pct.w}%`;
    label.style.height = `${pct.h}%`;

    // consistent sizing
    label.style.fontSize = "clamp(14px, 2.2vh, 22px)";

    label_layer.appendChild(label);
  });
}

function render_with_retry(screen_id) {
  // Hitboxes are applied async after screen change.
  // Render immediately, then again on next frame to catch newly inserted hitboxes.
  render_labels_for_launcher(screen_id);
  requestAnimationFrame(() => render_labels_for_launcher(screen_id));
}

export function init_launcher_labels() {
  window.addEventListener("vc:screenchange", (e) => {
    const screen_id = e?.detail?.screen || get_active_screen_id();
    if (!screen_id || !is_launcher_screen(screen_id)) return;
    render_with_retry(screen_id);
  });

  const initial = get_active_screen_id();
  if (initial && is_launcher_screen(initial)) {
    render_with_retry(initial);
  }

  console.log("[launcher_labels] robust hitbox-mapped labels enabled");
}
