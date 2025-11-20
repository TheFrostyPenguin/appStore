# Backend API

The backend is a small Express service that powers the catalog UI in `index.html`. It stores data in memory by default, but it can switch to Firebase (Firestore + Cloud Storage) by flipping an environment flag.

## Run locally

```bash
npm install
npm start          # serves the API and index.html on http://localhost:3001
# or change the port
PORT=4000 npm start
```

The server also serves the frontend directly, so you can visit `http://localhost:3001/` without a separate static host.

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

## Firebase wiring (Firestore + Storage)
Firebase support is built into `src/dataStore.js`. When `USE_FIREBASE=true` the service uses Firestore for data and optionally Cloud Storage for binaries.

### Minimal environment
Create a `.env` file or export variables before running `npm start`:

```
USE_FIREBASE=true
FIREBASE_PROJECT_ID=<your-project-id>
FIREBASE_CLIENT_EMAIL=<service-account-client-email>
FIREBASE_PRIVATE_KEY="<private-key-with-escaped-newlines>"
FIREBASE_STORAGE_BUCKET=<your-bucket>.appspot.com    # optional, for uploads
```

If you prefer a JSON key file, set `FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/key.json` instead of the three fields above. The code falls back to `applicationDefault()` if neither option is provided (useful with the Firebase CLI emulator or local ADC).

### Firestore structure
Documents are stored in the `apps` collection with this shape:

```
{ id, name, category, store, tags: [], description, downloads, rating, ratingCount, feedback: [], updateInfo, lastUpdated, downloadUrl }
```

The API uses Firestore transactions for downloads and ratings to keep aggregates consistent.

### Using the Firebase Emulator Suite
If you do not want to touch production data, run the Firestore emulator and omit credentials:

```bash
npm start &
export FIRESTORE_EMULATOR_HOST=localhost:8080
USE_FIREBASE=true npm start
```

### Uploading binaries
If `FIREBASE_STORAGE_BUCKET` is set, `src/dataStore.js` exposes the initialized bucket via `storageBucket`. You can extend `server.js` with an upload endpoint like this:

```js
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/apps/:id/upload', upload.single('file'), async (req, res) => {
  if (!store.storageBucket) return res.status(501).json({ error: 'Storage bucket not configured' });
  const filename = `${req.params.id}/${Date.now()}-${req.file.originalname}`;
  await store.storageBucket.file(filename).save(req.file.buffer);
  res.json({ storagePath: filename });
});
```

## Security notes
- Admin-only routes expect `x-user-role: admin`; swap this for JWT validation in production.
- Helmet and CORS are enabled; tweak `cors()` if you restrict origins.
- Request bodies are limited to 1MB by default.
