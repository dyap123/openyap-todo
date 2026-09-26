#!/bin/zsh
# Replace each retired team app's live page (GitHub Pages, branch main) with its "moved" notice
# from firebase/retired/. Works in a throwaway worktree off origin/main, so local branches and
# uncommitted work in ~/<repo> are untouched. The old app stays in git history.
set -e
HERE=${0:A:h}
TMP=$(mktemp -d)
for r in tool-tracker cup-dashboard look-ahead foreman-attendance embed-tracker command-center openyap-cc concrete-breaks onklooth-takeoff; do
  git -C ~/$r fetch -q origin
  W=$TMP/$r
  git -C ~/$r worktree add -q --detach $W origin/main
  cp $HERE/retired/$r.html $W/index.html
  files=(index.html)
  if [[ $r == cup-dashboard ]]; then cp $HERE/retired/$r.html $W/sequences.html; files+=(sequences.html); fi
  git -C $W add $files
  git -C $W commit -q -m "Retire this app: point users to the OpenYap Command Center

Its data lived in the legacy Firebase project, locked on 2026-09-25. The previous app is in git history."
  git -C $W push -q origin HEAD:main
  echo "$r -> $(git -C $W rev-parse --short HEAD)"
  git -C ~/$r worktree remove $W
done
