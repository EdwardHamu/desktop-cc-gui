## 1. Implementation

- [x] 1.1 让 Session Index 的 OpenCode writer 遵循 `disabledCliEngines`，禁用时跳过 CLI 调用。
- [x] 1.2 保持 `INDEX_LIST_ENGINES` 的 OpenCode 历史行 listability，不迁移或删除 SQLite 数据。

## 2. Regression Coverage

- [x] 2.1 更新 engine-table source sentinel：保留 OpenCode listability，断言 writer 与 CLI 配置 gate 同时存在。

## 3. Verification

- [ ] 3.1 运行 focused Rust test、`rustfmt --edition 2021 --check src/session_index/commands.rs src/session_index/store.rs src/session_index/writers.rs`、`openspec validate disable-opencode-session-index-writer --strict --no-interactive` 与 `git diff --check`。
