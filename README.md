# OpenYap Todo

A responsive, installable web app for private tasks, mind maps, chronological planning and a read-only Google Calendar. The shipped app has no build step. `index.html` contains the UI and workspace adapter; Firebase Authentication establishes identity, and Realtime Database rules enforce ownership.

## Planning

Open **Map → Chronology**. Actual task tiles orbit the main topic, ordered clockwise by start date (or due date when no start exists). Text stays upright. Eight tiles per page keep dense and equal-date plans usable; the full ordered list always exposes every task. Missing, malformed or reversed dates stay in Unscheduled. The event strip, date slider and shared Gantt playhead preview when work happens without changing tasks. Playback follows the active page; reduced motion keeps tiles stationary while dates advance. Small screens scroll within a centered orbit scene.

**Show / Hide descriptions** controls descriptions in the mind map and Chronology. Select a task tile/item for its details and **Mark complete**, with an editable local completion date/time. Existing completed items support date correction and reopening. Future or impossible completion times are rejected; an old completion without a timestamp remains explicitly unknown. Completing a repeating item logs one occurrence and advances its next due date. Topic panels list their descendant tasks as an actionable checklist.

New map items are task-backed immediately. Existing unlinked items become tasks only when explicitly added to the list, dated, or completed. Linked titles, notes and dates derive from the canonical task. Completion writes the task and Done history atomically so Calendar, Tasks, Done and Gantt agree.

**Complete project / Reopen project** appears at the top of Map, Chronology and Gantt. It changes the project status without marking tasks complete or deleting data. In **Tasks → Manage categories**, create or rename tracking categories and choose their colors. Career and OpenYap are the original tracking categories; custom categories share the same task `side` and project `sides/{projectId}` mapping. Category metadata lives at `trackingCategories/{id}` in the signed-in workspace; it is separate from the older task `category` classification (work/routine/project). All views and PDF exports include custom categories; column exports paginate in pairs.

### Markdown for agents

**Download Markdown** or **Copy Markdown** in Map/Chronology produces an agent-readable `.md` snapshot directly from current canonical data. It includes the project/main topic, project status/privacy, tracking category/color, nested branches/topics, task checkboxes, descriptions, start/due dates, recorded completion timestamps and stable project/node/task IDs. Unscheduled tasks stay undated; unplaced tasks are included separately. Repeating task checkboxes describe the current occurrence.

The export is a snapshot, not a second editable database or an automatic agent connection. Give the Markdown to an agent to discuss or plan changes, then use its stable IDs to relate changes back to the app. Editing the downloaded file does not write Firebase. Live agent access would require separately authorized access to that user's workspace; no public task endpoint is introduced.

## Accounts and storage

- Email/password creation, sign-in and password reset use Firebase Authentication. Google sign-in uses Firebase's Google provider.
- Regular users read/write only `users/{auth.uid}/todo/{tasks,history,projects,sides,maps,trackingCategories}`. The UID, never an email entered into a form, identifies their workspace. RTDB rules deny cross-user reads, writes, deletes and multipath updates.
- The existing verified owner `dyap123@gmail.com` retains the original `todo/` workspace. The release migration copies only this node into the new isolated project; integrations that still use the old project must be reconfigured separately. Everyone else, including an unverified account using that address, gets only their UID workspace.
- New accounts start empty. Creating a project in Map establishes the first planning workspace.
- Account changes detach listeners, invalidate late callbacks, cancel notes and playback, clear data and hidden view/export DOM, and discard Calendar credentials. Exports already downloaded or explicitly opened outside the app remain the user's files.
- Tasks are not persisted in localStorage or service-worker caches. Cosmetic preferences are device-local. Report author/title text stays in memory.

## Firebase setup before release

The public Firebase project configuration is in `index.html`. It is not a secret. No service-account key or OAuth client secret belongs in this app.

1. In Firebase Console for `openyap-todo`, enable **Authentication → Email/Password** and **Google**, with the intended support email. Configure email templates, password policy and abuse protections for public registration.
2. Add the exact hostnames serving the app to **Authentication → Settings → Authorized domains**, including `dyap123.github.io` and the intended universal app domain. Add localhost explicitly if testing real sign-in locally. Google popup authentication requires an interactive browser; the app reports popup blocking rather than silently redirecting across an unsupported host.
3. Review and deploy `firebase/database.rules.json` before publishing the new client. Root access and unrelated legacy apps remain closed. `users/$uid/todo` is the only new permission. See `firebase/LOCKDOWN.md` for the historical owner lock and current policy.
4. Enable **Google Calendar API** in the Google Cloud project backing Firebase's OAuth client. Configure OAuth consent and `https://www.googleapis.com/auth/calendar.events.readonly`. In testing mode, add test users; public use may require Google's scope verification and consent-screen publication.
5. Google-linked users connect through Firebase `reauthenticateWithPopup` using that existing OAuth client. Choosing another Google identity is rejected. Signing in alone does **not** request Calendar permission.
6. For email-only users to connect a separately chosen Google calendar, create a Web OAuth client in that Cloud project, set its **Authorized JavaScript origins** (origins, not URL paths), and put its public client ID in `app-config.js`. Configure the same Calendar scope/consent. Without this optional client ID, email-only users get an explicit setup message; Google-linked users do not need it.

Firebase and Google Console changes are not performed by the local implementation. Providers, domains, Calendar API and public consent must be verified on the intended host before declaring the feature live.

## Calendar behavior

**Calendar → Connect Google Calendar** requests read-only access to the primary calendar. Events remain separate from tasks and are never imported or written back. The visible six-week window is fetched with recurring events expanded and all pages collected. All-day end dates are exclusive; timed events display in the device's time zone. Navigation refreshes the visible window; Refresh fetches updates on demand.

Access tokens and events live only in this tab's memory. Expiry or HTTP 401 clears the connection and offers reconnection. An account switch, disconnect or newer request invalidates late responses. Disconnect also attempts Google consent revocation; revocation failure is reported with a pointer to the user's Google Account. Consent cancellation, API denial and network errors are visible. There is no background sync, server refresh-token storage or two-way calendar editing.

Official references: [Firebase password authentication](https://firebase.google.com/docs/auth/web/password-auth), [Firebase Google authentication](https://firebase.google.com/docs/auth/web/google-signin), [Google token authorization](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [Calendar events.list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list).

## Universal web app

`manifest.webmanifest`, local 192/512px icons, touch metadata and `sw.js` provide an installable standalone PWA at either a root URL or a subpath such as `/openyap-todo/`. Install using the browser's install menu; on iOS use Share → Add to Home Screen. The manifest's relative scope prevents escaping the deployment directory. The worker caches only public shell files with network-first updates, never Firebase/Google/API traffic.

This is a shared web app for desktop, tablet and phone, not an App Store/Play Store native binary. It does not promise offline task editing: Firebase/Google authentication and SDKs require a network connection, and the offline shell displays a sign-in load error when dependencies are unavailable. Future durable offline queues must be scoped by UID before use.

## Verification

Use Node with `jsdom@24` and `jspdf@2.5.1` available in `NODE_PATH`; the rules test also needs Firebase CLI, Java and `@firebase/rules-unit-testing`.

```sh
node tests/map.test.cjs
node tests/universal.test.cjs
node tests/orbit.test.cjs
# Optional real Chrome verification; requires playwright:
node tests/orbit-browser.cjs
cd firebase
firebase emulators:exec --only database --project demo-openyap-todo "node rules.test.cjs"
```

Tests use synthetic accounts and data. The demo project ID prevents fallback to live Firebase. The account suite drives the real HTML and pins chronological order, invalid dates, playback without writes, auth switching/delayed writes, owner preservation, consent rejection, API pagination, expiration and stale Calendar responses.

The central `oy check` gate tests `openyap-infra`, not this repository. `oy deploy todo` runs it plus Todo app, migration, release and isolated emulator rules tests. It requires a clean committed Todo tree on `mind-map` or `main`, checks both origin URLs, fetches origin/main and requires fast-forward ancestry. Rules deploy explicitly to `openyap-todo` before the exact tested commit is pushed to Pages main. No hosting or Command Center target is used. The emulator runs in a temporary directory to protect tracked historical logs.

Use `oy deploy todo --dry-run` for a local preflight with no network/write actions. It still requires a clean committed tree. Actual release is `oy deploy todo`. Provide test dependencies through NODE_PATH as above. Do not bypass the route with direct Firebase deploy or Pages push.

## Todo-only migration

`tools/migrate_todo.cjs` has hardcoded source and destination `/todo.json` URLs. It cannot read other roots or write/delete source data. Use a private backup directory outside this repository and the Firebase CLI account with access to both projects. NODE_PATH must include the installation containing `firebase-tools` (for example `/opt/homebrew/lib/node_modules`).

```sh
node tools/migrate_todo.cjs --prepare /absolute/private/backup/todo-release.json
node tools/migrate_todo.cjs --apply /absolute/private/backup/todo-release.json
```

Prepare refuses an existing backup and writes mode 0600. Apply refuses nonempty destination, changed source, invalid backup or loose permissions, conditionally creates destination with `If-Match: null_etag`, then verifies canonical hashes and unchanged source. Stop old-project editing during this short cutover; the script never deletes or reconciles records. Keep the private backup. No Auth credentials/users are copied; verified owner email selects the migrated `/todo` even with the new project's UID.

The application has no runtime fallback to the old project. Firebase configuration is public; admin credentials and backup data must never enter this repository.

### Calendar details and invitations

Click a Google event in the month grid or selected day's agenda to read its details and guests. Available HTTPS Zoom, Google Meet and Teams links open directly; conference video links are also supported. Calendar descriptions are displayed as plain text, never executed as HTML. Dates use the device's time zone, and all-day end dates are exclusive.

**Create invite in Google Calendar** opens Google's event composer for the selected day. An event detail can also prefill a new invite with that event's title, dates, description and location. Review the details and account, add guests, then save/send in Google Calendar. Todo does not send invitations or change the original event. Calendar authorization remains read-only.

The public [privacy page](privacy.html) describes this data flow. See [Google verification](docs/google-verification.md) for the administrator's production verification steps; the unverified-app warning requires Google's approval, not a client-side workaround.
