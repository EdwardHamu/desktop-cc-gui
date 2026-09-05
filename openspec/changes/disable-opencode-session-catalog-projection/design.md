# Design: Catalog projection follows CLI visibility

## Decision

在 Session Management core 增加接收 `AppSettings` 的实现入口。GUI command 与 daemon bridge 在调用前 snapshot `app_settings`，再把同一引用传入 workspace catalog 与 projection summary 构建。保留无 settings 的测试/兼容 wrapper，默认使用 `AppSettings::default()`。

OpenCode source 在进入 `opencode_session_list_core` 前判断 `disabled_cli_engines`，使用 trim + case-insensitive matching。禁用时直接写入 `WorkspaceSessionCatalogSourceStatus { completeness: AuthoritativeEmpty, reason: disabled-by-settings }`，不写 `partial_sources`，也不修改已存在 entries。

## Rationale

复用现有 `WorkspaceSessionSourceCompleteness`，避免为一个 intentional skip 扩大跨层 enum contract；`authoritative_empty` 表达本轮 source 被明确判定为空，reason 保留用户设置导致的可解释性。GUI 与 daemon 共用 projection implementation，只在 adapter 层取得 settings snapshot，避免双份业务判定逻辑漂移。

## Verification

- Rust unit test 锁定 disabled OpenCode gate helper 的大小写/空白匹配。
- 通过 source sentinel/静态断言确认 disabled 分支位于 CLI call 之前。
- 运行 targeted `cargo test`、`rustfmt --check`、`openspec validate ... --strict --no-interactive` 与 `git diff --check`。
