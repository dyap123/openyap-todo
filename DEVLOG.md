# OpenYap Todo — development log

## 2026-09-28 — dedicated Firebase project and gated Pages release

Runtime Firebase configuration now uses only `openyap-todo`, the separate project supplied by the user. The default CLI project matches it. No legacy fallback exists. Verified owner path remains `/todo`; other users remain UID-isolated. The one-time migration helper copies only `/todo` using an exclusive private backup, conditional empty-destination write and before/after hashes; it never writes the source.

`oy deploy todo` delegates to tools/release.py: clean committed Todo tree, allowed origin URLs, branch and project checks, full oy gate plus app/migration/release/emulator tests, fast-forward remote ancestry, database-only rules deployment before exact-commit Pages push. Emulator logs are isolated in a temporary directory. Dry-run performs local preflight without cloud actions. Release safety tests cover dirty/untracked trees, wrong Firebase project and fetch/push URLs, rules failure and operation ordering. No cloud changes are performed by this implementation handoff.

## 2026-09-28 — chronology and private multi-user web app

The mind map now offers Clock chronology, derived from existing start/due dates and linked task records. Equal dates share a marker; invalid or absent dates stay outside the schedule. Clock and Gantt share a read-only preview cursor with explicit playback and scrubbing. No preview fabricates completion.

All writes still pass through `upd()` and all listeners through `listen()`. These now translate the logical legacy `todo/` paths to `users/{uid}/todo` for regular accounts. The verified legacy owner keeps the original path, so integrations and existing data do not need migration. Account changes invalidate late work and clear retained data/edit state. Server rules are the actual security boundary and have emulator cross-user checks.

Google sign-in and Calendar authorization are separate. Google-linked accounts reauthenticate with a Calendar-only added scope; email-only accounts can use the optional GIS client configured in app-config.js. No token is persisted. Calendar expands recurrences, follows pagination, handles exclusive all-day end dates and ignores stale responses. API/provider/consent configuration remains a deployment prerequisite.

The PWA has relative paths and shell-only caching. It is an installable web baseline, not native store binaries or offline task sync. The central oy deploy currently has no Todo target; publishing is intentionally pending a reviewed target and provider configuration. No live Firebase data, rules or hosting changed during development.
