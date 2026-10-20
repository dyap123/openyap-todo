#!/usr/bin/env python3
"""Inspect canonical docker compose config JSON without printing environment/secrets."""
import json
import re
import sys

def validate(config):
    def require(condition, message):
        if not condition:
            raise ValueError(message)
    require(config.get('name') == 'todo-finance', 'Wrong compose project')
    services = config.get('services', {})
    require(set(services) == {'todo-finance'}, 'Only finance service may be deployed')
    service = services['todo-finance']
    require(service.get('tmpfs') == ['/tmp:size=16m,mode=0700,uid=10001,gid=10001'], 'Require exactly one private /tmp tmpfs mount')
    require(service.get('user') == '10001:10001', 'Runtime must use scoped nonroot UID')
    require(service.get('read_only') is True, 'Root filesystem must be read-only')
    require(service.get('cap_drop') == ['ALL'], 'Runtime must drop capabilities')
    require(service.get('security_opt') == ['no-new-privileges:true'], 'Runtime privilege escalation must be disabled')
    require(not service.get('ports') and not service.get('privileged'), 'No published ports or privileged runtime')
    require(not service.get('network_mode') and not service.get('pid'), 'No host network or process namespace')
    require(re.fullmatch(r'openyap-todo-finance:[a-f0-9]{40}', service.get('image', '')) is not None, 'Image must identify reviewed source commit')
    require(set(service.get('networks', {})) == {'edge'}, 'Only existing edge network may be joined')
    require(config.get('networks', {}).get('edge', {}).get('name') == 'openyap_edge', 'Wrong Docker network')
    require(config['networks']['edge'].get('external') is True, 'Existing external network required')
    mounts = service.get('volumes', [])
    require(len(mounts) == 2, 'Unexpected persistent mounts')
    by_target = {mount.get('target'): mount for mount in mounts}
    data = by_target.get('/data', {})
    identity = by_target.get('/run/secrets/firebase.json', {})
    require(data.get('type') == 'volume' and data.get('source') == 'finance_data', 'Only scoped named data volume allowed')
    require(identity.get('type') == 'bind' and identity.get('source') == '/srv/openyap/todo-finance/secrets/firebase.json' and identity.get('read_only') is True, 'Identity must be mounted read-only from scoped secret file')
    require(config.get('volumes', {}).get('finance_data', {}).get('name') == 'todo_finance_data', 'Stable scoped data volume required')
    environment = service.get('environment', {})
    for key, expected in {'FIREBASE_PROJECT_ID':'openyap-todo', 'FINANCE_STORE':'sqlite', 'SQLITE_PATH':'/data/finance.sqlite', 'PUBLIC_API_BASE':'https://api.openyap.org/todo-finance', 'SCHWAB_REDIRECT_URI':'https://api.openyap.org/todo-finance/v1/oauth/callback'}.items():
        require(environment.get(key) == expected, f'Unexpected pinned {key}')
    require(service.get('healthcheck', {}).get('test', [])[:3] == ['CMD','node','-e'], 'Node readiness probe required')
    require(service.get('logging', {}).get('driver') == 'local', 'Bounded local service logs required')

if __name__ == '__main__':
    try:
        validate(json.load(sys.stdin))
    except Exception:
        # Canonical config may contain secret environment; never serialize it or exceptions.
        print('Finance compose safety validation failed', file=sys.stderr)
        sys.exit(1)
    print('Finance canonical compose safety validation passed')
