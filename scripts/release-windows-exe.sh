#!/usr/bin/env bash
# Push committed code, then manually dispatch the fork's Windows release workflow.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash scripts/release-windows-exe.sh [options]

  --tag TAG        Release tag; omitted = v<version in tauri.conf.json>
  --remote NAME    Git push remote (default: origin)
  --branch NAME    Destination branch (default: current branch)
  --dry-run        Print the push/dispatch commands without network operations
  -h, --help      Show this help

Requires Bash (Git Bash on Windows), Git, and authenticated GitHub CLI (gh auth login).
Run from any directory. Commit all changes first; this script never commits or force-pushes.
--branch pushes current HEAD to that remote branch; it does NOT check out a local branch.
Only github.com remotes are supported. The workflow must also exist on the default branch.
WARNING: an existing release tag causes the workflow to overwrite same-name EXE assets.
Successful dispatch means queued, NOT that the build/release succeeded.
EOF
}
fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }
require_value() {
  [[ $# -ge 2 && -n "$2" && "$2" != -* ]] || fail "$1 requires a value"
}
remote=origin
branch=
tag=
dry_run=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) require_value "$@"; tag=$2; shift 2 ;;
    --remote) require_value "$@"; remote=$2; shift 2 ;;
    --branch) require_value "$@"; branch=$2; shift 2 ;;
    --dry-run) dry_run=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown argument: $1 (see --help)" ;;
  esac
done

command -v git >/dev/null 2>&1 || fail 'Git is required'
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd -- "$script_dir/.."
root=$(git rev-parse --show-toplevel) || fail 'Script must be inside the project repository'
cd -- "$root"
workflow=release-windows-exe.yml
[[ -f ".github/workflows/$workflow" ]] || fail "Missing .github/workflows/$workflow"
git rev-parse --verify HEAD >/dev/null || fail 'No committed HEAD exists'
if [[ -z "$branch" ]]; then
  branch=$(git symbolic-ref --quiet --short HEAD) || fail 'Detached HEAD: specify --branch explicitly'
fi
git check-ref-format "refs/heads/$branch" >/dev/null || fail "Invalid branch: $branch"
if [[ -n "$tag" ]]; then
  git check-ref-format "refs/tags/$tag" >/dev/null || fail "Invalid release tag: $tag"
fi
status=$(git status --porcelain --untracked-files=normal) || fail 'Cannot inspect working tree'
[[ -z "$status" ]] || fail 'Working tree has uncommitted/untracked files. Commit or stash them first.'

# Resolve the PUSH URL, not gh's default repo (which can point to upstream in forks).
urls=$(git remote get-url --push --all "$remote") || fail "Cannot resolve remote: $remote"
[[ "$urls" != *$'\n'* ]] || fail 'Multiple push URLs are not supported'
case "$urls" in
  https://github.com/*) repo=${urls#https://github.com/} ;;
  git@github.com:*) repo=${urls#git@github.com:} ;;
  ssh://git@github.com/*) repo=${urls#ssh://git@github.com/} ;;
  *) fail 'Expected a github.com HTTPS or SSH push URL (without embedded credentials)' ;;
esac
repo=${repo%.git}
[[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || fail 'Cannot determine owner/repository from push URL'

push=(git push -- "$remote" "HEAD:refs/heads/$branch")
dispatch=(gh workflow run "$workflow" --repo "github.com/$repo" --ref "$branch")
if [[ -n "$tag" ]]; then dispatch+=(-f "release_tag=$tag"); fi
printf 'Repository: %s\nBranch: %s\nRelease tag: %s\n' "$repo" "$branch" "${tag:-workflow default (v<tauri version>)}"
printf 'Warning: existing release tags may overwrite same-name EXE assets.\n'
if $dry_run; then
  printf '[dry-run] '; printf '%q ' "${push[@]}"; printf '\n'
  printf '[dry-run] '; printf '%q ' "${dispatch[@]}"; printf '\n'
  exit 0
fi
command -v gh >/dev/null 2>&1 || fail 'GitHub CLI is required; install gh and run gh auth login'
gh auth status --hostname github.com || fail 'GitHub authentication failed; run gh auth login'
printf 'Pushing committed HEAD...\n'
"${push[@]}" || fail 'Push failed; workflow was NOT triggered'
printf 'Dispatching Windows EXE release...\n'
if ! "${dispatch[@]}"; then
  fail 'Push succeeded, but dispatch failed. Check Actions permissions/default-branch workflow availability; rerunning this script is safe for the Git push.'
fi
printf 'Workflow dispatch accepted. Build/release success is not yet confirmed.\n'
printf 'Track runs: https://github.com/%s/actions/workflows/%s\n' "$repo" "$workflow"
