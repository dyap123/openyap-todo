# Finance API

Read-only Schwab OAuth/accounts adapter for OpenYap Todo. Requires Node 24+, Firebase Admin credentials, a stable encryption key and private SQLite volume (or optional server-only Firestore database) and an HTTPS host. GitHub Pages cannot run this service.

See [complete setup and API contract](../docs/schwab-setup.md) before adding credentials. Configure secrets with the host, install with `npm ci`, test with `npm test`, start with `npm start`. `.env.example` lists settings and contains no working secrets. The service does not automatically load `.env`.

`POST /v1/connect` returns a native POST form destination plus a one-time ticket, not a directly navigable OAuth URL. The originating browser `Origin`, HttpOnly nonce, hashed expiring state and connection generation all participate in callback validation. SQLite is the default; `deploy/compose.yml` mounts a private persistent volume. For optional Firestore, keep the named database inaccessible to clients; `firestore.rules` is a deny-all template for that dedicated database.
