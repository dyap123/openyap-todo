# Locking the legacy database (gen-lang-client-0119642855)

After this, `todo/` answers only to dyap123@gmail.com (verified Google sign-in), and every other
section answers to nobody. The data is kept: nothing is deleted, and a full copy is in
`~/openyap-backups/legacy-rtdb-full-2026-09-25.json`. Reopening a section is a rule change.

Rules: `database.rules.json`. Test (23 checks, emulator):
`cd firebase && NODE_PATH=~/openyap-infra/node_modules firebase emulators:exec --only database "node rules.test.cjs"`

## Order (each step keeps Todo working until the next)

1. **Console** (console.firebase.google.com, project OpenYap / gen-lang-client-0119642855):
   - Authentication ▸ Sign-in method ▸ Google ▸ Enable
   - Authentication ▸ Settings ▸ Authorized domains ▸ add `dyap123.github.io`
   - Project settings ▸ Service accounts ▸ Generate new private key (save to ~/Downloads)
2. **Hub key:** `python3 ~/oy-harness-controller/harness/todo_auth.py --import ~/Downloads/<key>.json`
   (stores it in the Keychain and deletes the file).
3. **Todo with sign-in:** `cd ~/openyap-todo && git push origin secure-signin:main`. Open
   https://dyap123.github.io/openyap-todo/, sign in, and check that your tasks show.
4. **Retire the team apps:** `~/openyap-todo/firebase/retire-apps.sh` puts a "moved to the Command
   Center" page on tool-tracker, cup-dashboard, look-ahead, foreman-attendance, embed-tracker,
   command-center (old copy), openyap-cc, concrete-breaks and onklooth-takeoff.
5. **Lock:** `cd ~/openyap-todo/firebase && firebase deploy --only database --project gen-lang-client-0119642855`
6. **Verify:** both of these must say 401:
   `curl -s -o /dev/null -w "%{http_code}\n" https://gen-lang-client-0119642855-default-rtdb.firebaseio.com/.json`
   `curl -s -o /dev/null -w "%{http_code}\n" https://gen-lang-client-0119642855-default-rtdb.firebaseio.com/todo.json`
   Todo still loads for you, and `python3 ~/oy-harness-controller/harness/todo_auth.py --check` still reads.
7. **Revoke the MiniMax key** that sat at `config/minimax_key`. It was world-readable, so treat it as leaked.

## What stops working at step 5
Every app below still points at this database: tool-tracker (including the prod Command Center's
Foremen tab, which merged YapHound's foreman counts), CUP, SuperYap, Foreman Attendance, OpenEmbed,
the old Command Center, OpenYap CC, OpenBreak, OnKlooth, Bid Room, Budget, CS2 Investor, Yap Family
Trip, Webcor Jeopardy and the Alyssa birthday RSVP.

Undo: `firebase deploy --only database` with `{"rules":{".read":true,".write":true}}`. That is the old,
world-open state, so use it only as an emergency.
