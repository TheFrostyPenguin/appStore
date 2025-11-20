# Local testing guide

Follow these steps to run the app locally and verify the frontend + backend without opening a pull request.

## Prerequisites
- Node.js 18+ and npm installed.
- Network access to `https://registry.npmjs.org` for `npm install`.
- (Optional) Firebase project if you want to test against Firestore/Storage instead of the in-memory datastore.

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

## 5) Test with Firebase (optional)
Set environment variables before `npm start` to switch to Firestore:
```bash
USE_FIREBASE=true
FIREBASE_PROJECT_ID=<project-id>
FIREBASE_CLIENT_EMAIL=<service-account-client-email>
FIREBASE_PRIVATE_KEY="<private-key>"   # escape newlines
FIREBASE_STORAGE_BUCKET=<bucket>.appspot.com  # optional for uploads
```
Alternatively set `FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/key.json` if you prefer a JSON key.

To avoid touching production data, run the Firebase Emulator Suite and export `FIRESTORE_EMULATOR_HOST=localhost:8080` before starting the server.

## 6) Do I need a PR?
No pull request is required to test locally. You can work directly in your clone; create a PR only when you want to share or merge your changes upstream.

## 7) Quick frontend-only check
If you only want to view the UI without the Node server, open `index.html` directly in your browser or serve it with:
```bash
python3 -m http.server 8000
# then visit http://localhost:8000/index.html
```
(Note: API-backed features like login and submissions require the Node server running.)
