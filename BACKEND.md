# Backend API

The backend is a small Express service that powers the catalog UI in `index.html`. All data and auth go through Supabase (Postgres + Storage).

## Run locally

```bash
npm install
npm start          # serves the API and index.html on http://localhost:3001
# or change the port
PORT=4000 npm start
```

The server also serves the frontend directly, so you can visit `http://localhost:3001/` without a separate static host.

Frontend Supabase login pulls credentials from `/config.js`, which is generated from `SUPABASE_URL` and `SUPABASE_ANON_KEY` at server start.

## Endpoints
- `GET /health` – readiness probe
- `POST /api/login` – exchange `username`/`password` for `{ token, role, displayName }`
- `GET /api/apps?category=&tag=&q=&store=&sort=` – list applications with filtering by category, tag, search term, store, and sort (name, downloads, rating, updated)
- `GET /api/apps/:id` – fetch a single application
- `POST /api/apps` – create a new application (requires header `x-user-role: admin`)
- `POST /api/apps/:id/download` – increment downloads and return the `downloadUrl`
- `POST /api/apps/:id/rate` – add a rating/comment and recalculate aggregate rating
- `POST /api/apps/:id/feedback` – append a feedback entry without changing the rating
- `GET /api/categories` – returns unique categories
- `GET /api/stores` – returns unique store names
- `GET /api/stats` – totals for downloads, rating average, category breakdown, and app count

## Supabase wiring (Postgres + Storage)
Supabase powers every request through `src/dataStore.js`; Supabase credentials are mandatory.

### Minimal environment
Create a `.env` file or export variables before running `npm start`:

```
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_ANON_KEY=<public-anon-key>   # surfaced to the frontend login at /config.js
```

### How to connect to Supabase (step-by-step)
1) **Create a project** at https://supabase.com and wait for the database to provision.

2) **Grab credentials** from **Project Settings → API**:
   - `SUPABASE_URL` → the Project URL (starts with `https://...supabase.co`).
   - `SUPABASE_SERVICE_ROLE_KEY` → the Service Role secret (keep it private; do not expose in frontend code).

3) **Create the table** using the SQL editor (or the Supabase CLI) and enable Row Level Security:
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

4) **Add policies** that allow reads for all authenticated users and writes for admins. Example (adjust roles to your auth setup):
```sql
create policy "apps select" on apps for select using (auth.role() in ('authenticated'));
create policy "apps insert" on apps for insert with check (auth.role() = 'admin');
create policy "apps update" on apps for update using (auth.role() = 'admin');
```

5) **Optional storage**: create a Storage bucket (e.g., `app-binaries`) and generate signed URLs for downloads. Keep bucket policies restricted to prevent public writes.

6) **Configure environment**: place the credentials in `.env` as shown above, then start the server with `npm start`. The API will refuse to start without Supabase credentials.

### Supabase structure
Create an `apps` table with columns matching the shape used by the UI:

```
id (text, primary key)
name (text)
category (text)
store (text)
tags (text[])
description (text)
downloads (integer)
rating (numeric)
ratingCount (integer)
feedback (jsonb)
updateInfo (text)
lastUpdated (timestamptz)
downloadUrl (text)
```

Row Level Security should allow read for viewers and write for admins on the necessary columns. For file uploads, create a Supabase Storage bucket and generate signed URLs via the Supabase dashboard or server-side helper as needed.

## Security notes
- Admin-only routes expect `x-user-role: admin`; swap this for JWT validation in production.
- Helmet and CORS are enabled; tweak `cors()` if you restrict origins.
- Request bodies are limited to 1MB by default.
