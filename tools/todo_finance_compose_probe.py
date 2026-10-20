#!/usr/bin/env python3
"""Parse current compose with real Docker; optional scoped SSH, no service operations/secrets."""
import argparse
from pathlib import Path
import subprocess


def probe_source(root):
    compose = (root / 'backend/deploy/compose.yml').read_text()
    env_file = 'env_file: [/srv/openyap/todo-finance/secrets/service.env]'
    if compose.count(env_file) != 1:
        raise ValueError('Review secret-free compose fixture substitution')
    compose = compose.replace(env_file, 'env_file: [/dev/null]')
    validator = (root / 'backend/deploy/check-compose.py').read_text()
    return 'import json,os,subprocess,copy\n' + f'compose={compose!r}\nvalidator={validator!r}\n' + '''namespace={'__name__':'finance_checker'}
exec(validator,namespace)
result=subprocess.run(['docker','compose','--project-directory','/srv/openyap/todo-finance','-f','-','config','--format','json'],input=compose,text=True,capture_output=True,env={**os.environ,'FINANCE_COMMIT':'a'*40})
if result.returncode: raise SystemExit('Docker compose canonicalization failed (raw config/errors suppressed)')
config=json.loads(result.stdout)
namespace['validate'](config)
for mutate in [lambda c:c['services']['todo-finance'].update(tmpfs=['/tmp:size=16m','mode=0700','uid=10001','gid=10001']),lambda c:c['services']['todo-finance'].update(user='0:0'),lambda c:c['services']['todo-finance'].update(ports=[{'target':8080,'published':'8080'}]),lambda c:c['services']['todo-finance']['volumes'][1].update(read_only=False)]:
    invalid=copy.deepcopy(config);mutate(invalid)
    try: namespace['validate'](invalid)
    except ValueError: continue
    raise SystemExit('Safety regression fixture was not rejected')
print('PASS: Docker Compose parsed one private /tmp tmpfs; scoped nonroot, mounts, network and readiness validated; four unsafe variants rejected. No secrets read or printed.')
'''

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--ssh', action='store_true', help='Use installed Docker on the allowlisted VPS; no start/build/reload')
    args = parser.parse_args()
    command = ['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','openyap@openyap-vps','python3 -'] if args.ssh else ['python3','-']
    subprocess.run(command, input=probe_source(Path(__file__).resolve().parents[1]), text=True, check=True)
