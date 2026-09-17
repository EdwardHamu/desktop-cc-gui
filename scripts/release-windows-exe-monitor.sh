#!/usr/bin/env bash
# Sourced by release-windows-exe.sh; uses its retry_network and validated settings.

release_notify() {
  local title=$1 message=$2
  printf '\n%s: %s\n' "$title" "$message"
  # Pass data via environment/argv, never interpolate it into executable code.
  if command -v powershell.exe >/dev/null 2>&1; then
    if RELEASE_NOTICE_TITLE="$title" RELEASE_NOTICE_MESSAGE="$message" \
      powershell.exe -NoProfile -NonInteractive -Command \
      '$ErrorActionPreference="Stop"; $shell=New-Object -ComObject WScript.Shell; [void]$shell.Popup($env:RELEASE_NOTICE_MESSAGE,15,$env:RELEASE_NOTICE_TITLE,64)'; then
      return 0
    fi
  elif command -v osascript >/dev/null 2>&1; then
    if osascript - "$title" "$message" <<'APPLESCRIPT'
on run argv
  display notification (item 2 of argv) with title (item 1 of argv)
end run
APPLESCRIPT
    then return 0; fi
  elif command -v notify-send >/dev/null 2>&1; then
    if notify-send -- "$title" "$message"; then return 0; fi
  fi
  printf '\aWarning: desktop notification unavailable; see the result above.\n' >&2
  return 0
}

monitor_windows_release() {
  local request_id=$1
  local started=$SECONDS run_id= ids= status_line= run_status= conclusion= jobs=
  local previous= deadline=$((SECONDS + watch_timeout))
  local actions_url="https://github.com/$repo/actions/workflows/$workflow"
  local run_url=$actions_url
  local discovery_deadline=$((SECONDS + 600))
  local query='[.[] | select(.displayTitle == "Windows EXE / '"$request_id"'")] | sort_by(.databaseId) | .[].databaseId'
  printf 'Request: %s\nTracking: %s\n' "$request_id" "$actions_url"
  while (( SECONDS < deadline )); do
    if [[ -z "$run_id" ]]; then
      # Only this unique request, never simply the latest branch run.
      if ids=$(retry_network discover gh run list --repo "github.com/$repo" \
        --workflow "$workflow" --branch "$branch" --event workflow_dispatch \
        --limit 100 --json databaseId,displayTitle --jq "$query"); then
        if [[ -n "$ids" ]]; then
          run_id=${ids%%$'\n'*}
          if [[ ! "$run_id" =~ ^[0-9]+$ ]]; then
            release_notify 'Windows EXE monitoring error' "Invalid run ID returned. Check $actions_url"
            return 1
          fi
          if [[ "$ids" == *$'\n'* ]]; then
            printf 'Warning: duplicate dispatch runs found (%s); tracking oldest run %s only.\n' "$ids" "$run_id" >&2
          fi
          run_url="https://github.com/$repo/actions/runs/$run_id"
          printf 'Run identified: %s\n' "$run_url"
        fi
      else
        local code=$?
        if (( code == 130 || code == 143 )); then return "$code"; fi
        # A temporary outage must not be reported as a build failure.
        printf 'Run discovery unavailable after retries; will check again.\n' >&2
      fi
      if [[ -z "$run_id" ]]; then
        if (( SECONDS >= discovery_deadline )); then
          release_notify 'Windows EXE monitoring error' "No matching run found within 10 minutes. Build status UNKNOWN. Check $actions_url"
          return 1
        fi
        printf 'Waiting for the matching workflow run...\n'
        sleep "$poll_interval" || return "$?"
        continue
      fi
    fi

    if status_line=$(retry_network status gh run view "$run_id" --repo "github.com/$repo" \
      --json status,conclusion,jobs \
      --jq '[.status, (.conclusion // "" | if . == "" then "-" else . end), ([.jobs[]? | .name + ":" + .status + "/" + (.conclusion // "")] | join(", "))] | @tsv'); then
      IFS=$'\t' read -r run_status conclusion jobs <<< "$status_line"
      if [[ "$status_line" != "$previous" ]]; then
        printf '[%ss] %s | %s | %s\n' "$((SECONDS - started))" "$run_status" "$conclusion" "$jobs"
        previous=$status_line
      fi
      if [[ "$run_status" == completed && -n "$conclusion" && "$conclusion" != '-' ]]; then
        if [[ "$conclusion" == success ]]; then
          release_notify 'Windows EXE release succeeded' "Build and release workflow completed successfully. $run_url"
          return 0
        fi
        release_notify 'Windows EXE release not successful' "Workflow result: $conclusion. $run_url"
        return 1
      fi
    else
      local code=$?
      if (( code == 130 || code == 143 )); then return "$code"; fi
      printf 'Status query unavailable after retries; build state UNKNOWN, monitoring continues. %s\n' "$run_url" >&2
    fi
    sleep "$poll_interval" || return "$?"
  done
  release_notify 'Windows EXE monitoring timed out' "Build status UNKNOWN; remote workflow was not cancelled. $run_url"
  return 1
}
