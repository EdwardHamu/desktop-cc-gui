# Change: 禁用 Session Catalog Projection 的 OpenCode discovery

## Why

`disabledCliEngines` 已控制 Session Index writer，但项目管理 `Sessions` 页面触发的完整 Catalog projection 仍在每个 workspace 无条件调用 `opencode_session_list_core`。这会在 OpenCode 被禁用时持续启动 OpenCode/Bun 子进程。

## What Changes

- GUI 与 installed daemon 的 workspace session catalog projection 读取同一份 `AppSettings` 快照。
- 当 `AppSettings.disabledCliEngines` 包含 `opencode` 时，projection 跳过 OpenCode CLI discovery，不调用 `opencode_session_list_core`。
- 返回 OpenCode 的 empty source status（`authoritative_empty`，reason=`disabled-by-settings`），不增加 partial/degraded source。
- OpenCode 未禁用时保持现有 discovery、entry mapping 与错误处理行为。

## Non-Goals

- 不删除或隐藏已有 OpenCode rows。
- 不阻止用户显式启动、恢复或继续 OpenCode conversation。
- 不改变其他 engine source 或 Session Index writer 的既有 gate。

## Acceptance

1. disabled `opencode` 时，Session Management catalog 与 projection summary 不调用 OpenCode CLI。
2. disabled source 在响应中可见且为空，状态 reason 明确为 `disabled-by-settings`。
3. GUI 与 installed daemon 使用同一 settings-aware projection 行为。
4. enabled/默认 settings 保持既有 OpenCode catalog 行为；focused Rust tests、rustfmt、OpenSpec strict validation 与 diff check 通过。
