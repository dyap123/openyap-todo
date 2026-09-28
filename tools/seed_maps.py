#!/usr/bin/env python3
"""Seed the five paper mind maps (Downloads/Mind map.pdf, 2026-09) into the Todo database.

  python3 tools/seed_maps.py --out firebase/seed-maps-2026-09.json   # build the payload only
  python3 tools/seed_maps.py --apply                                 # back up todo/, then PATCH

Writes todo/projects, todo/sides and todo/maps with one multi-path PATCH, as the Hub's
service account (~/oy-harness-controller/harness/todo_auth.py, key in the Keychain). Existing
projects are matched by name, so OpenYap keeps its id and its tasks. No dates are seeded, so no
tasks are created. Re-running replaces only the maps it seeds."""
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

DB = "https://gen-lang-client-0119642855-default-rtdb.firebaseio.com"
HERE = Path(__file__).resolve().parent.parent

# (project name, side, private, main topic, [(branch, [(topic, [items])])]) in sheet order:
# top, left, right, bottom.
MAPS = [
    ("AI in Construction", "career", False, "Maximize AI to be better builders", [
        ("Enterprise Policies", [
            ("Cybersecurity", ["Variables of exposure", "Multi-Factor Entra ID",
                               "Information used to create AI tools (sensitivity)", "Logging / auditing tools"]),
            ("Data Governance", ["Types of data", "Where data lives", "Accuracy of data",
                                 "Scalability and flexibility of data"]),
            ("AI Council", ["M365 use cases", "Data allowed to access?", "How to educate employees?"]),
        ]),
        ("Existing Data", [
            ("M365", ["Outlook + emails", "Excel - useful tracker (LDR)", "OneDrive (Box 2.0)",
                      "Fabric Dashboard (usually broken)"]),
            ("Box / ACC / Web", ["Contract drawings and specifications", "RFIs", "Submittals", "LDR Excel",
                                 "Schedule", "BIM + Revit files"]),
            ("CMiC / WinEst", ["Labor rate + productivity", "Change orders", "Project budgets"]),
        ]),
        ("Field Use", [
            ("Concrete", ["Qty takeoff (plan view)", "Embed + inventory track", "Schedule + sequencing",
                          "Document logs (RFI, submittals, break data)"]),
            ("MEP", ["Trade allocation", "Code compliance", "Document logs", "Schedule + sequencing",
                     "Inventory track"]),
            ("Drywall", ["Qty takeoff", "Schedule", "Inventory track"]),
        ]),
        ("Core Functions", [
            ("Revit File", ["Accurately create grid, then quantities from dwg + shops", "Clean UI for site walk",
                            "Organized structure for variables and types",
                            "VPS service for LLM check on human quantities; sync workbook and ACC for changes"]),
            ("Scheduling", ["Create sequences within elements (mass select)",
                            "Create sequence across large scope of work",
                            "Create simple Excel schedule with trades", "Align all trades with schedule"]),
            ("AI", ["Indexing specs + code compliance"]),
            ("Inventory", ["Embeds", "Tools", "Materials", "Logistics + laydown"]),
        ]),
    ]),
    ("OpenYap", "openyap", False, "OpenYap", [
        ("Backend", [
            ("Firebase", ["Hosts .json and web app", "Manipulate data for more functions"]),
            ("VPS", ["Allows for LLM layer and misc. automations", "Local models", "Scale + cost?",
                     "24/7 uptime", "Run Revit engine 24/7"]),
            ("openyap-infra", ["Codebase for front end and back end on the MacBook; directory for harnesses"]),
        ]),
        ("Developers", [
            ("Agents", ["Claude Code", "Codex - gate-test and audit each other",
                        "Use manager system to deploy cheaper agents",
                        "DeepSeek - observe Claude Code and Codex, make tools"]),
            ("OY Hub", ["View codebase changes", "View + communicate with agents", "Trace changes"]),
            ("Admin", ["Firebase - database", "Tailscale - secure VPS with VPN"]),
        ]),
        ("Reusability", [
            ("IFC Engine", ["Parse contract docs", "Parse IFC file", "Populate grid", "Populate qtys",
                            "Populate variables", "Smooth viewing"]),
            ("Doc Parse", ["Parse schedule", "Inventory + Excel sheets", "Misc. documents"]),
            ("Qty Track", ["Embeds", "Tools", "Misc. materials"]),
        ]),
        ("Front End", [
            ("The Map", ["Maximize VDC team", "Catch detailing error",
                         "Qty tracking - qty takeoff to singular units", "Team alignment"]),
            ("Scheduling", ["Create sequence based on map", "Select + add trades", "Simple Gantt chart",
                            "Schedule overlay with other trades", "Required items?"]),
            ("Inventory", ["Delivery logs - site audit", "Laydown area",
                           "Add / remove / transfer (other project)", "Compare invoice"]),
        ]),
    ]),
    ("Diamond Bar", "career", True, "Diamond Bar", [
        ("Design", [("Scan", ["Dimensions to model into Revit"]), ("Revit", ["Level 1", "Level 2", "Backyard"]),
                    ("Permitting", [])]),
        ("Windows", [("Subcontract", []), ("Budget / Scope", []), ("Permit", [])]),
        ("Kitchen", [("Subcontract", []), ("Budget / Scope", []), ("Permit", [])]),
        ("Pool", [("Subcontract", []), ("Budget / Scope", []), ("Permit", [])]),
    ]),
    ("Life", "career", True, "Life", [("Finance", []), ("Health", []), ("Social", []), ("Career", [])]),
    ("Concrete", "career", False, "Concrete", []),
]


def build(projects):
    """The PATCH body. `projects` is todo/projects as it stands, to reuse ids by name."""
    by_name = {(p or {}).get("name", "").strip().lower(): pid for pid, p in (projects or {}).items()}
    body, now, stats = {}, int(time.time() * 1000), []
    for n, (name, side, private, main, branches) in enumerate(MAPS):
        pid = by_name.get(name.lower())
        if not pid:
            pid = "-map%02d-%s" % (n, "".join(c for c in name.lower() if c.isalnum()))
            body["todo/projects/" + pid] = {"name": name, "color": "", "icon": "", "status": "active",
                                            "description": "", "targetDate": "",
                                            "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
                                            "order": now + n}
        body["todo/sides/" + pid] = {"side": side, "private": private}
        nodes, seq = {}, [0]

        def add(parent, kind, title, order):
            seq[0] += 1
            nid = "n%03d" % seq[0]
            nodes[nid] = {"parent": parent, "kind": kind, "title": title, "order": order}
            return nid
        for bi, (b, topics) in enumerate(branches):
            bid = add("root", "branch", b, (bi + 1) * 1000)
            for ti, (t, items) in enumerate(topics):
                tid = add(bid, "topic", t, (ti + 1) * 1000)
                for ii, it in enumerate(items):
                    add(tid, "item", it, (ii + 1) * 1000)
        body["todo/maps/" + pid] = {"title": main, "nodes": nodes}
        stats.append((name, pid, len(nodes)))
    return body, stats


def main():
    if "--out" in sys.argv:
        out = HERE / sys.argv[sys.argv.index("--out") + 1]
        body, stats = build({"-P25PXSq33unJ506PF3n": {"name": "OpenYap"}})
        out.write_text(json.dumps(body, indent=1))
        for s in stats:
            print("%-20s %-28s %3d nodes" % s)
        return
    if "--apply" not in sys.argv:
        sys.exit(__doc__)
    sys.path.insert(0, os.path.expanduser("~/oy-harness-controller/harness"))
    import todo_auth
    get = lambda path: json.loads(urllib.request.urlopen(todo_auth.authed("%s/%s.json" % (DB, path)), timeout=30).read() or b"null")
    todo = get("todo")
    bk = Path.home() / "openyap-backups" / ("todo-before-maps-%s.json" % time.strftime("%Y-%m-%d-%H%M%S"))
    bk.write_text(json.dumps(todo))
    os.chmod(bk, 0o600)
    print("backup:", bk)
    body, stats = build((todo or {}).get("projects"))
    req = urllib.request.Request(todo_auth.authed(DB + "/.json"), data=json.dumps(body).encode(), method="PATCH",
                                 headers={"Content-Type": "application/json"})
    urllib.request.urlopen(req, timeout=30).read()
    maps = get("todo/maps")
    for name, pid, n in stats:
        got = len(((maps or {}).get(pid) or {}).get("nodes") or {})
        print("%-20s %-28s wrote %3d, read back %3d %s" % (name, pid, n, got, "ok" if got == n else "MISMATCH"))


if __name__ == "__main__":
    main()
