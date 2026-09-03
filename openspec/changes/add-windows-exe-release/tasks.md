# Tasks: add-windows-exe-release

- [x] 新增 Windows-only workflow 与 `workflow_dispatch` input。
- [x] 复用现有 Windows Tauri 构建与 Rust cache 配置。
- [x] 限定 artifact 与 GitHub Release asset 为 `*-setup.exe`。
- [x] 校验 YAML、关键路径与 git diff。
- [x] 新增 push、dispatch、run 监视、网络重试与完成/失败通知脚本。
- [ ] 在真实环境执行一次 Windows workflow smoke。
