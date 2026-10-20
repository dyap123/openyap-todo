#!/usr/bin/env python3
"""Synthetic local repository safety tests; no SSH or cloud calls."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('finance_deploy',Path(__file__).with_name('todo_finance_deploy.py'))
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)

class Preflight(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory();self.addCleanup(self.temporary.cleanup)
        self.root=Path(self.temporary.name).resolve()
        self.git('init','-b','main');self.git('remote','add','origin','https://github.com/dyap123/openyap-todo.git')
        (self.root/'firebase').mkdir();(self.root/'firebase/.firebaserc').write_text(json.dumps({'projects':{'default':'openyap-todo'}}))
        for name in ['backend/Dockerfile','backend/package-lock.json','backend/deploy/compose.yml','backend/deploy/check-compose.py','backend/deploy/Caddy.fragment','tools/todo_finance_remote.sh']:
            p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('synthetic')
        self.git('add','.');self.git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','Synthetic fixture')
        self.commit=self.git('rev-parse','HEAD')
    def git(self,*args):
        return subprocess.check_output(['git',*args],cwd=self.root,text=True,stderr=subprocess.DEVNULL).strip()
    def test_valid_pinned_commit(self):
        release.preflight(self.root,self.commit)
    def test_wrong_commit_and_short_sha(self):
        for commit in ['a'*40,self.commit[:8],';touch /tmp/unsafe']:
            with self.assertRaises(ValueError):release.preflight(self.root,commit)
    def test_dirty_tracked_or_untracked(self):
        for file in ['backend/Dockerfile','untracked.env']:
            (self.root/file).write_text('dirty')
            with self.assertRaises(ValueError):release.preflight(self.root,self.commit)
            if file=='backend/Dockerfile':self.git('checkout','--',file)
            else:(self.root/file).unlink()
    def test_wrong_remote_or_push_remote(self):
        self.git('remote','set-url','--push','origin','https://github.com/stranger/other.git')
        with self.assertRaises(ValueError):release.preflight(self.root,self.commit)
    def test_wrong_branch(self):
        self.git('checkout','-qb','unreviewed')
        with self.assertRaises(ValueError):release.preflight(self.root,self.commit)
    def test_wrong_project_even_when_committed(self):
        (self.root/'firebase/.firebaserc').write_text('{"projects":{"default":"another-project"}}')
        self.git('add','firebase/.firebaserc');self.git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','Synthetic wrong project')
        with self.assertRaises(ValueError):release.preflight(self.root,self.git('rev-parse','HEAD'))

class CaddyMerge(unittest.TestCase):
    def test_merge_is_scoped_and_idempotent(self):
        root=Path(__file__).resolve().parents[1]
        script=(root/'tools/todo_finance_remote.sh').read_text().split("<<'PY'\n",1)[1].split('\nPY\n',1)[0]
        with tempfile.TemporaryDirectory() as directory:
            before=Path(directory)/'Caddyfile';after=Path(directory)/'candidate'
            original='{\n email test@example.invalid\n}\n{$API_DOMAIN} {\n reverse_proxy api:8000\n log {\n output stdout\n }\n}\n'
            before.write_text(original)
            args=['python3','-',str(before),str(root/'backend/deploy/Caddy.fragment'),str(after),str(root/'backend/deploy/Caddy.global.fragment')]
            subprocess.run(args,input=script,text=True,check=True)
            first=after.read_text()
            self.assertIn('reverse_proxy api:8000',first)
            self.assertIn('email test@example.invalid',first)
            self.assertIn('include http.log.error.finance_private',first)
            before.write_text(first)
            subprocess.run(args,input=script,text=True,check=True)
            self.assertEqual(first,after.read_text())
            before.write_text(first.replace('reverse_proxy api:8000','reverse_proxy changed:8000'))
            subprocess.run(args,input=script,text=True,check=True)
            self.assertIn('reverse_proxy changed:8000',after.read_text())

if __name__=='__main__':unittest.main()
