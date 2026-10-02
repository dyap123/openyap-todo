#!/usr/bin/env python3
"""Only invoked by oy deploy todo; never infer a Firebase deployment target."""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile
import shutil
import sys

PROJECT = 'openyap-todo'
REMOTES = {'https://github.com/dyap123/openyap-todo.git', 'git@github.com:dyap123/openyap-todo.git'}


def run(args, cwd, capture=False):
    return subprocess.check_output(args, cwd=cwd, text=True).strip() if capture else subprocess.check_call(args, cwd=cwd)


def preflight(root):
    root = root.resolve()
    if Path(run(['git', 'rev-parse', '--show-toplevel'], root, True)).resolve() != root:
        raise ValueError('Run from the Todo repository root')
    for direction in ([], ['--push']):
        urls = run(['git', 'remote', 'get-url', '--all', *direction, 'origin'], root, True).splitlines()
        if len(urls) != 1 or urls[0] not in REMOTES:
            raise ValueError('Unexpected Todo remote')
    if run(['git', 'status', '--porcelain', '--untracked-files=all'], root, True):
        raise ValueError('Refusing dirty Todo tree; commit the reviewed release first')
    if run(['git', 'branch', '--show-current'], root, True) not in ('mind-map', 'main'):
        raise ValueError('Todo release requires mind-map or main branch')
    config = json.loads((root / 'firebase/.firebaserc').read_text())
    if config != {'projects': {'default': PROJECT}}:
        raise ValueError('Firebase project must be openyap-todo')
    firebase = json.loads((root / 'firebase/firebase.json').read_text())
    if firebase.get('database') != {'rules': 'database.rules.json'}:
        raise ValueError('Unexpected database rules configuration')
    html = (root / 'index.html').read_text()
    if "projectId:'openyap-todo'" not in html or "databaseURL:'https://openyap-todo-default-rtdb.firebaseio.com'" not in html:
        raise ValueError('Client must use the isolated Todo project')
    if 'gen-lang-client-0119642855' in html or 'openyap-prod' in html:
        raise ValueError('Client contains a forbidden backend')
    return run(['git', 'rev-parse', 'HEAD'], root, True)


def release(root, harness, dry_run=False):
    head = preflight(root)
    if dry_run:
        print('Local preflight passed. Release will run oy check, Todo tests and demo rules tests, fetch origin/main, require fast-forward ancestry, deploy only openyap-todo database rules, then push this exact commit to main. No network or live writes performed.')
        return
    run([str(harness), 'check'], root)
    for test in ('tests/map.test.cjs', 'tests/universal.test.cjs', 'tests/orbit.test.cjs', 'tests/navigation.test.cjs', 'tests/project-category.test.cjs', 'tests/task-visibility.test.cjs', 'tests/quick-add.test.cjs', 'tests/roadmap-completion.test.cjs', 'tests/roadmap-print-map.test.cjs', 'tests/map-theme.test.cjs', 'tests/calendar-actions.test.cjs', 'tests/budget.test.cjs', 'tests/budget-rates.test.cjs', 'tests/palette-selection.test.cjs', 'tests/migration.test.cjs'):
        run(['node', test], root)
    run(['python3', 'tests/release.test.py'], root)
    # Emulator logs must not modify the tracked historical database-debug.log.
    with tempfile.TemporaryDirectory(prefix='todo-rules-') as temporary:
        sandbox = Path(temporary)
        for name in ('firebase.json', 'database.rules.json', 'rules.test.cjs'):
            shutil.copyfile(root / 'firebase' / name, sandbox / name)
        run(['firebase', 'emulators:exec', '--only', 'database', '--project', 'demo-openyap-todo', 'node rules.test.cjs'], sandbox)
    run(['git', 'fetch', 'origin', 'main'], root)
    run(['git', 'merge-base', '--is-ancestor', 'FETCH_HEAD', head], root)
    if preflight(root) != head:
        raise ValueError('Todo HEAD changed during verification')
    # Rules must succeed before the public client changes. Never select hosting.
    run(['firebase', 'deploy', '--only', 'database', '--project', PROJECT, '--config', 'firebase.json', '--non-interactive'], root / 'firebase')
    if preflight(root) != head:
        raise ValueError('Todo HEAD changed during rules deployment; Pages not pushed')
    run(['git', 'push', 'origin', head + ':refs/heads/main'], root)
    print('Todo rules deployed; reviewed commit pushed to Pages main. Verify the GitHub Pages build and browser sign-in before announcing availability.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--harness', required=True, type=Path)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    try:
        release(Path(__file__).resolve().parents[1], args.harness, args.dry_run)
    except (ValueError, subprocess.CalledProcessError) as error:
        print('Todo release refused: ' + str(error), file=sys.stderr)
        sys.exit(1)
