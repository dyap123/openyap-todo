# OpenYap Todo

A responsive, installable web app for private tasks, mind maps, chronological planning and a read-only Google Calendar. The shipped app has no build step. `index.html` contains the UI and workspace adapter; Firebase Authentication establishes identity, and Realtime Database rules enforce ownership.

## Planning

The top navigation is **OpenYap / Projects / Tasks / Calendar / Dashboard**. OpenYap is the initial home: one combined schedule across active projects, including canonical scopes off the map and a No project group for unassigned/orphaned tasks. **Show completed projects** adds completed/archived work. Planned date ranges, milestones, invalid dates and undated scopes are shown separately from completion. Weeks/Months changes the scale; project labels stay visible during horizontal scrolling.

**Projects** opens searchable **Active / Completed** project lists. Explicit Complete project moves its card to Completed; Reopen moves it back. Progress shows canonical tasks finished X/Y and percent; an empty project says No tasks yet. Task percentage never marks a project done, and project completion never changes tasks. Archived records remain accessible in Completed. **New project** works even in an empty account; rejected creation retains its draft for retry.

Open a project for nested **Timeline / Budget / Map** and use **All projects** to return. The selected project name and task progress remain visible across these views. Timeline includes off-map scopes added in Budget. Projects offers explicit name editing; renaming also updates a matching/default main-topic title, while intentional custom map titles remain unchanged and are explained. Existing saved Map/Timeline/Budget preferences and setView APIs open the same nested workspace. Budget cell drafts must be saved or canceled before navigation; account changes clear project/name/creation drafts.

Open **Projects → project → Map → Chronology** to animate the existing map cards into chronological order on the same canvas. Cards arrange clockwise around the main topic by their earliest scheduled work; the actual task rows within them sort by start/due date. Native browser animation moves the original elements, without depending on a downloaded animation library. **Back to map** restores your saved layout, row order and camera. No separate clock, orbit scene or duplicate task list is created.

Play or scrub the shared Map/Gantt timeline to color scheduled cards and rows as **Past schedule**, **Active now**, or **Upcoming**. Invalid or absent dates remain neutral **Unscheduled**. Preview colors use the displayed whole date and never change completion. Reduced motion repositions cards without animation. Pan, pinch or zoom to explore; **Fit** in preview fits the camera without tidying saved offsets. Spatial dragging/nudging is disabled until Back to map; intentional task/date/completion edits remain available.

**Show / Hide descriptions** controls descriptions in the mind map and Chronology. Select a task tile/item for its details and **Mark complete**, with an editable local completion date/time. Existing completed items support date correction and reopening. Future or impossible completion times are rejected; an old completion without a timestamp remains explicitly unknown. Completing a repeating item logs one occurrence and advances its next due date. Topic panels list their descendant tasks as an actionable checklist.

New map items are task-backed immediately. Existing unlinked items become tasks only when explicitly added to the list, dated, or completed. Linked titles, notes and dates derive from the canonical task. Completion writes the task and Done history atomically so Calendar, Tasks, Done and Gantt agree.

**Complete project / Reopen project** appears at the top of Map, Chronology and Gantt. It changes the project status without marking tasks complete or deleting data. Use the top-right **Settings** gear from any view to create or rename tracking categories and choose their colors. Career and OpenYap are the original tracking categories; custom categories share the same task `side` and project `sides/{projectId}` mapping. Category metadata lives at `trackingCategories/{id}` in the signed-in workspace; it is separate from the older task `category` classification (work/routine/project). All views and PDF exports include custom categories; column exports paginate in pairs.

### Projects and completed work

Each tracking category's Tasks page presents expandable **PROJECT** sections with actual project names, status and counts. Projects start collapsed, including empty/completed projects; archived maps remain accessible. Expand a project to see its open tasks and add a task directly to it. **No project** keeps unassigned/orphaned tasks accessible. Explicit task category assignments are respected even when they differ from the project's category, so a task never disappears between categories. In-progress links and Calendar/Dashboard links reveal the matching category and project before opening its task editor.

**Dashboard** is the final navigation tab and includes the full **Completed tasks** log: periods, category filters, search, backdated logging, reopening and exports remain available. A project's **View completed tasks** link applies an exact project-ID filter, with **Show all projects** to clear it. Older saved Done-view preferences and task footer links open this embedded log.

### Markdown for agents

**Markdown** in the Map toolbar opens **Download .md** and **Copy Markdown** options. Either produces an agent-readable `.md` snapshot directly from current canonical data. It includes the project/main topic, project status/privacy, tracking category/color, nested branches/topics, task checkboxes, descriptions, start/due dates, recorded completion timestamps and stable project/node/task IDs. Unscheduled tasks stay undated; unplaced tasks are included separately. Repeating task checkboxes describe the current occurrence.

The export is a snapshot, not a second editable database or an automatic agent connection. Give the Markdown to an agent to discuss or plan changes, then use its stable IDs to relate changes back to the app. Editing the downloaded file does not write Firebase. Live agent access would require separately authorized access to that user's workspace; no public task endpoint is introduced.

## Accounts and storage

**Log out** is in the persistent top header, available from every signed-in view on desktop and mobile. It returns to the sign-in form and clears this tab’s account data; your saved tasks and projects stay in your workspace.

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
node tests/navigation.test.cjs
# Optional real Chrome verification; requires playwright:
node tests/navigation-browser.cjs
# tests/orbit-browser.cjs remains an alias for the same browser regression.
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

Project categories can be changed with the Category button under a Tasks PROJECT header or beside the selected Map project. The chooser moves all project tasks and matching completed-work history to the destination category in one workspace update. Custom categories are supported; privacy, map layout, IDs, dates and completion details are preserved. The destination project opens automatically in Tasks.

Category regression checks: `node tests/project-category.test.cjs`; synthetic Chrome responsive/focus check: `node tests/project-category-browser.cjs` (requires Playwright and local Chrome).

Tasks starts each category with an always-visible **No project** section, including tasks whose old project no longer exists. General quick-add leaves the task unassigned; project quick-add assigns only its named project. Completed projects leave the main Tasks list, counts and running summary. Dashboard → Completed projects keeps their tasks accessible and editable, with an explicit Reopen project action. Project completion/reopening never changes child task completion.

Visibility checks: `node tests/task-visibility.test.cjs` and `node tests/task-visibility-browser.cjs` (synthetic Chrome).

Quick-add supports consecutive Enter submissions without losing focus or the next draft when task snapshots arrive. Failed additions restore their text, or show a Retry action alongside an existing next draft. Keyboard regression: `node tests/quick-add-browser.cjs`; behavior regression: `node tests/quick-add.test.cjs`.

Roadmap PDF has independent Timeline, Schedule and Mind map options, so it can export the map alone or combine pages. Select all or pick portions; ancestors appear only as headings when their descendants are selected. Roadmap selections are separate from Brief and scoped to the signed-in account. Descriptions default off, schedule topic labels are concise, and private content requires an explicit option. Paper choices include Letter, A4 and true 11 × 17 landscape pages.

Subtopics and nested topics have their own completion date controls. Mark complete, correct the local date/time, or reopen in the map detail panel. Completion history retains each change and its previous date; child-task progress is shown separately and no task is automatically completed. Badges, Markdown and PDF show actual node completion, independently of scheduled dates. Old unknown completion dates remain unknown.

Roadmap checks: `node tests/roadmap-completion.test.cjs` (jsPDF and Poppler `pdftotext`), `node tests/roadmap-print-map.test.cjs` (one-page PDF bounds, vector text/shapes, palette raster pixels and 11 × 17 output), and `node tests/roadmap-completion-browser.cjs` (Playwright/local Chrome). Synthetic PDF examples are generated under `/private/tmp/oy-todo-*.pdf`.

The Roadmap mind map prints all selected nodes on one sheet, using whichever orientation gives the selected paper size more map area. Text and shapes remain vector-based; map-only PDFs open fit-to-page, with print-sized tile labels that use the card interiors and remain sharp when zoomed. On the dense 192-node 11 × 17 fixture, median glyph height is 2.95pt. Long labels step down to fit their card while retaining their text. Roadmap PDFs omit the generated-date stamp. Palette, hierarchy, dates, completion, descriptions and selected-subtree filtering carry through; Timeline and Schedule keep their own pagination.

Roadmap export includes a separate Light/Dark PDF theme control; it does not change the app appearance. Dark styling applies consistently to every selected Timeline, Schedule and mind-map page, including continuation pages and footers. Bottom-row sibling topics connect through one shared branch trunk and horizontal bus with a short separate drop for each topic; print-only routing keeps the bus beside the cards even when the topic row moves outward to clear side columns.

Map and Gantt share an Ocean, Forest, Sunset or Violet palette selector, available in their toolbar and project/branch map details. Changing the selector applies the chosen palette visibly, including maps with saved custom root or branch colors. **Keep custom colors** restores explicit node/ancestor colors as overrides; palette selection never deletes those colors. Choosing a custom swatch enables that option so the new color appears immediately. Original restores the saved custom colors. Fill, border and text colors adapt to the app’s light/dark theme. Labels wrap into two measured lines with full text available to assistive technology and hover; shared card/row geometry keeps dates and completion badges separate. PDF map labels also wrap. Gantt has wider labels, separate date metadata, colored bars and an explicit Chronology presentation option opening the existing map preview.

Theme/text checks: `node tests/map-theme.test.cjs` and `node tests/map-theme-browser.cjs` (synthetic Chrome Unicode/full-text bounds, contrast, descriptions, Chronology and mobile Gantt).

### Budget

Every task, item, topic, sub-topic and project can carry a budget amount. Type `1500`, `$1,500.50`, `1.5k` or `2m`; an empty amount (or zero) clears it. Amounts are plain dollar figures stored at `tasks/{id}/budget`, `maps/{pid}/nodes/{id}/budget` and `maps/{pid}/budget`. A map item linked to a task reads and writes the task's amount, the same way it shares its title and dates.

**Budget** in the Map and Timeline toolbars turns the amounts on (remembered per device) and shows the project total. On the Map each item row, topic, sub-topic and the main topic gets an amount chip; in the Timeline every Gantt row does. Click a chip to type in place: Enter or Tab saves and moves to the next amount, Shift goes back, Escape cancels, clicking away saves. The detail panel always has a Budget field, and the task editor in Tasks has one too.

A topic or sub-topic without its own amount shows the sum of what is inside it. Give it an amount and that is its allowance: the chip shows what is left to allocate, or how far over it is. Its parent counts whichever is larger, the allowance or what is inside. Project tasks that are not on the map count toward the project total. The summary bar shows Allocated, Left to allocate (or Over by), Scheduled and No dates yet.

The Timeline adds a **Cash flow** row pinned under the chart: the budget per week or per month, following the Weeks/Months scale. An item's amount is spread evenly from its start to its due date, or lands on its one date; what a topic or sub-topic has left to allocate is spread over the dates inside it; anything without dates is listed as without dates. Hover a period for its exact amount and the running total.

Tasks and scope items also offer **Budget method → Quantity + labor rates** in their editor/detail panel. Enter material quantity, unit (LF, SF, CY, each, hour, load, gallon or bag), material cost per unit, workers, hours per worker for the entire scope, and hourly labor rate. Optional labor burden, other materials/equipment and markup are separate inputs. The live preview shows materials, person-hours, base labor, burden, markup and total. **Include hired labor** starts checked. For DIY work, uncheck it to price owner labor at $0: materials, other costs and their markup still count. Crew, hours, rate and burden inputs remain saved, so rechecking restores the hired-labor calculation. The checkbox changes the preview only until Save budget; older calculations without this setting continue including labor. For example, 230 LF × $8 plus 2 workers × 16 hours × $35 is $2,960 before burden and other costs.

**Save budget** saves the selected method and all its inputs atomically. A calculated budget stores only its inputs at `cost`, never a duplicate numeric total. Map chips, task/project totals, Gantt and Cash flow derive the total from the linked canonical task. Changing a calculated chip opens its rate editor; it does not silently replace the calculation with one amount. Switching a calculated item back to Flat is a draft until Save, and then removes the rate model. Existing flat budgets retain their quick-entry behavior. Projects/topics remain flat allowances. Saving a rate model on an old unlinked item does not automatically create a task; explicit Add to list carries its inputs over. No existing records are migrated.

Markdown exports include the amounts and calculated input breakdown. Roadmap and Brief PDFs do not print budgets yet, and there is no actual-cost tracking: the feature covers planned amounts only.

Budget checks: `node tests/budget.test.cjs` (roll-up, schedule spread, in-place entry on Map and Gantt, task/bubble sync, Markdown) and `node tests/budget-browser.cjs` (synthetic Chrome: chip containment on Map, Chronology, Gantt and phone; click-to-click entry; sticky cash-flow row).

Pricing and palette regressions: `node tests/budget-rates.test.cjs`, `node tests/palette-selection.test.cjs`, and `node tests/budget-rates-palette-browser.cjs` (synthetic Chrome, all external traffic blocked). Screenshots are saved in `/private/tmp/oy-todo-budget-rates-{desktop,mobile,gantt}.png`.

### Timeline unit prices and notes

**Unit prices** in Timeline switches calculated scope chips between total dollars and their saved **material rate**, such as `$10 / LF` or `$4 / SF`. The material rate excludes labor; project totals and Cash flow continue showing complete dollar budgets. A rate remains visible when quantity is zero, so an unknown measured area does not hide the quoted rate. Flat budgets keep their ordinary total/editor and do not gain invented units. The preference is device-local. Budget has a larger dollar icon and Timeline chips have larger targets.

Click a material-rate chip to edit it on its Timeline row. Enter or Save writes just that rate through the canonical scope calculation, preserving quantity, crew, hours, wage rate, DIY labor choice, burden, other costs, markup and notes. Preview shows the resulting scope total; Escape or Cancel discards the draft. Rejected saves retain it for correction/retry.

Each row's pencil opens a notes editor in place; **Show descriptions** displays the saved notes below every relevant scope, topic and branch. Notes wrap fully, including long URLs, and bars remain aligned with their variable-height rows. Ctrl/⌘ + Enter saves notes; Enter alone adds a line. Notes share the linked task's canonical notes or the unlinked node's description. Visibility defaults off and is remembered on this device independently of Map descriptions.

Checks: `node tests/timeline-editing.test.cjs` (included in the release gate), and `node tests/timeline-editing-browser.cjs` (synthetic Chrome, all external requests blocked). Screenshots: `/private/tmp/oy-todo-timeline-unit-notes-{desktop,mobile}.png`.

### Dedicated Budget view

**Budget** is a separate financial workspace using the same scope data as Tasks, Map and Timeline. Choose a project and **Spreadsheet** or **Cash flow**. The spreadsheet starts with scope, quantity, unit, material unit rate, materials, labor, total and dates. **Details** exposes flat/rates method, flat allowance, workers, hours each, wage, burden, other costs, markup and hired-labor inclusion. **Notes** adds the canonical notes column. Derived amounts are read-only; a flat scope's Total remains editable. Project/section allowances stay flat. **Add scope** creates a project task, listed under Tasks not on the map, without creating a map node.

Click an editable cell, then Save. Enter saves and moves down; Tab/Shift+Tab saves and moves across; Escape cancels. Notes accept ordinary newlines, with Ctrl/Cmd+Enter to save. Each save changes one current canonical field and mirrors linked nodes atomically. Unsaved cells must be saved or canceled before changing filters/project/presentation; rejected writes retain drafts, and an account switch clears them. Rates are merged with current inputs, preserving DIY choices and unrelated incoming changes.

A linked task is charged once per project even when displayed in several branches. References say Counted above and are read-only. Search/filter shows a **Visible scope subtotal**; section/project numbers still include the whole project. **Allocated estimate** is marked incomplete when a nonzero material rate has zero quantity. **Budget envelope** includes project/section allowance reserves and may exceed currently priced scopes.

Cash flow compares planned weekly/monthly allocations with scope dates. Valid dated tasks off the map also contribute, and invalid nonempty dates leave their whole scope unscheduled. Unallocated allowances spread over the project span. Period cents conserve the scheduled total; no actual spending or invoice timing is inferred. With Budget on, Timeline extends its range to cover all scheduled spending, including dated off-map tasks.

**Export scope CSV** exports each unique scope once with full pricing, dates and notes. It excludes project/section reserves and subtotals, so its Scope total column sums priced scopes rather than the budget envelope. UTF-8 BOM, quoted fields and spreadsheet formula protection support Excel. No actual-cost schema or record migration is introduced.

Checks: `node tests/finance.test.cjs` (release-gated) and `node tests/finance-browser.cjs` (isolated Chrome). Screenshots: `/private/tmp/oy-todo-finance-{desktop,mobile,flow-desktop,flow-mobile}.png`.

Project navigation checks: `node tests/projects-navigation.test.cjs` (release gated) and `node tests/projects-navigation-browser.cjs` (synthetic Chrome, external traffic blocked). Screenshots: `/private/tmp/oy-todo-project-{home-desktop,home-mobile,list-desktop,list-mobile,workspace-mobile}.png`. Older feature browser tests use legacy setView APIs for their setup; this new suite exercises the visible hierarchy.
