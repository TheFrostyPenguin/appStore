# Enterprise Application Manager Design

## Overview
The Enterprise Application Manager (EAM) is a web-based platform that streamlines discovery, installation, and governance of in-house software across multiple operating systems. The system centralizes curated application metadata, supports two user personas (admin and viewer), and emphasizes performance, security, and ease of use for new employees and interns.

## Architecture Summary
* **Frontend:** React.js single-page application using component-based UI patterns and Tailwind CSS for rapid theming. Communicates with the API via HTTPS and JWT bearer tokens. Client-side routing guards separate admin and viewer flows.
* **Backend:** Node.js with Express.js exposing RESTful endpoints for authentication, application catalogs, file downloads, feedback, and analytics. Lightweight middleware chain handles validation, rate limiting, logging, and JWT verification.
* **Data & Files:**
  * **Metadata & user data:** Supabase Postgres stores applications, categories, ratings, comments, and user profiles; SQL views support usage statistics.
  * **File storage:** Supabase Storage buckets (or S3) hold application binaries and update packages; signed URLs are generated for controlled downloads.
* **Security:** JWT-based authentication with role claims (admin, viewer), HTTPS-only transport, input validation, audit logging, and least-privilege access to storage buckets and databases.
* **Deployment:** Stateless services hosted in containers; CI/CD builds frontend assets and deploys backend plus infrastructure-as-code templates for Supabase schema, storage buckets, and S3 policies.

## Component Design
### Frontend (React)
* **Routing:** Protected routes for admin functions (upload/update apps, manage categories, approve comments) and public routes for browsing and downloading. Lazy-load admin areas to keep initial bundle small.
* **State management:** React Query (or SWR) caches catalog data and keeps download counts fresh. Local state manages UI filters (categories, ratings, search).
* **UI features:**
  * Application directory with category filters, search, and sorting by rating or popularity.
  * Detail pages showing feature descriptions, version history, average ratings, download count, and recent comments.
  * Feedback widgets for rating and commenting; suggestion prompts surface related applications.
  * Admin dashboards for creating categories, uploading binaries, editing metadata, and viewing update history.
  * Statistics view with Chart.js for download trends, rating distributions, and usage by category.
* **Accessibility & performance:** Semantic HTML, keyboard-friendly controls, dark/light themes, and asset code-splitting. Client caching reduces network chatter for frequently browsed catalog pages.

### Backend (Node.js/Express)
* **Routing modules:**
  * `/auth`: login, refresh, password reset initiation, and optional SSO callback for enterprise identity providers.
  * `/apps`: CRUD for applications, categories, feature descriptions, and update metadata (admin-only writes).
  * `/files`: upload via pre-signed URLs (admin), secure download links (viewer, admin) with download count tracking.
  * `/feedback`: ratings and comments submission plus suggestion retrieval (viewer/admin).
  * `/stats`: aggregated metrics for dashboard charts (download totals, rating averages, usage by category, update cadence).
* **Middleware:** Request validation (Joi/Zod), rate limiting, structured logging, CORS, JWT verification with role checks, and CSRF protection for sensitive non-API browser interactions.
* **Services:**
  * **Auth service:** Issues short-lived JWTs with role claims; optional refresh tokens stored HTTP-only; supports role-based policies.
  * **Catalog service:** Manages application metadata, categories, and version updates; ensures unique identifiers and normalized category taxonomy.
  * **Feedback service:** Handles ratings/comments, prevents duplicate ratings per user per version, and flags inappropriate content.
  * **Storage service:** Generates time-bound Supabase Storage (or S3) signed URLs, validates file types/size, and records integrity hashes for uploaded binaries.
  * **Analytics service:** Retrieves aggregated stats from Supabase SQL views/functions; feeds Chart.js datasets.

## Data Model Highlights
* **Users:** `{ uid, name, email, role, createdAt, lastLogin }` with roles `admin` or `viewer`.
* **Applications:** `{ appId, name, categoryId, description, features[], platforms[], version, downloadUrl, updateInfo, createdBy, updatedAt }`.
* **Categories:** `{ categoryId, name, description, useCaseTags[] }` enabling multi-tag classification.
* **Ratings & Comments:** `{ ratingId, appId, userId, score(1-5), comment, createdAt }`; per-user/per-version uniqueness enforced.
* **Downloads:** event records `{ appId, userId, version, timestamp, sourceIp }` for auditing and analytics.

## Security Considerations
* **Authentication & Authorization:**
  * JWT access tokens include `role` claim; middleware enforces admin-only modifications.
  * Optional MFA for admin logins; refresh tokens stored in HTTP-only, same-site cookies.
* **Transport & storage security:**
  * Enforce HTTPS and HSTS; disable insecure TLS versions.
  * Supabase Storage (or S3) buckets configured with restrictive policies; signed URLs expire quickly.
  * Supabase row-level security policies restrict access by role; all sensitive fields validated server-side.
* **Data integrity & auditing:**
  * Checksums for uploaded binaries; store hash alongside metadata and verify on download.
  * Audit logs for admin actions (uploads, metadata edits, category changes, and deletions).
  * Rate limiting and bot detection on feedback and download endpoints.
* **Privacy:** Collect minimal personal data; align with corporate retention policies; provide data export/delete mechanisms for user accounts if required.

## Operational Concerns
* **CI/CD:** Lints, tests, and builds frontend; runs backend unit/integration tests; deploys artifacts to staging then production. Environment configs managed via secrets vault.
* **Monitoring:** Metrics on request latency, error rates, storage usage, download anomalies; alerting for high error/latency or unexpected download spikes.
* **Backup & recovery:** Scheduled backups for Supabase database exports and storage buckets; disaster recovery playbook with restore procedures.
* **Scalability:** Stateless API containers behind load balancer; CDN for static assets and downloads; database indexes on `categoryId`, `updatedAt`, and `appId` for fast queries.

## Success Criteria Alignment
* **Two persona login:** JWT auth with `admin` and `viewer` roles; route guards and backend policies enforce separation.
* **Admin capabilities:** Create/edit applications, categories, and update metadata; upload binaries via signed URLs; manage comments.
* **Viewer capabilities:** Browse, download, rate, and comment; see update information and feature descriptions.
* **File storage:** Binary uploads stored in S3/compatible storage with integrity checks and access controls.
* **Statistics:** Download counts, average ratings, and usage by category delivered through `/stats` endpoints and visualized via Chart.js.
* **Categorization:** Category taxonomy and tags enable filtering and discovery for interns/new hires.
* **Cross-platform:** Web-based UI accessible via modern browsers on multiple OSes; responsive design supports desktops and laptops.
* **User experience:** Lightweight SPA with cached catalog data, quick search/filter, and structured detail pages reduces onboarding friction.

## Future Enhancements
* Integrate enterprise SSO (SAML/OAuth2) to reduce credential sprawl.
* Add offline-ready cache for frequently used installers in air-gapped environments.
* Offer role-based approval workflows for publishing new applications.
* Provide localization support for multilingual teams.
