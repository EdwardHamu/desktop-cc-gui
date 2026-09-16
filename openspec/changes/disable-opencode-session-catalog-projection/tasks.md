## 1. Implementation

- [x] 1.1 将 GUI 与 daemon 的 Session Management catalog 调用接入 `AppSettings` snapshot。
- [x] 1.2 在 workspace Catalog projection 跳过 disabled OpenCode discovery，并返回 disabled/empty source status。

## 2. Regression Coverage

- [x] 2.1 增加 disabled engine matching 与 source status 回归断言。
- [x] 2.2 保持 enabled OpenCode 与历史 rows 行为不变。

## 3. Verification

- [ ] 3.1 运行 focused Rust test、rustfmt、OpenSpec strict validation 与 `git diff --check`。
