# VerseCraft Story Contract v1.0  
**Canonical Authoring & Runtime Compatibility Specification**

_Last updated: 2026-01-29_

---

## 1. Purpose

This document defines the **official story authoring contract** for VerseCraft.  
Any story that complies with this contract is guaranteed to:

- Render correctly in the VerseCraft narrative panel
- Scroll correctly on iOS Safari
- Display readable choice pills
- Route cleanly without DOM or state leakage
- Remain forward-compatible with future VerseCraft engines

This contract applies to **all story JSON files**.

---

## 2. File Scope & Isolation

- **One story = one JSON file**
- Stories must be fully self-contained
- No shared state between stories
- No cross-story scene references

Each story is loaded by `storyId` and executed in isolation.

---

## 3. Required Top-Level Structure

```json
{
  "meta": { ... },
  "packId": "string",
  "assets": { ... },
  "blurb": "string",
  "start": "S01",
  "scenes": { ... }
}
