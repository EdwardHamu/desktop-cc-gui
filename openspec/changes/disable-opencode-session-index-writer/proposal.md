# Change: 禁用 Session Index 的 OpenCode 后台 writer

## Why

`session_index::importer` 会在应用启动后持续按 90s cadence 扫描每个 workspace。OpenCode writer 在每次 source fingerprint 变化时执行 `opencode session list --format json`。`opencode.db` 的 mtime 会被后台活动改写，导致该 freshness gate 高频失效，并反复拉起 OpenCode/Bun 子进程。

本 change 让 Session Index 的 OpenCode writer 遵循 CLI 可见性配置：`disabledCliEngines` 未包含 `opencode` 时执行，包含时跳过后台 discovery path。

## What Changes

- `sync_session_index_core` 保留 OpenCode writer，但仅在 CLI 配置启用时调用 `opencode_session_list_core`。
- CLI 配置禁用 OpenCode 时，Session Index 不 spawn OpenCode/Bun，也不改变已有 rows。
- 既有 `session_index` 中的 OpenCode rows 仍保留在 list whitelist，历史行可继续被读取；本 change 不做数据删除或 tombstone。
- 增加 source sentinel，确保 Session Index 以后不会重新引入 OpenCode CLI discovery。

## Non-Goals

- 不禁用用户显式进入 OpenCode conversation、恢复 OpenCode thread 或完整 catalog 的直接 OpenCode 命令。
- 不改变其他 engine 的 importer cadence、timeout 或 source freshness 行为。
- 不删除现有 OpenCode session 数据。

## Acceptance

1. CLI 配置启用 OpenCode 时，Session Index 可调用 `opencode_session_list_core`。
2. CLI 配置禁用 OpenCode 时，importer、soft re-sync 与 explicit Session Index reload 不会从此路径 spawn `opencode` / `bun`。
3. 已落入 SQLite 的 OpenCode rows 仍能通过 Session Index list 读取。
4. 相关 Rust tests、`rustfmt --check`、OpenSpec strict validation 与 `git diff --check` 通过。
