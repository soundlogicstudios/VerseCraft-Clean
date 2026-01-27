// core/settings_volume_ui.js
// Settings Volume Slider UI
// - Shows only on the Settings screen
// - No persistence (no localStorage)
// - Drives global BGM volume via window.VC_AUDIO_SET_VOLUME (or exported functions)

let _mounted = false;

function q(sel, root = document) {
  return root.querySelector(sel);
}

function get_screen_id(e) {
  return (
    e?.detail?.screen ||
    document.body?.dataset?.screen ||
    document.documentElement?.getAttribute?.("data-screen") ||
    (location.hash || "").replace("#", "") ||
    ""
  );
}

function set_widget_visible(visible) {
  const w = q("#vcVolumeWidget");
  if (!w) return;
  w.classList.toggle("hidden", !visible);
}

function set_value_text(pct) {
  const el = q("#vcVolumeValue");
  if (el) el.textContent = `${pct}%`;
}

function set_slider_value(pct) {
  const s = q("#vcVolumeSlider");
  if (s) s.value = String(pct);
}

function get_current_volume_pct() {
  try {
    if (typeof window.VC_AUDIO_GET_VOLUME === "function") {
      const v01 = Number(window.VC_AUDIO_GET_VOLUME());
      if (Number.isFinite(v01)) return Math.round(v01 * 100);
    }
  } catch (_) {}
  return 85;
}

function apply_volume_pct(pct) {
  const clamped = Math.max(0, Math.min(100, Number(pct)));
  const v01 = clamped / 100;

  try {
    if (typeof window.VC_AUDIO_SET_VOLUME === "function") {
      window.VC_AUDIO_SET_VOLUME(v01);
    }
  } catch (_) {}

  set_value_text(Math.round(clamped));
}

function on_screenchange(e) {
  const id = get_screen_id(e);
  const is_settings = id === "settings";

  set_widget_visible(is_settings);

  if (is_settings) {
    const pct = get_current_volume_pct();
    set_slider_value(pct);
    set_value_text(pct);
  }
}

export function init_settings_volume_ui() {
  if (_mounted) return;
  _mounted = true;

  const slider = q("#vcVolumeSlider");
  if (!slider) {
    console.warn("[settings_volume_ui] missing #vcVolumeSlider");
    return;
  }

  // Ensure widget hidden until settings screen
  set_widget_visible(false);

  // Live update while dragging
  slider.addEventListener("input", () => {
    apply_volume_pct(slider.value);
  });

  // Also apply on change (some browsers)
  slider.addEventListener("change", () => {
    apply_volume_pct(slider.value);
  });

  // React to navigation
  window.addEventListener("vc:screenchange", on_screenchange);

  // Sync for initial screen
  on_screenchange();

  console.log("[settings_volume_ui] initialized");
}
