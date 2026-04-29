# Tokyo Mission — Support Raising Tracker

A personal support-tracking app for missionaries. Contacts, pledge status, mailing workflow, and fundraising goals — all in one place.

**Stack:** Vite + React + Tailwind (frontend) · Express + Node (API) · Postgres 16 (database) · Docker Compose

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes `docker compose`)
- Node.js 22+ (for running migrations and seed scripts outside Docker)
- `openssl` (for generating secrets — available on macOS/Linux by default)
- Optional: [Bitwarden Secrets Manager CLI (`bws`)](https://bitwarden.com/help/secrets-manager-cli/) if using Bitwarden instead of a `.env` file

---

## First-time setup

### Option A — `.env` file (simplest)

**1. Copy the env template:**
```bash
cp .env.example .env
```

**2. Generate secret values:**
```bash
openssl rand -hex 32   # run twice — once for POSTGRES_PASSWORD, once for API_KEY
```

**3. Fill in `.env`:**
```
POSTGRES_PASSWORD=<generated value>
API_KEY=<generated value>
VITE_API_KEY=<same value as API_KEY>
LOCAL_USER_EMAIL=local@localhost
LOCAL_USER_ID=   # fill in after step 6
```

**4. Start Postgres only:**
```bash
docker compose up -d db
```

**5. Run the database migration (creates all tables):**
```bash
DATABASE_URL=postgres://postgres:<POSTGRES_PASSWORD>@localhost:5432/support_raising \
  node api/migrate.js
```

**6. Seed your contacts from a CSV export:**
```bash
DATABASE_URL=postgres://postgres:<POSTGRES_PASSWORD>@localhost:5432/support_raising \
  node api/seed.js /path/to/contacts-export.csv
```

**7. Get the user UUID that was created:**
```bash
docker compose exec db psql -U postgres support_raising -c "SELECT id FROM users;"
```
Paste the UUID into `LOCAL_USER_ID=` in your `.env`.

**8. Start everything:**
```bash
docker compose up
```

App: http://localhost:5173  
API: http://localhost:3001

---

### Option B — Bitwarden Secrets Manager (recommended for production or shared machines)

Bitwarden Secrets Manager stores secrets in your Bitwarden vault and injects them as environment variables at runtime. Nothing sensitive ever lives in a file on disk.

**How it works:** The `bws run` command authenticates with a machine account access token (the one non-sensitive value you still need locally), fetches all secrets from your Bitwarden project, injects them as environment variables, then runs your command. The secret *values* never touch the filesystem.

**Setup:**

1. Install the `bws` CLI:
   ```bash
   # macOS
   brew install bitwarden/tap/bws

   # Or download from https://github.com/bitwarden/sdk-sm/releases
   ```

2. In Bitwarden Secrets Manager, create a project called `support-raising` and add these secrets with exactly these key names:
   ```
   POSTGRES_PASSWORD
   API_KEY
   VITE_API_KEY        (same value as API_KEY)
   LOCAL_USER_EMAIL    (e.g. local@localhost)
   LOCAL_USER_ID       (the UUID from step 7 above — fill in after first migration)
   ```

3. Create a machine account, grant it read access to the `support-raising` project, and copy its access token.

4. Export only the access token to your shell (the only value that needs to be local):
   ```bash
   export BWS_ACCESS_TOKEN=<your-machine-account-access-token>
   ```
   Add that line to your `~/.zshrc` or `~/.zprofile` so it persists across sessions.

5. Run migration and seed with secrets injected by `bws`:
   ```bash
   bws run -- node api/migrate.js
   bws run -- node api/seed.js /path/to/contacts-export.csv
   ```

6. Start the API with secrets injected:
   ```bash
   bws run -- node api/server.js
   ```

7. For the Vite frontend in dev, `VITE_API_KEY` must be present when Vite starts:
   ```bash
   bws run -- npm run dev
   ```

8. For Docker Compose with Bitwarden, pass secrets at startup:
   ```bash
   bws run -- docker compose up
   ```
   Docker Compose automatically reads environment variables from the shell that launched it, so all `${VAR}` references in `docker-compose.yml` will resolve from the injected secrets.

**One-liner to start everything with Bitwarden:**
```bash
bws run -- docker compose up
```

---

## Daily use (after first-time setup)

```bash
# With .env file:
docker compose up

# With Bitwarden Secrets Manager:
bws run -- docker compose up
```

Stop everything:
```bash
docker compose down
```

Stop and delete all data (destructive — you'll need to re-seed):
```bash
docker compose down -v
```

---

## Database migrations

If the schema changes in the future, new migration files will appear in `api/migrations/`. Run them in order:
```bash
# With .env:
node api/migrate.js

# With Bitwarden:
bws run -- node api/migrate.js
```

---

## Re-seeding from a CSV export

If you need to restore data from a CSV (e.g. on a new machine), export from the app first (Contacts tab → Export CSV), then:
```bash
node api/seed.js /path/to/contacts-export.csv
# or
bws run -- node api/seed.js /path/to/contacts-export.csv
```

The seed script uses `ON CONFLICT DO NOTHING` so it's safe to run against a DB that already has data — it won't create duplicates.

---

## Project structure

```
.
├── api/
│   ├── migrations/
│   │   └── 001_init.sql      # Database schema (RLS-ready, user_id on all tables)
│   ├── db.js                 # Postgres connection pool
│   ├── migrate.js            # Schema runner
│   ├── seed.js               # CSV → Postgres importer
│   ├── server.js             # Express API (contacts CRUD, goals upsert)
│   ├── Dockerfile
│   └── package.json
├── src/
│   ├── components/           # React UI components
│   ├── hooks/
│   │   ├── useContacts.js    # Fetches from /api/contacts
│   │   └── useGoalSettings.js# Fetches from /api/goals
│   └── utils/
│       └── csvParser.js      # CSV import/export logic
├── docker-compose.yml
├── vite.config.js            # Proxies /api → localhost:3001 in dev
├── .env.example              # Secrets template — copy to .env
└── ROADMAP.md                # Architecture decisions and future phases
```

---

## Moving to a new machine

1. Clone or copy the repo (no database files — `data/` is gitignored)
2. Install Docker Desktop and Node.js
3. Follow **First-time setup** above — Option A or B
4. Bring your CSV export to seed the database

Your data is now in `./data/postgres/` (a Docker volume mount). Back that directory up separately if you want a binary backup in addition to CSV exports.

---

## Future phases (see ROADMAP.md)

| Phase | What |
|-------|------|
| 2 | Row-Level Security already in schema — `user_id` on every table |
| 3 | Supabase migration — swap Express for Supabase client, enable RLS policies, add auth |
| 4 | AI writing assistant via Claude API (needs Phase 3 first for server-side key handling) |
| 5 | SaaS / multi-user — `user_roles` table already in schema |
