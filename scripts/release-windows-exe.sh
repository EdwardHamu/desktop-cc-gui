#!/usr/bin/env bash
# Push the current branch, trigger the Windows EXE workflow, and watch it.
#
# Usage:
#   ./scripts/release-windows-exe.sh
#   ./scripts/release-windows-exe.sh --tag v0.9.5 --branch main

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORKFLOW="${WORKFLOW:-release-windows-exe.yml}"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-}"
RELEASE_TAG="${RELEASE_TAG:-}"
RETRY_ATTEMPTS="${RETRY_ATTEMPTS:-5}"
RETRY_BASE_DELAY_SECONDS="${RETRY_BASE_DELAY_SECONDS:-5}"
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-15}"
RUN_LOOKUP_TIMEOUT_SECONDS="${RUN_LOOKUP_TIMEOUT_SECONDS:-120}"
NOTIFICATION_SENT=0

usage() {
  cat <<'EOF'
Usage: scripts/release-windows-exe.sh [options]

Push the current branch, trigger release-windows-exe.yml, and watch its run.

Options:
  --branch NAME       Branch to push and build (default: current branch)
  --remote NAME       Git remote (default: origin)
  --tag TAG           Release tag passed to workflow_dispatch
  --workflow NAME     Workflow file or workflow id
  -h, --help          Show this help

Retry/poll settings are configurable with RETRY_ATTEMPTS,
RETRY_BASE_DELAY_SECONDS, POLL_INTERVAL_SECONDS, and
RUN_LOOKUP_TIMEOUT_SECONDS.
EOF
}

die() {
  echo "Error: $*" >&2
  notify_failure
  exit 1
}

notify_success() {
  NOTIFICATION_SENT=1
  if command -v notify-send >/dev/null 2>&1; then
    notify-send "ccgui release" "Windows EXE release completed." || true
  elif command -v osascript >/dev/null 2>&1; then
    osascript -e 'display notification "Windows EXE release completed." with title "ccgui release"' || true
  elif command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('Windows EXE release completed.','ccgui release')" >/dev/null 2>&1 || true
  else
    echo "[notification] Windows EXE release completed."
  fi
}

notify_failure() {
  if [ "$NOTIFICATION_SENT" -eq 1 ]; then
    return
  fi
  NOTIFICATION_SENT=1
  if command -v notify-send >/dev/null 2>&1; then
    notify-send --urgency=critical "ccgui release failed" "Check the terminal and GitHub Actions run." || true
  elif command -v osascript >/dev/null 2>&1; then
    osascript -e 'display notification "Check the terminal and GitHub Actions run." with title "ccgui release failed"' || true
  elif command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('Check the terminal and GitHub Actions run.','ccgui release failed')" >/dev/null 2>&1 || true
  else
    echo "[notification] Windows EXE release failed." >&2
  fi
}

on_exit() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    notify_failure
  fi
}
trap on_exit EXIT

retry_command() {
  local attempt=1
  local delay="$RETRY_BASE_DELAY_SECONDS"
  local status=0

  while true; do
    if "$@"; then
      return 0
    fi
    status=$?
    if [ "$attempt" -ge "$RETRY_ATTEMPTS" ]; then
      return "$status"
    fi
    echo "Network/command error; retrying in ${delay}s (${attempt}/${RETRY_ATTEMPTS})..." >&2
    sleep "$delay"
    delay=$((delay * 2))
    attempt=$((attempt + 1))
  done
}

valid_positive_integer() {
  [[ "$1" =~ ^[1-9][0-9]*$ ]]
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --branch)
      [ "$#" -ge 2 ] || die "--branch requires a value"
      BRANCH="$2"
      shift 2
      ;;
    --remote)
      [ "$#" -ge 2 ] || die "--remote requires a value"
      REMOTE="$2"
      shift 2
      ;;
    --tag)
      [ "$#" -ge 2 ] || die "--tag requires a value"
      RELEASE_TAG="$2"
      shift 2
      ;;
    --workflow)
      [ "$#" -ge 2 ] || die "--workflow requires a value"
      WORKFLOW="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

for command_name in git gh; do
  command -v "$command_name" >/dev/null 2>&1 || die "Required command not found: $command_name"
done

for numeric_setting in RETRY_ATTEMPTS RETRY_BASE_DELAY_SECONDS POLL_INTERVAL_SECONDS RUN_LOOKUP_TIMEOUT_SECONDS; do
  valid_positive_integer "${!numeric_setting}" || die "${numeric_setting} must be a positive integer"
done

cd "$ROOT_DIR"
git rev-parse --show-toplevel >/dev/null 2>&1 || die "Not inside a Git repository"
if [ -z "$BRANCH" ]; then
  BRANCH="$(git branch --show-current)"
fi
[ -n "$BRANCH" ] || die "Detached HEAD; pass --branch explicitly"

retry_command gh auth status >/dev/null || die "GitHub CLI is not authenticated; run gh auth login"

echo "Pushing ${BRANCH} to ${REMOTE}..."
retry_command git push "$REMOTE" "HEAD:${BRANCH}" || die "git push failed"
COMMIT="$(git rev-parse HEAD)"

echo "Triggering ${WORKFLOW} for ${COMMIT}..."
WORKFLOW_ARGS=(workflow run "$WORKFLOW" --ref "$BRANCH")
if [ -n "$RELEASE_TAG" ]; then
  WORKFLOW_ARGS+=(-f "release_tag=${RELEASE_TAG}")
fi
retry_command gh "${WORKFLOW_ARGS[@]}" || die "workflow dispatch failed"

echo "Waiting for the dispatched run..."
RUN_ID=""
LOOKUP_DEADLINE=$((SECONDS + RUN_LOOKUP_TIMEOUT_SECONDS))
while [ -z "$RUN_ID" ]; do
  RUN_ID="$(retry_command gh run list \
    --workflow "$WORKFLOW" \
    --commit "$COMMIT" \
    --event workflow_dispatch \
    --limit 1 \
    --json databaseId \
    --jq '.[0].databaseId // empty')" || die "Unable to find the dispatched workflow run"
  if [ -n "$RUN_ID" ]; then
    break
  fi
  if [ "$SECONDS" -ge "$LOOKUP_DEADLINE" ]; then
    die "Timed out waiting for the dispatched workflow run"
  fi
  sleep "$POLL_INTERVAL_SECONDS"
done

echo "Watching run ${RUN_ID}..."
while true; do
  RUN_STATE="$(retry_command gh run view "$RUN_ID" \
    --json status,conclusion,url \
    --jq '(.status // "") + "\t" + (.conclusion // "") + "\t" + (.url // "")')" \
    || die "Unable to read workflow run ${RUN_ID}"
  IFS=$'\t' read -r STATUS CONCLUSION RUN_URL <<<"$RUN_STATE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] status=${STATUS} conclusion=${CONCLUSION:-pending} ${RUN_URL}"

  if [ "$STATUS" = "completed" ]; then
    if [ "$CONCLUSION" = "success" ]; then
      notify_success
      exit 0
    fi
    echo "Workflow failed: ${RUN_URL}" >&2
    notify_failure
    exit 1
  fi
  sleep "$POLL_INTERVAL_SECONDS"
done
