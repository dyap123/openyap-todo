#!/usr/bin/env python3
"""Real git fixtures; all deployment commands are intercepted."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release', SOURCE / 'tools/release.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Release(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for name in ('firebase/.firebaserc', 'firebase/firebase.json', 'firebase/database.rules.json', 'firebase/rules.test.cjs', 'index.html'):
            dest = self.root / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes((SOURCE / name).read_bytes())
        self.git('init', '-b', 'mind-map')
        self.git('config', 'user.email', 'test@example.test')
        self.git('config', 'user.name', 'Release test')
        self.git('remote', 'add', 'origin', next(iter(m.REMOTES)))
        self.commit()

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, stderr=subprocess.DEVNULL, text=True).strip()

    def commit(self):
        self.git('add', '.')
        self.git('commit', '-m', 'fixture')

    def test_correct_project(self):
        self.assertEqual(m.preflight(self.root), self.git('rev-parse', 'HEAD'))

    def test_wrong_project(self):
        (self.root / 'firebase/.firebaserc').write_text(json.dumps({'projects': {'default': 'openyap-prod'}}))
        self.commit()
        with self.assertRaisesRegex(ValueError, 'Firebase project'):
            m.preflight(self.root)

    def test_client_cannot_fall_back(self):
        p = self.root / 'index.html'
        p.write_text(p.read_text() + '\n// gen-lang-client-0119642855')
        self.commit()
        with self.assertRaisesRegex(ValueError, 'forbidden backend'):
            m.preflight(self.root)

    def test_wrong_remote(self):
        self.git('remote', 'set-url', 'origin', 'https://github.com/dyap123/command-center.git')
        with self.assertRaisesRegex(ValueError, 'remote'):
            m.preflight(self.root)

    def test_wrong_push_remote(self):
        self.git('remote', 'set-url', '--push', 'origin', 'https://github.com/dyap123/command-center.git')
        with self.assertRaisesRegex(ValueError, 'remote'):
            m.preflight(self.root)

    def test_dirty_and_untracked(self):
        for name in ('index.html', 'surprise.js'):
            with self.subTest(name=name):
                (self.root / name).write_text('changed')
                with self.assertRaisesRegex(ValueError, 'dirty'):
                    m.preflight(self.root)
                if name == 'index.html': self.git('restore', name)
                else: (self.root / name).unlink()

    def test_order_and_rules_failure_stops_push(self):
        actual = m.run
        for fail_rules in (False, True):
            commands = []
            def intercepted(args, cwd, capture=False):
                if capture: return actual(args, cwd, capture)
                commands.append(args)
                if fail_rules and args[:2] == ['firebase', 'deploy']:
                    raise subprocess.CalledProcessError(1, args)
                return 0
            with patch.object(m, 'run', intercepted):
                if fail_rules:
                    with self.assertRaises(subprocess.CalledProcessError): m.release(self.root, Path('/harness/oy'))
                else: m.release(self.root, Path('/harness/oy'))
            self.assertEqual(commands[0], ['/harness/oy', 'check'])
            rules = next(c for c in commands if c[:2] == ['firebase', 'deploy'])
            self.assertEqual(rules, ['firebase', 'deploy', '--only', 'database', '--project', 'openyap-todo', '--config', 'firebase.json', '--non-interactive'])
            pushes = [c for c in commands if c[:2] == ['git', 'push']]
            self.assertEqual(len(pushes), 0 if fail_rules else 1)
            if pushes: self.assertEqual(commands[-1], ['git', 'push', 'origin', self.git('rev-parse', 'HEAD') + ':refs/heads/main'])

    def test_dry_run_does_not_deploy(self):
        with patch.object(m, 'run', wraps=m.run) as spy:
            m.release(self.root, Path('/harness/oy'), dry_run=True)
            self.assertTrue(all(c.args[2] is True for c in spy.call_args_list))


if __name__ == '__main__': unittest.main()
