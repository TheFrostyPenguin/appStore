# Local testing guide

Follow these steps to run the app locally and verify the frontend + backend without opening a pull request.

## Prerequisites
- Node.js 18+ and npm installed.
- Network access to `https://registry.npmjs.org` for `npm install`.
- (Optional) Supabase project if you want to test against Postgres/Storage instead of the in-memory datastore.

## 1) Install dependencies
```bash
npm install
```
If you see a `403 Forbidden` when contacting the npm registry, you need to fix the network or proxy settings before proceeding (the app cannot run without the dependencies).

## 2) Start the full stack (API + frontend)
```bash
npm start            # serves API and index.html on http://localhost:3001
PORT=4000 npm start  # choose a different port if needed
```
The Express server also serves `index.html`, so you can visit `http://localhost:3001/` to use the UI.

## 3) Try the built-in demo accounts
- **Admin:** username `admin`, password `admin123` — can add apps.
- **User:** username `user`, password `user123` — can browse, filter, sort, and download.

## 4) Test with in-memory data (default)
No extra setup is needed. The catalog seeds sample stores and apps so you can immediately log in and interact with the UI.

## 5) Test with Supabase (optional)
Set environment variables before `npm start` to switch to Supabase:
```bash
USE_SUPABASE=true
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_ANON_KEY=<public-anon-key>   # enables the Supabase login screen in the frontend
```
Then create the Supabase resources:
- Use the SQL snippet in `BACKEND.md` to create the `apps` table and enable Row Level Security.
- Add RLS policies that allow authenticated reads and admin-only writes (sample policies are also in `BACKEND.md`).
- If you need binary uploads, create a Storage bucket (e.g., `app-binaries`) and use signed URLs for downloads.

Once the table and policies exist, restart with `USE_SUPABASE=true` and the backend will read/write Supabase instead of the in-memory store.

## 6) Do I need a PR?
No pull request is required to test locally. You can work directly in your clone; create a PR only when you want to share or merge your changes upstream.

## 7) Quick frontend-only check
If you only want to view the UI without the Node server, open `index.html` directly in your browser or serve it with:
```bash
python3 -m http.server 8000
# then visit http://localhost:8000/index.html
```
(Note: API-backed features like login and submissions require the Node server running.)
