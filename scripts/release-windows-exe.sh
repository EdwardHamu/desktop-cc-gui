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

Environment:
  RELEASE_MAX_ATTEMPTS   Total attempts per network command (1-10, default: 3)
  RELEASE_RETRY_DELAY    Initial backoff in seconds (1-60, default: 2)
  RELEASE_POLL_INTERVAL  Status polling interval in seconds (1-300, default: 20)
  RELEASE_WATCH_TIMEOUT  Monitoring deadline in seconds (1-86400, default: 7200)
Backoff doubles after each failure, capped at 60 seconds.
WARNING: retrying dispatch after a lost response can queue duplicate workflow runs.

Requires Bash (Git Bash on Windows), Git, and authenticated GitHub CLI (gh auth login).
Run from any directory. Commit all changes first; this script never commits or force-pushes.
--branch pushes current HEAD to that remote branch; it does NOT check out a local branch.
Only github.com remotes are supported. The workflow must also exist on the default branch.
WARNING: an existing release tag causes the workflow to overwrite same-name EXE assets.
Waits for build AND release completion, then shows a desktop notification.
Keep this terminal open. Ctrl+C stops local monitoring, not the remote workflow.
EOF
}
fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }
require_value() {
  [[ $# -ge 2 && -n "$2" && "$2" != -* ]] || fail "$1 requires a value"
}
# Keep argv intact: no eval, no command-string reconstruction.
retry_network() {
  local label=$1
  shift
  local attempt=1 delay=$retry_delay status
  while true; do
    printf '[%s] attempt %s/%s\n' "$label" "$attempt" "$max_attempts" >&2
    if "$@"; then
      return 0
    else
      status=$?
    fi
    # Do not retry explicit cancellation (including an interrupted child process).
    if (( status == 130 || status == 143 )); then exit "$status"; fi
    if (( attempt >= max_attempts )); then
      printf '[%s] failed after %s attempts (exit %s)\n' "$label" "$attempt" "$status" >&2
      return "$status"
    fi
    if [[ "$label" == dispatch ]]; then
      printf 'Warning: GitHub may have accepted the previous dispatch; retry can queue a duplicate run.\n' >&2
    fi
    printf '[%s] exit %s; retrying in %ss...\n' "$label" "$status" "$delay" >&2
    sleep "$delay" || exit "$?"
    attempt=$((attempt + 1))
    delay=$((delay * 2))
    if (( delay > 60 )); then delay=60; fi
  done
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

max_attempts=${RELEASE_MAX_ATTEMPTS-3}
retry_delay=${RELEASE_RETRY_DELAY-2}
[[ "$max_attempts" =~ ^([1-9]|10)$ ]] || fail 'RELEASE_MAX_ATTEMPTS must be an integer from 1 to 10'
[[ "$retry_delay" =~ ^([1-9]|[1-5][0-9]|60)$ ]] || fail 'RELEASE_RETRY_DELAY must be an integer from 1 to 60'
poll_interval=${RELEASE_POLL_INTERVAL-20}
watch_timeout=${RELEASE_WATCH_TIMEOUT-7200}
[[ "$poll_interval" =~ ^[1-9][0-9]{0,2}$ ]] && (( poll_interval <= 300 )) || fail 'RELEASE_POLL_INTERVAL must be an integer from 1 to 300'
[[ "$watch_timeout" =~ ^[1-9][0-9]{0,4}$ ]] && (( watch_timeout <= 86400 )) || fail 'RELEASE_WATCH_TIMEOUT must be an integer from 1 to 86400'
trap 'exit 130' INT
trap 'exit 143' TERM

command -v git >/dev/null 2>&1 || fail 'Git is required'
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/release-windows-exe-monitor.sh"
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

# Stable across dispatch retries; used as the workflow run-name correlation key.
request_id="$(date -u +%Y%m%dT%H%M%S)-$$-$RANDOM-$RANDOM"
push=(git push -- "$remote" "HEAD:refs/heads/$branch")
dispatch=(gh workflow run "$workflow" --repo "github.com/$repo" --ref "$branch")
dispatch+=(-f "request_id=$request_id")
if [[ -n "$tag" ]]; then dispatch+=(-f "release_tag=$tag"); fi
printf 'Repository: %s\nBranch: %s\nRelease tag: %s\n' "$repo" "$branch" "${tag:-workflow default (v<tauri version>)}"
printf 'Warning: existing release tags may overwrite same-name EXE assets.\n'
printf 'Network retry policy: up to %s attempts; initial delay %ss; backoff capped at 60s.\n' "$max_attempts" "$retry_delay"
if $dry_run; then
  printf '[dry-run] '; printf '%q ' "${push[@]}"; printf '\n'
  printf '[dry-run] '; printf '%q ' "${dispatch[@]}"; printf '\n'
  printf '[dry-run] Monitor request %s every %ss (deadline %ss); notify on completion.\n' "$request_id" "$poll_interval" "$watch_timeout"
  exit 0
fi
command -v gh >/dev/null 2>&1 || fail 'GitHub CLI is required; install gh and run gh auth login'
retry_network auth gh auth status --hostname github.com || fail 'GitHub authentication failed; run gh auth login'
printf 'Pushing committed HEAD...\n'
retry_network push "${push[@]}" || fail 'Push failed; workflow was NOT triggered'
printf 'Dispatching Windows EXE release...\n'
if ! retry_network dispatch "${dispatch[@]}"; then
  printf 'Warning: dispatch response could not be confirmed; searching for the matching request before declaring the result unknown.\n' >&2
fi
printf 'Checking the workflow run. Dispatch alone does not confirm build/release success.\n'
printf 'Track runs: https://github.com/%s/actions/workflows/%s\n' "$repo" "$workflow"
monitor_windows_release "$request_id"
