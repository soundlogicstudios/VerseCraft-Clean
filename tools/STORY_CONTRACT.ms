# VerseCraft Story Contract v1.0

This document defines the **canonical story authoring contract** for VerseCraft.
If a story follows this contract, it is guaranteed to work with the VerseCraft
engine, narrative panel, and UI shell without layout, scroll, or routing issues.

This contract is binding for all VerseCraft stories.

------------------------------------------------------------

SECTION 1 — CORE PRINCIPLES

• One story equals one JSON file  
• Stories are fully isolated from each other  
• No shared state, no DOM bleed, no cross-story references  
• All stories must scroll properly on mobile  
• All choices must be understandable before the player taps them  

------------------------------------------------------------

SECTION 2 — REQUIRED FILE STRUCTURE

Every story JSON MUST contain:

meta  
packId  
assets  
blurb  
start  
scenes  

Example shape (simplified):

{
  "meta": { ... },
  "packId": "story_pack_id",
  "assets": { ... },
  "blurb": "Short description",
  "start": "S01",
  "scenes": { ... }
}

------------------------------------------------------------

SECTION 3 — META OBJECT (REQUIRED)

meta must include:

title  
subtitle  
author  
version  
checkpoint  
buildTimestamp  

Example:

"meta": {
  "title": "World of Lorecraft: Ashes of the Everpath",
  "subtitle": "The World That Notices",
  "author": "Sound Logic Studios",
  "version": "1.1.0",
  "checkpoint": "S01–S30",
  "buildTimestamp": "2026-01-17T00:00:00Z"
}

------------------------------------------------------------

SECTION 4 — SCENE IDS

• Scene IDs MUST be formatted as: S01, S02, S03 … S30  
• IDs are case-sensitive  
• The start value MUST point to an existing scene  
• Every option target MUST point to a valid scene  

VALID:
S01
S10
S30

INVALID:
S1
S001
scene01

------------------------------------------------------------

SECTION 5 — SCENE STRUCTURE

Each scene MUST contain:

text  
options  

Example:

"S01": {
  "text": "Narrative text here",
  "options": [
    { "label": "Enter", "to": "S02" },
    { "label": "Observe", "to": "S03" }
  ]
}

------------------------------------------------------------

SECTION 6 — TEXT FORMATTING (ENGINE SAFE)

The engine currently treats text as **plain text**.

DO NOT use HTML.
DO NOT rely on Markdown rendering.

PARAGRAPHS  
• New paragraph = \n\n  
• Single line break = \n (use sparingly)

------------------------------------------------------------

SECTION 7 — TITLE BLOCK (S01 ONLY)

The opening scene MUST begin with a title block.

Format exactly like this:

STORY TITLE  
Subtitle  
Tagline (optional)  

<blank line>  
Narrative text begins here.

Example:

WORLD OF LORECRAFT  
Ashes of the Everpath  
The World That Notices  

Lanterns hover like tame stars...

------------------------------------------------------------

SECTION 8 — EMPHASIS RULES (v1)

Since markup is not parsed yet:

• Use ALL CAPS sparingly  
• Use quotation marks  
• Use short declarative sentences  

Example:

You feel the Archive notice you.

“Names have weight here.”

------------------------------------------------------------

SECTION 9 — CHOICE DESIGN (CRITICAL)

PILL LABEL RULES:

• Short only  
• 1–3 words  
• Verb-first  
• No punctuation  

GOOD:
Enter  
Listen  
Take Key  

BAD:
Run into the fog and check for danger  

------------------------------------------------------------

SECTION 10 — WHERE CHOICE MEANING LIVES

ALL choice explanation must be in the narrative text,
NOT on the pill buttons.

Each scene MUST end with a choice explanation block.

Required format:

At the end of the page, you weigh your options:
– Long explanation of choice 1
– Long explanation of choice 2
– Long explanation of choice 3
– Optional explanation of choice 4

This is mandatory.

------------------------------------------------------------

SECTION 11 — STORY LENGTH & SCROLLING

• Stories must include enough prose to require scrolling  
• Short scenes are discouraged  
• This validates narrative window behavior and layout  

------------------------------------------------------------

SECTION 12 — ENDINGS (CANON MODEL)

Each story MUST include exactly:

• 1 Good Ending  
• 1 Bad Ending  
• 1 Special Ending  

Typical mapping:

S28 → Good Ending  
S29 → Bad Ending  
S30 → Special Ending  

------------------------------------------------------------

SECTION 13 — ENDING BEHAVIOR

• Endings must feel resolved  
• Endings must loop safely  
• Default loop target is S01  

Example:

{
  "label": "Restart",
  "to": "S01"
}

------------------------------------------------------------

SECTION 14 — DEBUG & PLAYER SAFETY

• Debug UI is never player-facing  
• Debug tools may exist behind ?debug=1  
• Story JSON must never depend on debug features  

------------------------------------------------------------

SECTION 15 — CANON COMPLIANCE

A story is VerseCraft-compliant if it:

• Follows this contract  
• Scrolls correctly  
• Routes without errors  
• Uses short pill labels + narrative explanations  

Compliant stories are eligible for:
• Packaging
• Distribution
• Monetization
• Long-term engine support

------------------------------------------------------------

END OF CONTRACT
