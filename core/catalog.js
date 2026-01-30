// src/core/catalog.js
// VerseCraft Catalog Resolver (Pack-based, derived paths)
//
// Loads: ./content/catalog/catalog.json
// Provides: resolve_story(storyId) -> { storyId, packId, storyJsonUrl, coverUrl }
//
// PERFORMANCE:
// - Uses normal caching by default (cache: "default")
// - Debug: add ?nocache=1 to force cache: "no-store"

let _catalog = null;
let _index = null;
let _loading = null;

const CATALOG_URL = "./content/catalog/catalog.json";

function cache_mode() {
  const params = new URLSearchParams(location.search);
  return params.has("nocache") ? "no-store" : "default";
}

function norm_join(a, b) {
  const left = String(a || "").trim().replace(/\/+$/, "");
  const right = String(b || "").trim().replace(/^\/+/, "");
  if (!left) return right;
  if (!right) return left;
  return `${left}/${right}`;
}

async function safe_fetch_json(url) {
  try {
    const res = await fetch(url, { cache: cache_mode() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn("[catalog] failed to load json:", url, e);
    return null;
  }
}

function build_index(catalog) {
  const idx = new Map();

  const packs = Array.isArray(catalog?.packs) ? catalog.packs : [];
  packs.forEach((pack) => {
    const packId = pack?.packId || "";
    const root = pack?.root || "";
    const stories = Array.isArray(pack?.stories) ? pack.stories : [];

    stories.forEach((s) => {
      const id = String(s?.id || "").trim();
      if (!id) return;

      const storyJsonRel = s?.storyJson || "";
      const coverRel = s?.cover || "";

      const storyJsonUrl = storyJsonRel ? norm_join(root, storyJsonRel) : "";
      const coverUrl = coverRel ? norm_join(root, coverRel) : "";

      idx.set(id, {
        storyId: id,
        packId,
        root,
        storyJsonUrl,
        coverUrl
      });
    });
  });

  return idx;
}

export async function preload_catalog() {
  if (_catalog && _index) return true;
  if (_loading) return _loading;

  _loading = (async () => {
    const data = await safe_fetch_json(CATALOG_URL);
    if (!data) {
      _catalog = null;
      _index = null;
      return false;
    }

    _catalog = data;
    _index = build_index(data);
    return true;
  })();

  const ok = await _loading;
  _loading = null;
  return ok;
}

export async function resolve_story(storyId) {
  const id = String(storyId || "").trim();
  if (!id) return null;

  if (!_catalog || !_index) {
    await preload_catalog();
  }
  if (!_index) return null;

  return _index.get(id) || null;
}

export function get_catalog_url() {
  return CATALOG_URL;
}
