# Proposal: add-windows-exe-release

## Why

现有 `release.yml` 会同时构建并发布 macOS、Linux、Windows 与 web assets。需要一个轻量的 Windows-only 发布入口，用于快速验证或单独分发 installer。

## What Changes

- 新增 `.github/workflows/release-windows-exe.yml`。
- 新增 `scripts/release-windows-exe.sh`，串联 push、workflow dispatch、run 监视与桌面通知。
- 通过 `workflow_dispatch` 触发，支持 `gh workflow run`；可选指定 release tag，默认使用 `src-tauri/tauri.conf.json` 的 version。
- 仅构建 Windows NSIS `*-setup.exe` 并创建/更新 GitHub Release；不上传 `.sig`、其他平台产物或 web assets。

## Scope

本 change 只调整 CI/CD automation，不改变应用运行时、安装包内容或版本号。
