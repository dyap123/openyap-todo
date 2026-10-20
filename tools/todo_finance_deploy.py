#!/usr/bin/env python3
"""Scoped deployment entrypoint; invoke only through oy deploy todo-finance."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile

HOST = 'openyap@openyap-vps'
BASE = '/srv/openyap/todo-finance'
REMOTES = {'https://github.com/dyap123/openyap-todo.git', 'git@github.com:dyap123/openyap-todo.git'}

def run(args, cwd=None, capture=False, **kw):
    if capture:
        return subprocess.check_output(args, cwd=cwd, text=True, **kw).strip()
    subprocess.run(args, cwd=cwd, check=True, **kw)

def preflight(root, commit):
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('Use the full reviewed Todo commit SHA')
    if run(['git','rev-parse','--show-toplevel'],root,True) != str(root):
        raise ValueError('Not Todo root')
    if run(['git','rev-parse','HEAD'],root,True) != commit:
        raise ValueError('HEAD differs from reviewed commit')
    if run(['git','status','--porcelain','--untracked-files=all'],root,True):
        raise ValueError('Commit the reviewed Todo tree first')
    if run(['git','branch','--show-current'],root,True) not in ('mind-map','main'):
        raise ValueError('Expected Todo main or mind-map branch')
    for flags in ([], ['--push']):
        if run(['git','remote','get-url','--all',*flags,'origin'],root,True) not in REMOTES:
            raise ValueError('Unexpected Todo origin')
    config=json.loads((root/'firebase/.firebaserc').read_text())
    if config != {'projects':{'default':'openyap-todo'}}:
        raise ValueError('Wrong Firebase project')
    for name in ['backend/Dockerfile','backend/package-lock.json','backend/deploy/compose.yml','backend/deploy/check-compose.py','backend/deploy/edge-control.py','backend/deploy/Caddy.fragment','tools/todo_finance_remote.sh','tools/todo_finance_caddy_probe.py']:
        run(['git','cat-file','-e',f'{commit}:{name}'],root)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--harness',required=True,type=Path)
    parser.add_argument('--commit',required=True)
    parser.add_argument('--caddy-sha',required=True)
    parser.add_argument('--dry-run',action='store_true')
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[1]
    if not re.fullmatch(r'[0-9a-f]{64}',args.caddy_sha):
        raise ValueError('Use SHA256 of the current live Caddyfile')
    preflight(root,args.commit)
    plan={'host':HOST,'project':'openyap-todo','service':'todo-finance','commit':args.commit,'directory':BASE,'publicBase':'https://api.openyap.org/todo-finance','callback':'https://api.openyap.org/todo-finance/v1/oauth/callback','expectedCaddySha':args.caddy_sha,'actions':['oy check','backend tests','archive reviewed backend only','build/start only todo-finance','validate full Caddy candidate with temporary routing/privacy stubs','guard existing Caddy image/mounts/ports/networks; repair stale bind with edge-only recreation if needed','assert mounted inode and running admin configuration','probe public health and unauthenticated status'],'secrets':'existing private server files; never uploaded by this command','rollback':'prior release via same target; persistent volume retained'}
    print(json.dumps(plan,indent=2),flush=True)
    if args.dry_run:
        return
    run([str(args.harness),'check'],root)
    run(['npm','test'],root/'backend')
    preflight(root,args.commit)
    # No rsync of a working tree: only committed, allowlisted artifacts can reach the host.
    with tempfile.TemporaryDirectory(prefix='todo-finance-release-') as temporary:
        archive=Path(temporary)/'release.tar'
        with archive.open('wb') as stream:
            run(['git','archive','--format=tar',args.commit,'backend','tools/todo_finance_remote.sh','tools/todo_finance_caddy_probe.py'],root,stdout=stream)
        release=f'{BASE}/releases/{args.commit}'
        digest=hashlib.sha256(archive.read_bytes()).hexdigest()
        staged=run(['ssh',HOST,f'if test -e {release}; then test -f {release}/.archive-sha256 && test "$(cat {release}/.archive-sha256)" = {digest} && echo existing; else umask 077; mkdir -p {release}; echo new; fi'],capture=True)
        if staged == 'new':
            with archive.open('rb') as stream:
                run(['ssh',HOST,f'tar -xf - -C {release}'],stdin=stream)
            run(['ssh',HOST,f"printf '%s' {digest} > {release}/.archive-sha256"])
        elif staged != 'existing':
            raise ValueError('Unexpected staging response')
        run(['ssh',HOST,f'bash {release}/tools/todo_finance_remote.sh {args.commit} {args.caddy_sha}'])
    print('Finance service released. Verify authenticated status/Schwab consent before enabling the frontend URL.')

if __name__=='__main__':
    try: main()
    except (ValueError,subprocess.CalledProcessError) as error:
        print(f'Finance deployment refused: {error}',file=sys.stderr);sys.exit(1)
