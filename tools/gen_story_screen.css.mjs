// tools/gen_story_screen_css.mjs
// Generates placeholder CSS for launcher_<storyId>.css and story_<storyId>.css
// - Skips files that already exist (won't overwrite Backrooms)
// - Creates styles/screens/ if missing
// Usage:
//   node tools/gen_story_screen_css.mjs

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "styles", "screens");

const STORY_IDS = [
  "backrooms",
  "timecop",
  "relic_of_cylara",
  "world_of_lorecraft",
  "oregon_trail",
  "wastelands",
  "tale_of_icarus",
  "crimson_seagull",
  "code_blue",
  "king_solomon",
  "cosmos",
  "dead_drop_protocol"
];

// Placeholder launcher art (frame)
const LAUNCHER_BG = "../../ui/global/ui/launcher-panel-background.webp";

// If you want a generic story background, keep black.
// Later you can swap to:
// const STORY_PANEL = `../../content/founders/packs/story-panels/${id}-narrative-panel.webp`;

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeIfMissing(filepath, content) {
  if (fs.existsSync(filepath)) {
    console.log("[skip]", path.relative(ROOT, filepath));
    return;
  }
  fs.writeFileSync(filepath, content, "utf8");
  console.log("[write]", path.relative(ROOT, filepath));
}

function launcherCss(id) {
  return `/* styles/screens/launcher_${id}.css */
.screen[data-screen="launcher_${id}"].is-active{
  background-image: url("${LAUNCHER_BG}");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-color:#000;
}

.screen[data-screen="launcher_${id}"]{ pointer-events:none; }
.screen[data-screen="launcher_${id}"] .hitbox-layer{ pointer-events:auto; }
`;
}

function storyCss(id) {
  return `/* styles/screens/story_${id}.css */
.screen[data-screen="story_${id}"].is-active{
  background-color:#000;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.screen[data-screen="story_${id}"]{ pointer-events:none; }
.screen[data-screen="story_${id}"] .hitbox-layer{ pointer-events:auto; }
`;
}

function main() {
  ensureDir(OUT_DIR);

  for (const id of STORY_IDS) {
    const launcherPath = path.join(OUT_DIR, `launcher_${id}.css`);
    const storyPath = path.join(OUT_DIR, `story_${id}.css`);

    writeIfMissing(launcherPath, launcherCss(id));
    writeIfMissing(storyPath, storyCss(id));
  }

  console.log("\nDone. Next: reload and verify BG is no longer 'none' on launcher_* screens.");
}

main();