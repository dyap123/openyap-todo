#!/usr/bin/env python3
"""Synthetic Docker state; never invokes Docker or SSH."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

path=Path(__file__).resolve().parents[1]/'backend/deploy/edge-control.py'
spec=importlib.util.spec_from_file_location('edge',path);edge=importlib.util.module_from_spec(spec);spec.loader.exec_module(edge)

def fixture():
    container={'Image':'sha256:existing','Config':{'Image':'caddy:2-alpine'},'Mounts':[{'Type':'bind','Source':'/srv/openyap/app/Caddyfile','Destination':'/etc/caddy/Caddyfile','RW':False},{'Type':'volume','Name':'openyap_caddy_data','Destination':'/data','RW':True},{'Type':'volume','Name':'openyap_caddy_config','Destination':'/config','RW':True}],'HostConfig':{'PortBindings':{'80/tcp':[{'HostIp':'','HostPort':'80'}],'443/tcp':[{'HostIp':'','HostPort':'443'}]}},'NetworkSettings':{'Networks':{'openyap_edge':{}}}}
    config={'services':{'caddy':{'image':'caddy:2-alpine','volumes':[{'type':'bind','source':'/srv/openyap/app/Caddyfile','target':'/etc/caddy/Caddyfile','read_only':True},{'type':'volume','source':'caddy_data','target':'/data'},{'type':'volume','source':'caddy_config','target':'/config'}],'ports':[{'target':80,'published':'80'},{'target':443,'published':'443'}],'networks':{'edge':{}}}},'volumes':{'caddy_data':{'name':'openyap_caddy_data'},'caddy_config':{'name':'openyap_caddy_config'}},'networks':{'edge':{'name':'openyap_edge'}}}
    return container,config

class Activation(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.snapshot=Path(self.temp.name)/'snapshot.json'
        self.container,self.config=fixture();self.calls=[];self.inode=10;self.image='sha256:existing'
    def execute(self,args,capture=True):
        self.calls.append(args)
        if args[:2]==['docker','inspect']:return json.dumps([self.container])
        if args[:3]==['docker','image','inspect']:return json.dumps([{'Id':self.image}])
        if args[2:3]==['config']:return json.dumps(self.config)
        if args[2:3]==['ps']:return 'caddy-id'
        if 'stat' in args:return str(self.inode)
        if args[2:3]==['up']:self.inode=20;return None
        if 'reload' in args:return None
        raise AssertionError(f'Unexpected synthetic command: {args}')
    def activate(self):edge.activate(self.snapshot,run=self.execute,stat=lambda _:20,sleep=lambda _:None)
    def test_stale_bind_recreates_only_caddy_with_existing_image(self):
        self.activate()
        self.assertIn(['docker','compose','up','-d','--no-deps','--no-build','--pull','never','--force-recreate','caddy'],self.calls)
        self.assertFalse(any('reload' in call for call in self.calls))
        self.assertEqual(self.snapshot.stat().st_mode&0o777,0o600)
    def test_current_bind_reloads_without_recreation(self):
        self.inode=20;self.activate()
        self.assertFalse(any('up' in call for call in self.calls))
        self.assertTrue(any('reload' in call for call in self.calls))
    def test_changed_cached_image_prevents_any_activation(self):
        self.image='sha256:upgraded'
        with self.assertRaisesRegex(RuntimeError,'image change'):self.activate()
        self.assertFalse(any('up' in call or 'reload' in call for call in self.calls))
    def test_changed_desired_resources_fail_before_activation(self):
        for mutate in [lambda c:c['services']['caddy']['ports'][0].update(published='81'),lambda c:c['volumes']['caddy_data'].update(name='other'),lambda c:c['networks']['edge'].update(name='other'),lambda c:c['services']['caddy'].update(image='caddy:other')]:
            self.config=fixture()[1];mutate(self.config);self.calls=[]
            with self.assertRaises(RuntimeError):self.activate()
            self.assertFalse(any('up' in call or 'reload' in call for call in self.calls))
    def test_rollback_reuses_snapshot_after_recreate(self):
        self.activate();self.calls=[];self.activate()
        self.assertTrue(any('reload' in call for call in self.calls))
    def test_wrong_mounted_file_source_is_refused(self):
        self.container['Mounts'][0]['Source']='/another/Caddyfile'
        with self.assertRaises(RuntimeError):self.activate()
        self.assertFalse(any('up' in call for call in self.calls))

class Runtime(unittest.TestCase):
    def config(self):
        return {'logging':{'logs':{'default':{'exclude':['http.log.error.finance_private']},'finance_private_errors':{'writer':{'output':'discard'}}}},'apps':{'http':{'servers':{'srv':{'listen':[':443'],'routes':[{'match':[{'host':['api.openyap.org','other']}],'handle':[{'handler':'subroute','routes':[{'match':[{'path':['/todo-finance/*']}],'handle':[{'handler':'rewrite','strip_path_prefix':'/todo-finance'},{'handler':'reverse_proxy','upstreams':[{'dial':'todo-finance:8080'}]}]}]}]}]}}}}}
    def test_expected_runtime_config_is_accepted(self):edge.assert_runtime(self.config())
    def test_missing_route_or_wrong_prefix_target_host_logger_are_rejected(self):
        for mutate in [lambda c:c['apps']['http']['servers']['srv'].update(routes=[]),lambda c:c['apps']['http']['servers']['srv']['routes'][0]['match'][0].update(host=['another']),lambda c:c['apps']['http']['servers']['srv']['routes'][0]['handle'][0]['routes'][0]['handle'][0].update(strip_path_prefix='/other'),lambda c:c['apps']['http']['servers']['srv']['routes'][0]['handle'][0]['routes'][0]['handle'][1]['upstreams'][0].update(dial='api:8000'),lambda c:c['logging']['logs']['default'].update(exclude=[])]:
            config=self.config();mutate(config)
            with self.assertRaises(RuntimeError):edge.assert_runtime(config)

if __name__=='__main__':unittest.main()
