# OpenYap Todo — development log

## 2026-09-29 — orbit chronology, actionable map tasks and tracking categories

Chronology replaces the literal clock face with actual upright task tiles orbiting the main topic. Tiles are chronological, paged eight at a time with an always-available ordered list; playback/scrubbing follow the active page. The mobile scene is scroll-contained and centered by default. Reduced motion freezes tile positions while explicit playback can still advance the date/event cue. Descriptions toggle in both map presentations. Gantt continues sharing the read-only schedule cursor.

Map items now create canonical tasks at intentional creation. Existing unlinked items are not bulk migrated: completing/adding/dating one materializes it. In-map task controls write task completion and history together, validate local datetime values, preserve unknown legacy completion dates, edit existing one-shot history instead of duplicating it, and reopen by clearing corresponding completion history. Repeating actions retain existing occurrence semantics. Title/notes/start/due in roadmap/Gantt derive from linked tasks, including deliberate cleared dates. Topic panels expose descendant task checklists.

Project completion/reopening uses the existing project status field and never cascades to tasks. Custom tracking categories generalize the existing `side` model, with workspace-local `trackingCategories/{id}` name/color metadata; task `category` retains its old separate meaning. Counters, filters, mobile visibility, drag targets, Calendar legends and PDF palettes/layouts handle arbitrary validated category IDs. Category names are escaped in HTML. Account changes clear category metadata, CSS variables and hidden category UI; remote metadata rerenders defer while text is being edited.

Markdown download/copy derives an agent-readable snapshot with hierarchy, canonical task metadata, checkboxes, completion times, stable IDs, project status/privacy and category. It is not a second synced store or an unauthenticated agent endpoint.

Validation uses synthetic account records in jsdom plus real Chrome with all external requests blocked; browser snapshots cover dense orbit, descriptions, mobile completion and reduced-motion playback. No live data writes, deployment or source-project changes performed by this developer.

## 2026-09-28 — dedicated Firebase project and gated Pages release

Runtime Firebase configuration now uses only `openyap-todo`, the separate project supplied by the user. The default CLI project matches it. No legacy fallback exists. Verified owner path remains `/todo`; other users remain UID-isolated. The one-time migration helper copies only `/todo` using an exclusive private backup, conditional empty-destination write and before/after hashes; it never writes the source.

`oy deploy todo` delegates to tools/release.py: clean committed Todo tree, allowed origin URLs, branch and project checks, full oy gate plus app/migration/release/emulator tests, fast-forward remote ancestry, database-only rules deployment before exact-commit Pages push. Emulator logs are isolated in a temporary directory. Dry-run performs local preflight without cloud actions. Release safety tests cover dirty/untracked trees, wrong Firebase project and fetch/push URLs, rules failure and operation ordering. No cloud changes are performed by this implementation handoff.

## 2026-09-28 — chronology and private multi-user web app

The mind map now offers Clock chronology, derived from existing start/due dates and linked task records. Equal dates share a marker; invalid or absent dates stay outside the schedule. Clock and Gantt share a read-only preview cursor with explicit playback and scrubbing. No preview fabricates completion.

All writes still pass through `upd()` and all listeners through `listen()`. These now translate the logical legacy `todo/` paths to `users/{uid}/todo` for regular accounts. The verified legacy owner keeps the original path, so integrations and existing data do not need migration. Account changes invalidate late work and clear retained data/edit state. Server rules are the actual security boundary and have emulator cross-user checks.

Google sign-in and Calendar authorization are separate. Google-linked accounts reauthenticate with a Calendar-only added scope; email-only accounts can use the optional GIS client configured in app-config.js. No token is persisted. Calendar expands recurrences, follows pagination, handles exclusive all-day end dates and ignores stale responses. API/provider/consent configuration remains a deployment prerequisite.

The PWA has relative paths and shell-only caching. It is an installable web baseline, not native store binaries or offline task sync. The central oy deploy currently has no Todo target; publishing is intentionally pending a reviewed target and provider configuration. No live Firebase data, rules or hosting changed during development.
