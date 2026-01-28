
START OF DOCUMENT

VERSECRAFT – TROUBLESHOOTING AND BUILD OPS HANDBOOK
Repo baseline: VerseCraft-Clean-main
Workflow: LKG locked, additive-only
Rule: paths and casing are contracts

==================================================

CORE SYSTEM MODEL (READ FIRST)

Every VerseCraft screen must satisfy ALL of the following or things will break.
	1.	The screen exists in index.html as a section with data-screen.
	2.	The screen is registered in sec/screen_registry.json.
	3.	The screen has a hitbox JSON file and a hitbox-layer div.
	4.	Optional overlays (labels, audio, debug) attach after screenchange.

If any one of these is missing or mismatched, you will see black screens, missing hitboxes, missing labels, or missing audio.

==================================================

ADDING A NEW SCREEN (ANY TYPE)

Files that MUST exist:

index.html
You must add a section like this:


<section class="screen" data-screen="screen_id">
  <div class="hitbox-layer"></div>
</section>

sec/screen_registry.json
You must add an entry like this:

“screen_id”: {
“css”: “styles/screens/screen_id.css”,
“hitboxes”: “content/hitboxes/screen_id.json”,
“controller”: null
}

styles/screens/screen_id.css
The CSS file must exist and load.

content/hitboxes/screen_id.json
The hitbox file must exist even if it is empty.

Common screen failures:

Black screen
Screen is in registry but missing from index.html.

No hitboxes
The hitbox-layer div is missing or the hitbox JSON path is wrong.

Touches not working
Screen has pointer-events:none and the hitbox-layer was not re-enabled.

==================================================

ADDING A STORY (FULL PIPELINE)

Example story id: world_of_lorecraft

Required screens:

launcher_world_of_lorecraft
story_world_of_lorecraft

Required files:

Launcher CSS
styles/screens/launcher_world_of_lorecraft.css

Launcher hitboxes
content/hitboxes/launcher_world_of_lorecraft.json

Story CSS
styles/screens/story_world_of_lorecraft.css

Story hitboxes
content/hitboxes/story_world_of_lorecraft.json

Registry entries
sec/screen_registry.json must include both launcher and story.

Story content JSON
content/packs/**/stories/world_of_lorecraft.json

Story panel art
content/packs/**/story-panels/world-of-lorecraft-narrative-panel.webp

Common story failures:

Launcher loads but Start does nothing
The start hitbox arg does not match the story screen id.

Story loads but no background
CSS background-image path is wrong or casing does not match.

Hitboxes visible in debug but labels missing
Label overlay is not attaching or hitbox IDs changed.

==================================================

HITBOXES (SOURCE OF TRUTH)

All hitboxes live in content/hitboxes/*.json.

Hitboxes are rendered ONLY by core/screen-manager.js in apply_hitboxes().

Rules for hitboxes:

Hitbox IDs are contracts, not cosmetic.
Percent values are applied directly as inline styles.
Hitboxes are buttons, not divs.
Hitboxes are destroyed and recreated on every screen change.

Canonical story hitbox IDs:

exit_story
open_character
open_inventory

If these IDs change, labels and audio logic will break.

==================================================

LABELS (WHY THEY DISAPPEAR)

Label modules:

Library labels live in core/library_labels.js.
Launcher labels live in core/launcher_labels.js.
Story labels live in core/story_exit_label.js.

Hard rule:

Labels must NEVER be placed inside the hitbox-layer.

Reason:

The hitbox-layer is cleared and rebuilt on every screen change.
Anything inside it will be destroyed.

Correct structure:

.screen
.hitbox-layer (pointer-events enabled)
.ui-layer (pointer-events none)
labels live inside ui-layer

Why labels disappear:

ui-layer not recreated after screen change.
Hitbox IDs do not match expected IDs.
Screen CSS disables pointer events globally.
A JS module errors before attaching to vc:screenchange.

Quick debug checks (console):

document.querySelector(”.ui-layer”)
document.querySelectorAll(”.story-exit-label”)

==================================================

AUDIO SYSTEM (GLOBAL BGM)

Source of truth: core/audio_manager.js

Audio file location contract:

content/audio/packs/{founders or starter}/{story_id}/{story_id}_theme.mp3

Audio flow:

screenchange event
screen_id resolved
SCREEN_TO_TRACK mapping
TRACKS path selected
audio src updated

Common audio failures:

Music does not play
screen_id is not mapped in SCREEN_TO_TRACK.

Music stops unexpectedly
STOP_WHEN_UNMAPPED is true and next screen is unmapped.

iOS silent audio
Audio not unlocked by a user gesture.

Fetch errors
Filename mismatch due to spaces, hyphens, or underscores.

Debug command:

VC_AUDIO_STATUS()

Check the following:

last.fetch.ok is true
audio.paused is false
current_src matches expected path

==================================================

CHARACTER AND INVENTORY PLACEHOLDERS

Current design is correct.

Global placeholder screens:

styles/screens/character.css
styles/screens/inventory.css
content/hitboxes/character.json
content/hitboxes/inventory.json
ui/global/ui/under-construction.webp

Navigation rule:

Enter from a story screen.
Exit returns to the originating story screen.
Story-specific versions will be added later.

==================================================

DEBUG SYSTEM (WHAT IS SAFE AND WHAT IS NOT)

Safe debug features:

Cyan hitbox overlay.
Hitbox rectangle inspection.
Screen audit tools.

Dangerous debug features:

Painting hitboxes.
Debug UI elements with pointer-events enabled.
Injecting elements into hitbox-layer.

If something breaks:

Disable debug.
Reload.
Test without debug.
Re-enable debug after confirming stability.

==================================================

FULL RECOVERY CHECKLIST (USE THIS WHEN EVERYTHING BREAKS)
	1.	Hard refresh and clear cache.
	2.	Confirm correct branch and deployment.
	3.	Load with ?debug=1.
	4.	Verify the screen exists in index.html.
	5.	Verify the screen exists in screen_registry.json.
	6.	Verify the hitbox JSON fetches successfully.
	7.	Verify the CSS background loads.
	8.	Verify label modules are attached.
	9.	Run VC_AUDIO_STATUS().

==================================================

GOLDEN RULES

Never remove the hitbox-layer.
Never place labels inside the hitbox-layer.
Never casually change casing.
Every screen requires at least four files.
If it worked before, diff before touching anything.

END OF DOCUMENT
