#!/usr/bin/env python3
"""Exact candidate routing/privacy with temporary localhost-only Caddy and stub upstreams."""
import argparse
from pathlib import Path
import re
import subprocess
import time

APP = '/srv/openyap/app'
COMPOSE = ['docker', 'compose', 'exec', '-T', 'caddy']


def run(config, expected, private_code=None):
    # The installed BusyBox timeout kills only this temporary child, never production Caddy.
    process = subprocess.Popen([*COMPOSE, 'timeout', '-s', 'TERM', '8', 'caddy', 'run', '--config', '-', '--adapter', 'caddyfile'], cwd=APP, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    process.stdin.write(config.encode())
    process.stdin.close()
    results = []
    try:
        time.sleep(2)
        for path, body, status in expected:
            result = subprocess.run([*COMPOSE, 'wget', '-S', '-O', '-', 'http://127.0.0.1:18081' + path], cwd=APP, capture_output=True, text=True)
            results.append(body == result.stdout and str(status) in result.stderr)
    finally:
        output = process.stdout.read().decode(errors='replace')
        process.wait(timeout=15)
    if not all(results):
        raise RuntimeError('Full candidate routing status/body mismatch; raw logs suppressed')
    if private_code and (private_code in output or 'http.log.error.finance_private' in output):
        raise RuntimeError('Finance callback error entered logs')
    if '/unrelated-probe' not in output:
        raise RuntimeError('Existing API access logging was not preserved')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--candidate', required=True)
    args = parser.parse_args()
    candidate = Path(args.candidate).resolve()
    if not re.fullmatch(r'/srv/openyap/todo-finance/releases/[a-f0-9]{40}/Caddyfile.candidate', str(candidate)):
        raise SystemExit('Unexpected candidate path')
    original = candidate.read_text()
    if original.count('{$API_DOMAIN} {') != 1 or 'reverse_proxy api:8000' not in original or 'reverse_proxy todo-finance:8080' not in original:
        raise SystemExit('Review candidate sites/upstreams before probing')
    # Keep the full adapted production chain: headers/body/encode, handle_path, and
    # the existing catchall reverse_proxy. A respond shortcut missed real mount issues.
    config = original.replace('{\n', '{\n admin off\n persist_config off\n auto_https off\n', 1).replace('{$API_DOMAIN} {', 'http://127.0.0.1:18081 {', 1).replace('todo-finance:8080', '127.0.0.1:18082').replace('api:8000', '127.0.0.1:18083')
    config = re.sub(r'output file /data/access\.log\s*\{[^{}]*\}', 'output stdout', config)
    if 'output file' in config:
        raise SystemExit('Probe refuses filesystem log output')
    existing = '\nhttp://127.0.0.1:18083 {\n respond "EXISTING {uri}" 200\n}\n'
    finance = '\nhttp://127.0.0.1:18082 {\n respond "FINANCE {uri}" 200\n}\n'
    run(config + existing + finance, [('/todo-finance/health', 'FINANCE /health', 200), ('/todo-finance/v1/status', 'FINANCE /v1/status', 200), ('/health', 'EXISTING /health', 200), ('/unrelated-probe', 'EXISTING /unrelated-probe', 200)])
    code = 'SYNTHETIC_FINANCE_CALLBACK_CODE_NOT_A_SECRET'
    # Same complete candidate, this time with finance upstream absent: expected502.
    run(config + existing, [('/todo-finance/v1/oauth/callback?code=' + code, '', 502), ('/unrelated-probe', 'EXISTING /unrelated-probe', 200)], private_code=code)
    print('PASS: exact full candidate routes/prefix, existing API proxy and callback-failure privacy; temporary processes exited, live configuration unchanged')
