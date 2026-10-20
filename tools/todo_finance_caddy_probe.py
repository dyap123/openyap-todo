#!/usr/bin/env python3
"""Run on the VPS through SSH stdin: temporary Caddy process, no config/reload changes."""
from pathlib import Path
import subprocess
import time

APP='/srv/openyap/app'
compose=['docker','compose','exec','-T','caddy']
config='''{
  admin off
  auto_https off
  log finance_private_errors {
    include http.log.error.finance_private
    output discard
  }
}
http://127.0.0.1:18081 {
  @todoFinance path /todo-finance /todo-finance/*
  log finance_private {
    no_hostname
    output discard
  }
  log_name @todoFinance finance_private
  log_skip @todoFinance
  handle_path /todo-finance/* {
    reverse_proxy 127.0.0.1:9
  }
  respond "catchall" 200
  log {
    output stdout
  }
}
'''
# BusyBox timeout kills only this child process; never terminate the production Caddy.
process=subprocess.Popen([*compose,'timeout','-s','TERM','8','caddy','run','--config','-','--adapter','caddyfile'],cwd=APP,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
process.stdin.write(config.encode());process.stdin.close()
sentinel='SYNTHETIC_FINANCE_CALLBACK_CODE_NOT_A_SECRET'
try:
    time.sleep(2)
    def request(path):
        return subprocess.run([*compose,'wget','-S','-O','-',f'http://127.0.0.1:18081{path}'],cwd=APP,capture_output=True,text=True)
    callback=request('/todo-finance/v1/oauth/callback?code='+sentinel)
    ordinary=request('/unrelated-probe')
    if '502' not in callback.stderr: raise RuntimeError('Finance proxy route was not selected')
    if 'catchall' not in ordinary.stdout: raise RuntimeError('Unrelated route changed')
finally:
    output=process.stdout.read().decode(errors='replace');process.wait(timeout=15)
# Never print raw probe logs, even though the only query value is synthetic.
if sentinel in output: raise SystemExit('FAIL: callback query entered logs')
if 'http.log.error.finance_private' in output: raise SystemExit('FAIL: finance error logger emitted')
if '/unrelated-probe' not in output: raise SystemExit('FAIL: ordinary access logging did not work')
print('PASS: finance proxy failure returned502 without callback query/error logging; unrelated catchall and access logging preserved; temporary process exited')
