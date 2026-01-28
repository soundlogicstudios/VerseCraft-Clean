(async function VC_SANITY() {
  const out = {
    time: new Date().toISOString(),
    location: { href: location.href, hash: location.hash || "", search: location.search || "" },
    screen: {},
    dom: {},
    files: {},
    hitboxes: {},
    labels: {},
    audio: {},
    notes: []
  };

  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => Array.from(r.querySelectorAll(s));

  function getActiveScreenId() {
    return (
      document.body?.dataset?.screen ||
      document.documentElement?.getAttribute?.("data-screen") ||
      (location.hash || "").replace("#", "") ||
      ""
    );
  }

  function safeRect(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  }

  async function fetchStatus(path) {
    if (!path) return null;
    try {
      const res = await fetch(path, { cache: "no-store" });
      return { path, ok: res.ok, status: res.status };
    } catch (e) {
      return { path, ok: false, status: "fetch_error", error: String(e?.message || e) };
    }
  }

  // DOM: active screen + hitbox layer
  const activeScreenId = getActiveScreenId();
  const activeScreenEl = q('.screen.is-active') || q(`.screen[data-screen="${activeScreenId}"]`) || null;
  const hitboxLayer = activeScreenEl?.querySelector(".hitbox-layer") || null;

  out.screen = {
    id: activeScreenId,
    activeScreenElFound: !!activeScreenEl
  };

  if (!activeScreenEl) {
    out.notes.push("No active screen element found. Possible registry/index.html mismatch or screen-manager not running.");
  }

  out.dom = {
    activeScreenSelector: activeScreenEl ? `.screen[data-screen="${activeScreenEl.dataset.screen}"]` : null,
    activeScreenRect: safeRect(activeScreenEl),
    hitboxLayerFound: !!hitboxLayer,
    hitboxLayerRect: safeRect(hitboxLayer),
    hitboxLayerPointerEvents: hitboxLayer ? getComputedStyle(hitboxLayer).pointerEvents : null,
    hitboxLayerZIndex: hitboxLayer ? getComputedStyle(hitboxLayer).zIndex : null
  };

  // Registry: load and validate file paths for current screen
  let reg = null;
  try {
    reg = await (await fetch("./sec/screen_registry.json", { cache: "no-store" })).json();
    out.files.registryLoaded = true;
  } catch (e) {
    out.files.registryLoaded = false;
    out.files.registryError = String(e?.message || e);
    out.notes.push("Failed to load ./sec/screen_registry.json (path/casing or deploy issue).");
  }

  const cfg = reg?.screens?.[activeScreenId] || null;
  out.screen.inRegistry = !!cfg;

  if (!cfg) {
    out.notes.push(`Active screen "${activeScreenId}" not found in screen_registry.json.`);
  }

  const cssPath = cfg?.css ? `./${String(cfg.css).replace(/^\.?\//, "")}` : null;
  const hitPath = cfg?.hitboxes ? `./${String(cfg.hitboxes).replace(/^\.?\//, "")}` : null;

  out.files.css = await fetchStatus(cssPath);
  out.files.hitboxes = await fetchStatus(hitPath);

  // Hitboxes: count + first few
  const hitboxes = activeScreenEl ? qa(".hitbox", activeScreenEl) : [];
  out.hitboxes.count = hitboxes.length;
  out.hitboxes.sample = hitboxes.slice(0, 6).map((hb) => ({
    id: hb.dataset.hitboxId || hb.getAttribute("data-hitbox-id") || hb.getAttribute("aria-label") || "",
    action: hb.dataset.action || "",
    arg: hb.dataset.arg || "",
    rect: safeRect(hb),
    inline: { left: hb.style.left, top: hb.style.top, width: hb.style.width, height: hb.style.height }
  }));

  if (!hitboxLayer) out.notes.push("No .hitbox-layer found inside active screen (hitboxes cannot render).");
  if (hitboxLayer && hitboxes.length === 0) out.notes.push("Hitbox layer exists but there are 0 hitboxes (hitbox JSON empty, not loading, or apply_hitboxes failing).");

  // Labels: generic counts (won't error if you rename classes later)
  const uiLayer = activeScreenEl?.querySelector(".ui-layer") || null;
  out.labels.uiLayerFound = !!uiLayer;
  out.labels.storyExitLabels = activeScreenEl ? qa(".story-exit-label", activeScreenEl).length : 0;
  out.labels.launcherLabels = activeScreenEl ? qa(".launcher-label", activeScreenEl).length : 0;
  out.labels.libraryRowTitles = activeScreenEl ? qa(".library-row-title", activeScreenEl).length : 0;

  // Audio: if helper exists
  if (typeof window.VC_AUDIO_STATUS === "function") {
    try {
      out.audio = window.VC_AUDIO_STATUS();
    } catch (e) {
      out.audio = { error: String(e?.message || e) };
      out.notes.push("VC_AUDIO_STATUS() exists but threw an error.");
    }
  } else {
    out.audio = { present: false };
    out.notes.push("VC_AUDIO_STATUS() not found (audio_manager not initialized or not deployed).");
  }

  // Display
  console.groupCollapsed(`VC_SANITY: ${activeScreenId || "(no screen id)"}`);
  console.log(out);
  console.groupEnd();

  // Helpful, loud one-liners
  if (out.files.css && out.files.css.ok === false) console.warn("CSS fetch failed:", out.files.css);
  if (out.files.hitboxes && out.files.hitboxes.ok === false) console.warn("Hitboxes JSON fetch failed:", out.files.hitboxes);
  if (out.screen.inRegistry === false) console.warn("Active screen missing from registry:", activeScreenId);
  if (out.hitboxes.count === 0) console.warn("0 hitboxes on active screen:", activeScreenId);

  return out;
})();
