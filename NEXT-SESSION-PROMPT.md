# Fresh start prompt — couples/household complexity decision

## Honest state of things

We've been going in circles. Here's what actually exists and what the real problem is.

### What we built (and what's now in the codebase)
- `household_members` table was added to Postgres (local + remote) in migration `20260511195103`
- `HouseholdMember` type added to `src/types.ts`
- `addHouseholdMember` added to `src/hooks/useContacts.ts`
- NameStorm now calls `addHouseholdMember` after saving a couple
- Duplicate/conflict detection in NameStorm uses `householdMembers[]` on Contact instead of regex-parsing `organization`
- All 212 tests pass

### The actual problem we were trying to solve
The user wants to send support-raising letters. Letters need correct salutations:
- Single person: "Dear Kevin,"
- Married couple: "Dear Kevin and Sue," or "Dear Kevin & Sue Smith,"
- Family: "Dear the Smith Family,"

Currently `organization` is a free-text field that sometimes contains couple display names like
"Kevin & Sue Smith" — but there's no structured way to know if a contact IS a couple vs. just has
an org name. This causes two issues:
1. Duplicate detection was guessing by regex-parsing the organization string (fragile)
2. AI letter drafting (Phase 2.5) needs to know the salutation format

### The question the user wants answered before coding anything more

**Should we keep it simple (flat model) or add structure (household model)?**

**Option A — Stay flat, add a "couple" flag and spouse field**
- Add `is_couple boolean` and `spouse_first_name text` columns to contacts
- `organization` continues to hold the display name ("Kevin & Sue Smith"), auto-generated
- Salutation auto-generates: if `is_couple`, use "Kevin and Sue"; else use first name
- No separate table. No foreign keys. Simple.
- Migration: small, non-breaking, easy to backfill existing data
- Tradeoff: no support for 3+ people (families, children), different last names are awkward

**Option B — Keep household_members table (what we just built)**
- Contact = primary person. Household members = everyone else attached.
- Salutation pulls from the members list
- Supports any combination: couple, family, different last names
- Tradeoff: more complex queries, existing data needs migration review, NameStorm workflow is slightly heavier

**Option C — Drop household_members, just use a smart salutation field**
- Keep contacts completely flat
- Add a single `salutation_override` text field
- NameStorm: when "couple" is checked, auto-suggest "Kevin and Sue" as the salutation
- AI letter drafting reads `salutation_override` if present, else falls back to first name
- Tradeoff: no structural data about who the second person is — but for letter writing, you may not need it

### The user's instinct
"Go back to the simple thing." The complexity of household_members may not be worth it for
a personal support-raising tool. A cheap AI call to generate the right salutation from
whatever is in the name fields might be more practical than a normalized schema.

### Recommended starting question for this chat
Ask the user: **"For letter writing, what do you actually need to know about a couple contact?
Just the salutation string, or do you need to look up Sue independently (e.g. to address her
separately)?"** — the answer determines whether Option A, B, or C is right.

### Files that matter
- `src/types.ts` — Contact interface (has `householdMembers?: HouseholdMember[]` added)
- `src/hooks/useContacts.ts` — has `addHouseholdMember` wired in
- `src/components/NameStorm.tsx` — couple save calls `addHouseholdMember`; conflict detection uses `householdMembers`
- `src/test/NameStorm.test.tsx` — 212 tests passing
- `supabase/migrations/20260511195103_add_household_members.sql` — already applied local + remote
- Memory files: `/Users/kyleg/.claude/projects/-Users-kyleg-Projects-Support-Raising/memory/`

### If the decision is to revert household_members
- Drop the table from local + remote (migration to `DROP TABLE household_members`)
- Remove `HouseholdMember` from `src/types.ts`
- Remove `addHouseholdMember` from `src/hooks/useContacts.ts`
- Remove `household_members(*)` from the contacts select query
- Revert NameStorm to not call `addHouseholdMember` (simple — just remove that call)
- Conflict detection in NameStorm needs to go back to checking `organization` string OR switch to Option A's `is_couple` + `spouse_first_name` fields
- Update tests accordingly

### Do NOT push anything to remote without explicit user confirmation.
### Always apply migrations to LOCAL (docker exec) first, verify, then ask before pushing remote.
