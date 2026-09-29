# Calendar action implementation handoff — 2026-09-29

Task `todo-calendar-actions`, developer `todo-calendar-builder`, reviewer `codex`.

Fixed agenda titles flowing into an 8px marker column: Google rows now include the missing marker and render title/meta into explicit columns. Narrow screens wrap metadata underneath the title. Event tiles and agenda rows are native buttons that open readable, focusable details.

Details display event dates, plain-text description, location, organizer and guests. HTTPS meeting links derive from video conference entry points, hangoutLink and recognized provider links in event descriptions/locations. URLs reject credentials and non-HTTPS schemes; provider matching rejects suffix spoofing. New invite action uses Google's native event composer, preserving read-only scope and requiring user review/add guests/send there. No live invitation was sent during development.

Added privacy page linked on sign-in and footer; verification guide leaves support email/domain confirmation and Google submission outstanding.

Validation: universal31 passed; calendar-actions behavioral tests passed (real app with mock Firebase/OAuth); desktop1440/mobile390 real Chrome browser passed readable title width>200, no horizontal overflow, meeting links visible and zero runtime errors. Screenshots `/private/tmp/oy-todo-calendar-details-1440.png` and `-390.png`. Escalated `oy check`:99passed0failed in `/private/tmp/oy-todo-calendar-gate.log`; prior sandbox fast gate Chrome CDP timed out96passed1failed.

Integration: add `node tests/calendar-actions.test.cjs` to Todo release gate. Preserve concurrent category-side escaping in calAgendaRow. No configuration/database/rules changes. Changes are uncommitted in `/private/tmp/oy-todo-calendar-actions`.
