# Enterprise Application Manager

A lightweight React + Express experience for discovering, rating, and managing internal applications. Supabase (Postgres + Storage + Auth) is required for all data and login flows.

## Quick start (local)
1. **Install prerequisites**
   - Node.js 18+ and npm
   - Supabase project with URL, anon key, and service role key
2. **Clone and enter the repo**
   ```bash
   git clone <your-fork-url>
   cd appStore
   ```
3. **Configure environment**
   Create a `.env` file with:
   ```
   SUPABASE_URL=<your-supabase-url>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   SUPABASE_ANON_KEY=<public-anon-key>
   ```
   The anon key is passed to the browser via `/config.js` so the login screen can use Supabase email/password auth.
4. **Install dependencies**
   ```bash
   npm install
   ```
   > If you hit a `403 Forbidden` fetching packages, fix your network/proxy settings and re-run.
5. **Start the stack (API + frontend)**
   ```bash
   npm start              # serves on http://localhost:3001
   PORT=4000 npm start    # choose a different port if needed
   ```
6. **Open the UI** at `http://localhost:3001/`.
   - Use any Supabase email/password account allowed by your auth policies (roles read from user metadata).
7. **Exercise the flows**
   - Browse/filter apps by store, category, search, and sort.
   - Download to increment counts.
   - Submit ratings/feedback; admins can add apps.

## Supabase setup (ordered steps)
1. Create a project in the Supabase dashboard and wait for the database to provision.
2. From **Project Settings → API**, copy your **Project URL** and **Service Role key** (keep it server-side) plus the **anon key** (safe for frontend).
3. In the SQL editor, run the schema:
   ```sql
   create table if not exists apps (
     id text primary key,
     name text not null,
     category text not null,
     store text not null,
     tags text[] default '{}',
     description text,
     downloads integer default 0,
     rating numeric default 0,
     "ratingCount" integer default 0,
     feedback jsonb default '[]',
     "updateInfo" text,
     "lastUpdated" timestamptz default now(),
     "downloadUrl" text
   );
   alter table apps enable row level security;
   ```
4. Add Row Level Security policies (adjust roles to your auth model):
   ```sql
   create policy "apps select" on apps for select using (auth.role() in ('authenticated'));
   create policy "apps insert" on apps for insert with check (auth.role() = 'admin');
   create policy "apps update" on apps for update using (auth.role() = 'admin');
   ```
5. Create a Storage bucket (e.g., `app-binaries`) and use signed URLs for downloads.
6. Restart the server with your `.env` values; the backend requires Supabase and `/config.js` exposes the anon key to the frontend login form.

## Useful scripts
- `npm start` — run the Express API and serve `index.html`.
- `npm run lint` — (add a linter if desired; not configured by default).

## Troubleshooting
- **Blank page**: ensure `npm start` is running; the inline JSX uses Babel in the browser, so you must load via the served page rather than a blocked local file.
- **Login not showing**: confirm `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set and that `/config.js` is served.
- **Registry 403**: the environment must allow access to `https://registry.npmjs.org` for `npm install`.
