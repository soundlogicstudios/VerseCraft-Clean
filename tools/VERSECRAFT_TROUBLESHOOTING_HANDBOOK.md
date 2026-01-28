# VerseCraft Troubleshooting Handbook
Locked-LKG Friendly · iOS Safe · Hitbox / Screen Driven

Purpose:
This document is a step-by-step troubleshooting checklist for diagnosing and fixing
VerseCraft build issues without guesswork or regressions.

Use this EVERY time something breaks.

----------------------------------------------------------------
FIRST RULE (ALWAYS)
----------------------------------------------------------------

When something breaks, STOP and classify the failure first.

Ask ONE question:

Is this a:
1) Navigation problem
2) Visual / UI problem
3) State / Audio problem

Do NOT start changing files until you know which category you are in.

================================================================
1) NAVIGATION FAILURES
(Screen does not change, wrong screen, black screen)
================================================================

Checklist:
- Is the target screen listed in sec/screen_registry.json?
- Does the screen ID EXACTLY match (case + underscores)?
- Does index.html contain:

  <section class="screen" data-screen="screen_id">
    <div class="hitbox-layer"></div>
  </section>

- Is a CSS file defined for the screen in the registry?
- Does that CSS file exist at the exact path?
- Does the hitbox JSON file exist?

Debug:
- Load with ?=debug1
- Check console for:
  [screen-manager] unknown screen
  [screen-manager] missing screen element

Common Causes:
- Typo in screen ID (extra space, underscore mismatch)
- Screen added to registry but not index.html
- CSS path typo
- Missing .hitbox-layer

================================================================
2) HITBOX FAILURES
(Taps don’t work, wrong action, invisible hitboxes)
================================================================

Checklist:
- Hitbox JSON file loads (no 404 in Network tab)
- JSON has a "hitboxes" array
- Each hitbox has:
  - id
  - x, y, w, h
  - action
  - arg
- Screen contains .hitbox-layer
- Screen CSS does NOT disable pointer-events on .hitbox-layer

Debug:
- Enable cyan hitboxes (debug UI)
- Run in console:
  document.querySelectorAll(".hitbox")

Common Causes:
- pointer-events: none applied to .screen or .hitbox-layer
- .hitbox-layer missing
- Wrong target screen in "arg"
- Percentage values outside viewport (e.g. y: 110)

================================================================
3) LABEL FAILURES
(Hitboxes work, but text labels disappear)
================================================================

Checklist:
- Labels are injected into .ui-layer (NOT .hitbox-layer)
- Label JS module is imported in bootstrap.js
- Label CSS class exists
- Hitbox IDs match label-mapper IDs

Debug:
- Run:
  document.querySelectorAll(".story-exit-label")

Results:
- Empty array → label injector never ran
- Elements exist but invisible → CSS problem

Common Causes:
- Label module not imported
- Wrong filename or export name
- base.css overwritten
- Labels attached to .hitbox-layer (wiped on screen change)

================================================================
4) AUDIO FAILURES
(Music doesn’t play, stops unexpectedly, won’t resume)
================================================================

Checklist:
- init_audio_manager() is called in bootstrap.js
- User tapped once (iOS unlock)
- Screen ID exists in SCREEN_TO_TRACK
- Audio file path matches EXACTLY (case + spaces)
- Audio should NOT stop on character/inventory

Debug:
- Run:
  VC_AUDIO_STATUS()

Check:
- unlocked === true
- fetch.ok === true
- paused === false

Common Causes:
- STOP_WHEN_UNMAPPED = true
- Screen ID mismatch
- File name mismatch (spaces matter)
- Audio init removed accidentally

================================================================
5) CSS / LAYOUT REGRESSIONS
(Everything moved, buttons tiny, scrim missing)
================================================================

Checklist:
- Was base.css fully replaced?
- Was .ui-layer styling removed?
- Did a screen CSS add pointer-events: none incorrectly?
- Did styles target .screen instead of a specific screen?

Debug:
- Inspect element
- Check computed styles for:
  - position
  - pointer-events
  - z-index

Common Causes:
- Inline styles overriding percentages
- Full CSS replacement instead of additive
- Shared class reused across screens

================================================================
6) STORY PANEL SPECIFIC FAILURES
(Exit / Character / Inventory behaving incorrectly)
================================================================

Checklist:
- Story screen has its own hitbox JSON
- Hitbox IDs are consistent:
  - exit_story
  - open_character
  - open_inventory
- Character / Inventory screens exist
- Audio persists when entering them

Common Causes:
- Using launcher hitboxes on story panels
- Audio stopping on unmapped screens
- Label mapper looking for wrong IDs

================================================================
7) WHEN TO ROLL BACK (IMPORTANT)
================================================================

Immediately roll back if:
- Navigation breaks across multiple screens
- Audio AND labels break at the same time
- Scrim and buttons disappear together

This indicates shared infrastructure damage.

================================================================
8) SAFE CHANGE ORDER (LOCK THIS)
================================================================

When adding ANY feature, follow this order:

1) Screen exists in registry + index.html
2) Background renders
3) Hitboxes appear
4) Hitboxes navigate correctly
5) Labels added
6) Audio added
7) Visual polish

Never skip steps.

================================================================
9) ONE-SCREEN RULE
================================================================

Only modify ONE screen at a time.

If multiple screens are changed:
- Cause cannot be isolated
- Debug time multiplies

================================================================
10) EMERGENCY DIAGNOSTIC COMMANDS
================================================================

document.body.dataset.screen

document.querySelector(".screen.is-active")

document.querySelectorAll(".hitbox")

VC_AUDIO_STATUS()

================================================================
END OF DOCUMENT
================================================================
