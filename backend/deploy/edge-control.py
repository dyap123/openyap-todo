#!/usr/bin/env python3
"""Repair only Caddy's stale file bind; guard image and routing resources before recreation."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time

APP = Path('/srv/openyap/app')
COMPOSE = ['docker', 'compose']


def command(args, capture=True):
    try:
        result = subprocess.run(args, cwd=APP, check=True, capture_output=True, text=True)
    except Exception:
        # Docker/compose data can contain environment values; suppress raw output/errors.
        raise RuntimeError('Scoped Caddy operation failed') from None
    return result.stdout.strip() if capture else None


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def resources(container):
    return {
        'imageId': container['Image'],
        'imageTag': container['Config']['Image'],
        'mounts': sorted([[x['Type'], x.get('Name') if x['Type'] == 'volume' else x['Source'], x['Destination'], not x['RW']] for x in container['Mounts']]),
        'ports': sorted([[key, value.get('HostIp') or '', value['HostPort']] for key, values in container['HostConfig']['PortBindings'].items() for value in values]),
        'networks': sorted(container['NetworkSettings']['Networks']),
    }


def guard_compose(config, before, cached_id):
    service = config['services']['caddy']
    require(service.get('image') == before['imageTag'] and cached_id == before['imageId'], 'Refusing Caddy image change or unavailable pinned image')
    require(not service.get('build') and not service.get('command') and not service.get('entrypoint'), 'Unexpected Caddy executable override')
    mounts = []
    for mount in service.get('volumes', []):
        kind, source = mount['type'], mount['source']
        if kind == 'volume':
            source = config['volumes'][source]['name']
        mounts.append((kind, source, mount['target'], bool(mount.get('read_only'))))
    ports = [(f"{p['target']}/{p.get('protocol', 'tcp')}", p.get('host_ip') or '', str(p['published'])) for p in service.get('ports', [])]
    networks = sorted(config['networks'][key]['name'] for key in service.get('networks', {}))
    require(sorted(mounts) == [tuple(x) for x in before['mounts']], 'Refusing Caddy certificate/config mount change')
    require(sorted(ports) == [tuple(x) for x in before['ports']], 'Refusing Caddy public port change')
    require(networks == before['networks'], 'Refusing Caddy network change')
    require(('bind', str(APP / 'Caddyfile'), '/etc/caddy/Caddyfile', True) in mounts, 'Unexpected Caddyfile mount source')


def activate(snapshot, run=command, stat=lambda p: p.stat().st_ino, sleep=time.sleep):
    container_id = run(COMPOSE + ['ps', '--all', '-q', 'caddy'])
    if snapshot.exists():
        before = json.loads(snapshot.read_text())
    else:
        require(bool(container_id), 'Existing Caddy container required for initial guard')
        before = resources(json.loads(run(['docker', 'inspect', container_id]))[0])
        # Resource-only snapshot contains no process environment or configuration secrets.
        snapshot.write_text(json.dumps(before))
        os.chmod(snapshot, 0o600)
    config = json.loads(run(COMPOSE + ['config', '--format', 'json']))
    image = json.loads(run(['docker', 'image', 'inspect', before['imageTag']]))[0]['Id']
    guard_compose(config, before, image)
    mounted_inode = None
    if container_id:
        try:
            mounted_inode = int(run(COMPOSE + ['exec', '-T', 'caddy', 'stat', '-c', '%i', '/etc/caddy/Caddyfile']))
        except RuntimeError:
            pass
    if mounted_inode != stat(APP / 'Caddyfile'):
        run(COMPOSE + ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', 'caddy'], capture=False)
    else:
        run(COMPOSE + ['exec', '-T', 'caddy', 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'], capture=False)
    after_id = run(COMPOSE + ['ps', '--all', '-q', 'caddy'])
    after = resources(json.loads(run(['docker', 'inspect', after_id]))[0])
    require(after == before, 'Caddy resources changed during scoped activation')
    for attempt in range(10):
        try:
            actual = int(run(COMPOSE + ['exec', '-T', 'caddy', 'stat', '-c', '%i', '/etc/caddy/Caddyfile']))
            require(actual == stat(APP / 'Caddyfile'), 'Caddy mount remains stale')
            return
        except RuntimeError:
            if attempt == 9:
                raise
            sleep(0.5)


def assert_runtime(config):
    servers = config.get('apps', {}).get('http', {}).get('servers', {})
    def walk(value):
        if isinstance(value, dict):
            yield value
            for child in value.values():
                yield from walk(child)
        elif isinstance(value, list):
            for child in value:
                yield from walk(child)
    for server in servers.values():
        if ':443' not in server.get('listen', []):
            continue
        for host_route in server.get('routes', []):
            hosts = [host for match in host_route.get('match', []) for host in match.get('host', [])]
            if 'api.openyap.org' not in hosts:
                continue
            for route in walk(host_route):
                paths = [path for match in route.get('match', []) for path in match.get('path', [])]
                if '/todo-finance/*' not in paths:
                    continue
                children = list(walk(route.get('handle', [])))
                stripped = any(x.get('handler') == 'rewrite' and x.get('strip_path_prefix') == '/todo-finance' for x in children)
                proxied = any(x.get('handler') == 'reverse_proxy' and any(u.get('dial') == 'todo-finance:8080' for u in x.get('upstreams', [])) for x in children)
                if stripped and proxied:
                    logs = config.get('logging', {}).get('logs', {})
                    require('http.log.error.finance_private' in logs.get('default', {}).get('exclude', []), 'Finance error logger is not excluded from default')
                    require(logs.get('finance_private_errors', {}).get('writer', {}).get('output') == 'discard', 'Finance error logging is not private')
                    return
    raise RuntimeError('Running Caddy config lacks expected public finance route and prefix stripping')


def runtime(run=command, sleep=time.sleep):
    for attempt in range(10):
        try:
            config = json.loads(run(COMPOSE + ['exec', '-T', 'caddy', 'wget', '-q', '-O', '-', 'http://127.0.0.1:2019/config/']))
            assert_runtime(config)
            return
        except (RuntimeError, ValueError):
            if attempt == 9:
                raise RuntimeError('Running Caddy configuration verification failed') from None
            sleep(0.5)


if __name__ == '__main__':
    try:
        if len(sys.argv) == 3 and sys.argv[1] == 'activate':
            path = Path(sys.argv[2]).resolve()
            require(path.parent.parent.parent == Path('/srv/openyap/todo-finance') and path.name == 'edge.previous.json', 'Unexpected snapshot path')
            activate(path)
        elif sys.argv[1:] == ['assert-runtime']:
            runtime()
        else:
            raise RuntimeError('Unexpected edge operation')
    except Exception:
        print('Scoped Caddy activation/verification failed; raw Docker data suppressed', file=sys.stderr)
        sys.exit(1)
    print('Scoped Caddy activation/verification passed')
