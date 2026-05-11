# PRD: Name Storm + Quick-Add Contact Flow

## Problem

The full ContactModal has 20+ fields and takes 2-3 minutes per contact. At the start of a support-raising trip, the user needs to brainstorm 100-200 names as fast as possible without breaking flow. Friction = fewer names on the list.

---

## Two-Phase UX Concept

### Phase 1 — Name Storm (Capture)

A dedicated "Name Storm" view or panel where the user enters names rapidly. Think of it as a whiteboard, not a form.

**Interaction model:**
- Single text input, always focused
- Type a name → press Enter or click Add → name appears in a running list below
- Category tag picker on the left (one click before or after typing): Family, Friend, Church Friend, Former Employer, etc. — drawn from `RELATIONSHIP_SUGGESTIONS`
- The tag pre-fills the Relationship field when the record is saved
- No other fields required at this stage
- Thought-provoker sidebar: collapsible list of category prompts ("Parents · Siblings · Former Professors · Neighbors…") to jog memory
- Couples/families handled via a small toggle on each row: "Add as couple/family" → adds an `organization` field inline (e.g. "Kevin & Sue Smith")

**What gets saved after Name Storm:**
- `first_name`, `last_name` (split from input), `relationship` (from tag), `organization` (if couple), linked to active trip via `contact_trips`
- Everything else is blank and filled in later via ContactModal

---

### Phase 2 — Backfill (Enrich)

After name storm, the user sees a list of "incomplete" contacts — ones missing address, phone, email, etc. They click to open the full ContactModal and fill in details over time.

An "incomplete" indicator (orange dot or %) in ContactsTable flags records that still need enrichment.

---

## Key Design Decisions

| Question | Decision |
|---|---|
| Where does Name Storm live? | New route/panel (`/namestorm`) or a modal triggered from ContactsTable — recommend **dedicated panel** so it doesn't feel cramped |
| Minimum required fields | First name only (or first + last) — last name nullable in DB already |
| Couple entry | Toggle per row → shows `organization` input; firstName/lastName remain the primary contact |
| Category tag | Single select from constrained list; drives `relationship` column |
| Active trip linking | Auto-links to active trip on save; if no active trip, prompt to create one first |
| Thought provokers | Collapsible sidebar with the category list; biblically framed intro ("Start with prayer…") but no gimmicks |
| Bulk save vs. per-name save | **Per-name save** (each Enter = DB insert) so a crash loses nothing; list grows in real time |

---

## Thought-Provoker Categories

| Group | Examples |
|---|---|
| Family | Parents, Siblings, Relatives, Grandparents |
| Friends | High school friends, College friends, Childhood friends |
| Church | Church friends, Sunday school class, Small group, Missions board |
| Work / School | Former employers, Coworkers, Teachers / Professors, Coaches |
| Community | Neighbors, Community leaders, Sports teammates |
| Parents' Network | Friends of parents, Parents of friends, Parents' employers |
| Lists | Christmas card list, Wedding guest list, Church directory |
| Ministry | Cru staff, Campus ministry contacts |

---

## Scope for This PR

1. `NameStorm` component — input + tag picker + running list + thought-provoker sidebar
2. Supabase insert on each Enter (contacts + contact_trips)
3. "Incomplete contact" indicator in ContactsTable
4. Unit tests: name parsing, couple toggle, empty-name block, Supabase error surface
5. E2E: add 3 names in name storm → verify they appear in ContactsTable

---

## Open Question

**Dedicated `/namestorm` route vs. panel/modal triggered from the contacts page.**

Lean toward a dedicated route so it feels like a focused session (sit down, brainstorm for 20 minutes, then return to normal workflow). If you want it always accessible inline, the panel approach works too.

---

## Out of Scope (Phase 2.5+)

- Post-mission letter status field (`post_trip_letter_sent`)
- AI-assisted letter drafting
- Address label export / response card printing
- Calling scripts / follow-up templates
