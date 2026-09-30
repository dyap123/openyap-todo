## 2026-09-30 — optional Bluebeam movable Roadmap map tiles

Roadmap export adds a persisted, off-by-default “Bluebeam movable tiles” choice. In Revu, each selected map tile is a standard `/Stamp` annotation with a vector Form appearance, including its fill, border and all current tile text; it can be selected and moved as one object. Connectors, page heading and timeline/schedule pages remain regular page content. The annotation metadata carries the tile title, descriptions, task labels and due/completion dates. Palette, explicit node colors, Dark/Light theme, description choice, selection, page size and orientation flow through the same map renderer. The ordinary PDF output remains unchanged unless the option is enabled.

The actual-PDF test checks one Stamp and appearance per visible tile, annotation/page references, title/task metadata, standard font metrics, and that map drawing commands leave fixed page content. Poppler raster output checks the 11 × 17 page and combined Dark map against the standard export with under 2% differing pixels, plus visible appearance text; UI coverage checks the Revu description and persisted default-off choice. Full `oy test` reports 96 passed and the known `ifc-sandbox-boot.test.cjs` Chrome/CDP `Target.createTarget` timeout; focused print-map and completion PDF tests are the release handoff checks. No commit or deploy by developer.

## 2026-09-30 — Custom mind-map colors in Roadmap PDF and one export entry

Roadmap map tiles now use any resolved explicit node/root color for the print fill as well as its coordinated border and connector, even with the map palette set to Original. Palette-derived fills remain in place when no override exists. Removed the extra Roadmap PDF buttons from Map and Timeline/Gantt; the existing Export dialog remains the single entry point. PDF raster tests check custom fill, border and connector pixels with no named palette, and UI tests pin both removed actions and the remaining Export control. No commit or deploy by developer.

## 2026-09-30 — Roadmap PDF orientation control

The Roadmap export settings now offer a persisted Automatic (best fit), Horizontal, or Vertical page orientation. Forced choices set the orientation of every selected Roadmap page, including the one-sheet map page in combined exports; Automatic keeps the previous behavior of landscape timeline/schedule pages and best-fit map-only exports. PDF regression coverage checks the actual 11 × 17 map-only and combined page dimensions, along with the default and saved preference. No commit or deploy by developer.

## 2026-09-30 — Roadmap print routing and full-page PDF theme

The earlier bottom sibling bus was placed just below its parent branch. Wide maps can push topic rows outward to clear tall side columns, turning each child drop into a long parallel stem. Print-only routing now uses one centered trunk down through the measured whitespace to a shared bus immediately above the common topic row, with short fixed drops into each sibling. Candidate paths are checked against card interiors and existing connector paths before rendering; screen-map geometry remains unchanged. The dense 192-node 11 × 17 test raster checks the actual bus/drop pixels and verifies no interior intersections or collinear overlaps with unrelated branch routes.

The independent Roadmap Light/Dark choice now covers every selected page, including timeline/schedule continuation pages and the map. Dark pages receive a dark background, light text and footers, contrast-adjusted category accents, dark-tinted timeline bars, and palette-aware map fills. Light remains the default and the app theme is unchanged. PDF text/background operators and 72-dpi raster output verify all combined page types. No commit or deploy by developer.

## 2026-09-30 — Larger Roadmap map text, no generated stamp

Roadmap's one-sheet mind map uses print-sized type independent from the geometry transform, so the existing card interiors do more of the work at 11 × 17. Tile labels start near twice the old scale, long headings still step down to fit their two-line card area, and task dates reserve actual measured width beside the title. Description text remains in its description slots. This keeps all 192 dense-fixture nodes on a single vector sheet; its text-box median is 2.95pt and the upper-decile glyph height exceeds 3.1pt, while long labels can use a smaller fit size to remain complete. The Roadmap header no longer prints a Generated date, for map-only and combined exports. Other report exports keep their own date stamps. No database writes, commit or deploy by developer.

## 2026-09-30 — Roadmap map theme and sibling connector routing

Roadmap export now offers an accessible Light/Dark mind-map PDF theme, persisted independently from the app appearance. Dark applies to the map page only; combined Timeline and Schedule pages retain their light background and their own footer contrast. Bottom-row sibling topics now share a single connected bus from the parent branch, with one drop per direct topic and recursive routing reserved for nested descendants. This removes duplicate elbows and ensures every sibling remains connected. PDF regression coverage checks vector palette/background/text in both themes, selection persistence and app-theme independence, dense bottom-bus geometry and combined-export per-page footer/background handling. No commit or deploy by developer.

Actual-PDF tests use Poppler on both description-on and description-off map exports, check title/date extraction and page bounds, and assert no Generated stamp on map-only or combined Roadmaps. The existing 192-node sheet also checks glyph distribution, palette pixels, selected/excluded content and vector fonts without page images. Timeline/Schedule pagination and combined first-page view remain unchanged.

## 2026-09-29 — Roadmap mind map stays on one zoomable vector sheet

The Roadmap map page now draws every selected node together using the full `mapLayout` bounds and a page-fit transform. Map-only exports remain exactly one page on Letter or 11 × 17, automatically choosing the orientation that maximizes map scale; no branch pagination or raster flattening. Print-only labels use a 1.65pt font floor (the dense fixture measures 1.53pt minimum glyph height in PDF text bounds) and remain vector text, so the sheet is a zoomable overview. Fit Page is requested only when the map is the sole export page; combined Roadmaps retain their existing first-page view. Palette fills/overrides, selected-subtree context, dates, completion and descriptions remain in the map. The Timeline and Schedule page builders keep their existing independent pagination. Brief map exports continue using their separate page-per-branch/topic presentation.

The actual PDF regression uses a synthetic dense map with 192 visible nodes, verifies exactly one page at both paper sizes, checks all selected labels and exclusions through Poppler, asserts every text bound remains inside 11 × 17 and glyph bounds are at least 1.5pt high, confirms PDF fonts/vector shapes without image objects, raster-checks palette paint/page dimensions, and checks the fit-page open action. `roadmap-completion.test.cjs` covers the selected-subtree and combined Roadmap page counts. Dense maps remain overview sheets at fit-page scale; zoom in for detail. No live writes, commit or deploy by developer.

## 2026-09-29 — Roadmap map print scale, palette and continuation pages

Roadmap map exports now use the selected project palette as distinct pastel card fills, stronger colored headers/connectors and dark print-safe text. Instead of shrinking a dense full map onto one sheet, the PDF repeats project and ancestor cards as context and continues each branch/topic on its own page; item lists are chunked (two rows with descriptions, four otherwise), and branch-level task rows also get their own page. This preserves filtered selected-subtree output, nested topics, dates/completion badges and descriptions without overlapping the labels. Map-only Roadmap builds use their existing landscape page; Brief map pages and continuations use the selected Letter, A4 or 11 × 17 size.

Validation uses actual jsPDF files plus Poppler page-size/text/raster checks. Synthetic dense maps prove every selected item prints once, excluded/private nodes stay absent, Sunset palette pixels are visible at 11 × 17 raster resolution, and branch text is larger on tabloid than Letter. `tests/roadmap-print-map.test.cjs` is part of the gated release test list. No live data changes, commit or deploy by developer.

## 2026-09-29 — coordinated map/Gantt palettes and wrapped labels

Map palette is canonical maps/{pid}/palette metadata, selected from four validated options or Original. Branch hue inheritance falls back to the palette only after explicit node/ancestor/root color overrides. Coordinated fill/border/text tones use the app background brightness, preserving high text contrast in light/dark themes. App-theme switching recolors current cards/rows without modifying saved data. Toolbar and root/branch selectors share the same field; Gantt uses the same palette.

Main-topic, branch, topic and item labels render complete text over two measured lines, proportionally fitting longer text without ellipses. Their full title/accessible label remains available. Canonical widths/header/row heights increased; column offsets derive from card dimensions, and chronology/hit-testing/PDF map drawing share the new geometry. Metadata occupies separate slots; descriptions remain independent. Browser font differences receive a final DOM width fit. PDF map labels use two-line font fitting and palette fills on white paper.

Gantt names wrap with separate date metadata, taller rows and wider mobile labels; bars/summary bands inherit palette colors. Its explicit Gantt/Chronology control opens the existing same-canvas chronology preview. Synthetic Chrome checks long Unicode labels and bounds in both app themes, descriptions, chronology and mobile; contrast checks cover actual card fills/text. A Gantt label initially measured166px in163px space; wider label column and actual-DOM fitting corrected it. No live writes, commit or deploy by developer.

## 2026-09-29 — selective Roadmap maps and dated subtopic completion

Roadmap reuses the vector map drawing and hierarchical filtering previously used by Brief. Its account-scoped exclusion preferences are separate from Brief. Timeline, Schedule and Mind map pages are independently selectable; descriptions default off and schedule topics use concise labels. Unselected ancestors retain only context, not descriptions/dates/completion state. Private nodes, linked private tasks and private ancestors are excluded by default; a private project requires explicit inclusion. The shared paper helper supports real 792×1224pt Tabloid pages, including Brief continuation/orientation changes when the shared paper option persists.

Branch/topic completed and completedAt fields live on the canonical map node. Each mark, date edit and reopen atomically appends a node-local completionEvents entry with the recorded time, effective completion and prior completion date. Reopening clears current completion but retains the trail; task records, task history and dashboard task counts are untouched. Controls validate local date/time, reject future completion and show child task progress separately. Map badges, Markdown and PDF use current status; local dates match the editor even across UTC midnight. Legacy unknown dates stay explicit. History is visible in each node's detail panel; there is no migration.

Validation: actual jsPDF files checked with pdftotext for selected content, private exclusions, compact defaults and every11x17page size; Brief mixed orientations checked. Selected and full/map-only PDFs rasterized and inspected. Synthetic Chrome covers mark/edit/reopen/history and mobile export options with external traffic blocked. Existing map153, universal31, orbit28 and navigation17 passed. No live writes, commit or deploy by developer.

## 2026-09-29 — Enter quick-add renders immediately

The focused quick-add input matched editingText, so Firebase snapshots deferred the Tasks render; its focusout also did not flush that deferral. Quick-add now permits snapshot rendering while preserving original form DOM nodes across list/category rebuilds. Focus, next draft, caret and selection survive, while intentional editor focus takes precedence.

Each nonempty Enter clears and submits its own draft, so empty repeat submits no-op and slow acknowledgements do not block the next task. Rejections restore the submitted draft when the input is empty; otherwise a text-safe failed-task row retains it with a Retry action using its original task ID. Async results cannot restore drafts/errors into a different account. Project/category identity and general quick-add's unassigned behavior remain unchanged.

Behavior tests cover focused renders, DOM identity, selection, independent delayed submissions, empty repeated submit, rejection/retry and account isolation. A real Chrome test types Enter into category and project inputs, immediately types the next draft, verifies visible task rows without blur/reload, and checks consecutive mobile entry. All browser data is synthetic with external traffic blocked. No developer commit/deploy/live writes.

## 2026-09-29 — active Tasks and visible unassigned work

Root causes: task groups explicitly included completed projects, running/count summaries ignored project status, and the No project group sorted after every project and could collapse. Top-level OpenYap quick-add also inherited an implicit default project assignment from sideFields.

Tasks now excludes done projects and their tasks from groups, counts and running summaries without changing stored task state. No project is a static, always-expanded heading at the top of each category; null/empty/missing project IDs remain visible. Generic quick-add explicitly leaves projectId empty; existing assignments remain untouched. Dashboard lists completed projects, provides their existing canonical task editors and completion log, and reopens projects explicitly. Deep links to open tasks under done projects land in that Dashboard detail. Export still includes canonical open tasks, independently of main Tasks visibility.

Regression tests cover group order, missing project references, counts/running, unassigned quick-add, Dashboard editing/deep-links/history and project reopen preserving child completion. Synthetic Chrome covers desktop/mobile visibility and reopen focus with blocked external traffic. Dashboard grid/heatmap containment prevents mobile overflow. No live writes, commit or deploy by developer.

## 2026-09-29 — change project tracking category

Tasks project groups and selected Map/Gantt project headers expose a shared keyboard-accessible category chooser. The old Map root category segment routes through the same chooser. Copy explains that open tasks and completed work move too; custom tracking categories use the existing side model.

One UID-scoped atomic update changes the project side leaf, every canonical project task side, and matching history side snapshots. History explicitly belonging to another project remains untouched; legacy snapshots without projectId follow their linked project task. No IDs, dates, completion metadata, privacy flags, project records or map coordinates are rewritten. Success selects and expands the destination Tasks project and restores visible focus. Failed writes keep the chooser actionable; account changes clear it and stale results cannot select old projects or show old errors.

Validation: project-category behavior checks cover atomicity, preservation, completed filtering, failure and account isolation; synthetic Chrome checks desktop/mobile moves and focus without external traffic or live writes. Screenshots are in /private/tmp/oy-todo-project-category-{desktop,mobile}.png. No developer commit/deploy.

# OpenYap Todo — development log

## 2026-09-29 — same-canvas chronology, project navigation and Settings

The user's clarification supersedes the separate orbit scene below: Chronology now animates the existing `mapWorld` cards and item rows into a temporary chronological layout, using native Web Animations on the original DOM elements. Back restores captured camera and persisted manual layout/order exactly. Cards/rows read their past/active/upcoming/unscheduled color from the displayed whole preview date; completion remains a separate fact. Preview Fit never clears offsets, spatial drag/nudge is blocked, and reduced motion uses immediate static positioning. The old standalone orbit renderer is removed.

Tasks now group under named expandable PROJECT sections in each tracking category, including empty/completed projects and archived projects with maps. Canonical taskSide determines placement; cross-category project tasks retain an appropriate section rather than vanishing. No-project tasks remain visible, in-progress summaries link to their single task row, and deep links expand/select their actual project/category. Group task creation sets the canonical project ID. The final Dashboard tab now owns the full existing completed-work log; saved Done preferences/deep links redirect there and project completion filters use exact project IDs.

Category forms moved into a globally accessible Settings gear/dialog with inert background, focus handling, Escape/close and account-state clearing. Markdown is one toolbar popup with Download .md and Copy options, viewport-bounded positioning and keyboard navigation. No-project controls are disabled.

Synthetic verification covers same DOM identity, exact layout/camera restoration, no preview writes, milestone color boundaries, category/project visibility, Settings drafts, embedded Done reopening and account clearing. Real Chrome with external requests blocked proves running native animations, intermediate position interpolation, desktop/mobile layout, Markdown keyboard handling and static reduced motion. `tests/orbit-browser.cjs` delegates to the current navigation browser test so the earlier command remains valid. No developer deployment or live-data changes.

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
