# Design: Session Index OpenCode writer follows CLI visibility

## Decision

保留 `sync_session_index_core` 的 OpenCode writer，但在 writer 入口读取 `AppSettings.disabled_cli_engines`。列表不含 `opencode` 时执行既有 CLI discovery；包含时返回 `skipped_fresh`，不进入 fingerprint、timeout 或 CLI 调用。使用现有 CLI visibility 配置，不新增 runtime flag。

## Data Compatibility

`INDEX_LIST_ENGINES` 继续包含 `opencode`。因此已有 rows 与其他创建路径直接写入的 OpenCode rows 不会被 list filter 隐藏；它们只是不会再由后台 importer 自动刷新。

## Risk And Mitigation

- 风险：配置字段格式异常导致误判。
  缓解：判断时 trim 并 case-insensitive 匹配 `opencode`；默认空 blacklist 表示启用。
- 风险：禁用后历史 rows 被隐藏。
  缓解：`INDEX_LIST_ENGINES` 继续包含 `opencode`，仅跳过 writer，不删除或过滤已有数据。
