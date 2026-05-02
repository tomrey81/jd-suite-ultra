# JD Dashboard UI/UX Audit

**Date:** 2026-05-01
**Component:** `apps/web/components/workspace/workspace-view.tsx`
**Route:** `/` (authenticated dashboard)
**Status:** Pre-improvement baseline

---

## Summary

The current JD dashboard is functionally complete but has several presentation-layer issues that reduce usability for professional HR users. The core interaction model (folder sidebar + table + inline edits) is sound and should be preserved. The problems are primarily typographic, visual hierarchy, and interaction discoverability.

**Score before improvements:** 5/10 UX, 4/10 visual design, 7/10 functionality

---

## Findings

### 1. Typography — Critical

- **All body text is 9–11px** (`text-[9px]`, `text-[10px]`, `text-[11px]`). This is below comfortable reading size for dense data work.
- Minimum readable size for dense tables is 12px; 13px is preferred.
- Column headers at `text-[9px]` are difficult to scan at a glance.
- Impact: eye strain, reduced scan speed, inaccessible to users with low vision.

### 2. Status Column — High

- Status is rendered as a native `<select>` element styled with background colour.
- The native select chrome overrides brand styling on macOS/Windows.
- Colour-coding exists (gold=Draft, amber=Revision, green=Approved, grey=Archived) but lacks visual weight.
- No icon or shape cue — colour is the only differentiator (WCAG 1.4.1 non-conformance risk).

### 3. Action Discoverability — High

- Row actions (Edit, Copy, Career Path, Trash) are `opacity-0` and only appear on `group-hover`.
- On touch devices with no hover, actions are completely hidden.
- First-time users cannot discover actions without accidentally hovering.
- "Edit" action links to the JD detail page — this is a primary action and should be always-visible.

### 4. Bulk Actions — Medium

- Bulk action is a small dropdown button in the toolbar area (`Actions (N) ▾`).
- The button only appears after selection — no affordance that bulk actions exist.
- Dropdown is anchored to toolbar rather than being contextual to the selected rows.

### 5. Search Input — Medium

- Search input is `w-[140px]` (140px wide), truncating placeholder text.
- No search icon — users may not recognise the field as a search affordance.
- No clear/reset button when text is present.

### 6. Sidebar — Medium

- "Folders" label is `text-[9px]` uppercase — barely visible.
- Special items (Career Paths, Trash) use emoji only — inconsistent visual weight.
- No visual separator weight between folder list and special views.
- Active folder state uses `bg-brand-gold-light` but no left-border accent.

### 7. Empty States — Low–Medium

- Empty state is a single emoji + one line of text (`text-xs text-text-muted`).
- No call-to-action button — user must navigate to toolbar "New JD" to proceed.
- Trash empty state is fine (intentionally minimal), but folder/all empty state needs an action.

### 8. Table Visual Hierarchy — Low

- Table rows are `py-1.5` — very compact, reducing target hit area.
- No row striping or hover-state differentiation beyond `hover:bg-surface-page`.
- Checkbox column (`w-8`) is tight; native checkbox styling varies by OS.
- No visual grouping of meta columns (Date/By) vs primary columns (Title/Status).

### 9. Responsiveness — Low

- Table has `min-w-[700px]` which causes horizontal scroll below 870px.
- Sidebar is fixed at 170px with no collapse affordance.
- No responsive breakpoint collapses non-essential columns on smaller viewports.

---

## What Is Working Well

- Folder-based navigation is intuitive and persistent.
- Inline title editing with keyboard support (Enter/Escape) is smooth.
- Sort by any column with direction toggle is standard and functional.
- Bulk status + folder reassignment covers the primary admin use case.
- Status colour coding is semantically consistent.
- Career family system and path cards are a strong differentiator.

---

## Improvement Plan

| Priority | Change | Impact |
|----------|--------|--------|
| P0 | Increase base font to 12–13px across table | Readability |
| P0 | Column headers 11px bold uppercase | Scannability |
| P1 | Status: custom badge with icon, keep select interaction | Visual clarity |
| P1 | Row actions: reduce opacity-0 → opacity-40, full on hover | Discoverability |
| P1 | Search: widen to 240px, add search icon + clear button | UX |
| P1 | Bulk: slide-in bottom bar when items selected | Contextual |
| P2 | Sidebar: larger text, left-border active accent, icons | Hierarchy |
| P2 | Empty state: add primary CTA button | Guidance |
| P2 | Row height: py-2.5 for comfortable click targets | Accessibility |
| P3 | Sidebar collapse button for narrower viewports | Responsiveness |

---

## Known Constraints

- All existing functionality must be preserved unchanged.
- No new Prisma fields or API changes.
- Feature flags are not involved in this view.
- Must not introduce new npm packages.
