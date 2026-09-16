# Design: add-windows-exe-release

## Flow

1. `build_windows` 在 `windows-latest` 上执行现有 Tauri NSIS 构建配置。
2. 从 `src-tauri/target/release/bundle/nsis/` 选择唯一 `*-setup.exe`，上传为 workflow artifact。
3. `publish_release` 下载该 artifact，解析 version；`release_tag` 非空时优先使用 input，否则使用 `v<version>`。
4. 若 release 不存在，调用 `gh release create --generate-notes`；若已存在，调用 `gh release upload --clobber`。两条路径都只传 `.exe`。

## Security

使用 job-level `contents: write` 与现有 `release` environment secrets。`GITHUB_TOKEN` 仅用于 release 操作；签名 key 只在 Windows build job 环境中注入。

## Local Automation

`scripts/release-windows-exe.sh` 使用当前 branch 的 HEAD 执行 `git push`，再调用 `gh workflow run`。它用 pushed commit 查询新 run，轮询 `gh run view` 输出 status/conclusion/url；git 与 gh 网络操作共享 exponential backoff retry。完成或失败时按平台调用 `notify-send`、`osascript` 或 Windows PowerShell MessageBox。
