// core/launcher_labels.js
// Phase 2B — Launcher static labels (HITBOX-BOUND) + Phase B polish
// - Positions derived from actual hitbox geometry (getBoundingClientRect)
// - Adds subtle scrims behind text for readability
// - Makes START label bigger
// - Centers "Back To Library" text
// Overlay-only. Does NOT touch navigation or hitboxes.

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
  dead_drop_protocol: "Dead Drop Protocol"
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

function style_box(el, boxPct) {
  el.style.position = "absolute";
  el.style.left = `${boxPct.left}%`;
  el.style.top = `${boxPct.top}%`;
  el.style.width = `${boxPct.width}%`;
  el.style.height = `${boxPct.height}%`;
}

function make_scrim(boxPct, opts = {}) {
  const scrim = document.createElement("div");
  scrim.className = "launcher-scrim";

  style_box(scrim, boxPct);

  // Subtle padding so scrim extends slightly beyond the text bounds
  const pad = opts.padPct ?? 0.6; // percent of screen height/width-ish; small + safe
  scrim.style.transform = `translate(-${pad}%, -${pad}%)`;
  scrim.style.width = `calc(${boxPct.width}% + ${pad * 2}%)`;
  scrim.style.height = `calc(${boxPct.height}% + ${pad * 2}%)`;

  scrim.style.pointerEvents = "none";
  scrim.style.background = opts.bg || "rgba(0,0,0,0.38)";
  scrim.style.borderRadius = opts.radius || "10px";

  // Keep it behind the label text
  scrim.style.zIndex = "0";

  return scrim;
}

function style_label(el, boxPct, opts = {}) {
  style_box(el, boxPct);

  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.pointerEvents = "none";
  el.style.textAlign = "center";

  el.style.color = "rgba(255,255,255,0.96)";
  el.style.textShadow = "0 2px 6px rgba(0,0,0,0.75)";
  el.style.fontWeight = opts.weight || "900";
  el.style.letterSpacing = "0.02em";
  el.style.whiteSpace = "nowrap";

  el.style.fontSize = opts.fontSize || "clamp(14px, 2.2vh, 26px)";

  // Ensure the label appears above its scrim
  el.style.zIndex = "1";
}

function render_launcher_labels(screen_id) {
  const screen_el = get_active_screen_el(screen_id);
  if (!screen_el) return;

  const screen_rect = screen_el.getBoundingClientRect();
  if (!screen_rect.width || !screen_rect.height) return;

  const layer = ensure_ui_layer(screen_el);
  layer.innerHTML = "";

  // Make sure the layer itself establishes a stacking context
  layer.style.position = "absolute";
  layer.style.inset = "0";
  layer.style.pointerEvents = "none";

  const story_id = story_id_from_launcher(screen_id);

  // ---- TITLE (safe default box) ----
  const titleBox = { left: 12, top: 12, width: 76, height: 8 };

  const titleScrim = make_scrim(titleBox, {
    bg: "rgba(0,0,0,0.34)",
    radius: "12px",
    padPct: 0.8
  });

  const title = document.createElement("div");
  title.className = "launcher-label launcher-title";
  title.textContent = get_title(story_id);
  style_label(title, titleBox, {
    fontSize: "clamp(18px, 3vh, 34px)",
    weight: "950"
  });

  // Add scrim then label
  layer.appendChild(titleScrim);
  layer.appendChild(title);

  // ---- HITBOX-BOUND BUTTON LABELS ----
  const hbBack = find_hitbox(screen_el, "back");
  const hbStart = find_hitbox(screen_el, "start");
  const hbContinue = find_hitbox(screen_el, "continue");

  if (hbBack) {
    const r = hbBack.getBoundingClientRect();
    const pct = rect_to_pct(screen_rect, r);

    const scrim = make_scrim(pct, {
      bg: "rgba(0,0,0,0.30)",
      radius: "10px",
      padPct: 0.6
    });

    const back = document.createElement("div");
    back.className = "launcher-label launcher-back";
    back.textContent = "Back To Library";

    // Center it (you asked specifically)
    style_label(back, pct, {
      fontSize: "clamp(14px, 2.0vh, 22px)",
      weight: "900"
    });

    layer.appendChild(scrim);
    layer.appendChild(back);
  } else {
    console.warn("[launcher_labels] back hitbox not found (data-hitbox-id contains 'back')");
  }

  if (hbStart) {
    const r = hbStart.getBoundingClientRect();
    const pct = rect_to_pct(screen_rect, r);

    const scrim = make_scrim(pct, {
      bg: "rgba(0,0,0,0.34)",
      radius: "12px",
      padPct: 0.7
    });

    const start = document.createElement("div");
    start.className = "launcher-label launcher-start";
    start.textContent = "Start";

    // Make START bigger (your request)
    style_label(start, pct, {
      fontSize: "clamp(18px, 2.8vh, 34px)",
      weight: "950"
    });

    layer.appendChild(scrim);
    layer.appendChild(start);
  } else {
    console.warn("[launcher_labels] start hitbox not found (data-hitbox-id contains 'start')");
  }

  if (hbContinue) {
    const r = hbContinue.getBoundingClientRect();
    const pct = rect_to_pct(screen_rect, r);

    const scrim = make_scrim(pct, {
      bg: "rgba(0,0,0,0.30)",
      radius: "12px",
      padPct: 0.7
    });

    const cont = document.createElement("div");
    cont.className = "launcher-label launcher-continue";
    cont.textContent = "Continue";

    style_label(cont, pct, {
      fontSize: "clamp(16px, 2.4vh, 28px)",
      weight: "900"
    });

    layer.appendChild(scrim);
    layer.appendChild(cont);
  } else {
    console.warn("[launcher_labels] continue hitbox not found (data-hitbox-id contains 'continue')");
  }
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
