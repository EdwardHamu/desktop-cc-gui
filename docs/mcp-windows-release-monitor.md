# Windows EXE 持续监控与通知

## PLAN

在现有推送、重试功能上增加唯一 request_id，与 workflow run-name 关联；新增独立 monitor helper，通过带重试的 GitHub CLI 查询等待整条工作流结束，并触发本地通知。不实际发布。

## 使用

提交所有变更后，照常运行 `bash scripts/release-windows-exe.sh --tag v1.0.3-win.2`。默认不再提交请求后立即退出，而是保持终端运行直到打包及发布全部结束。

- 默认每 20 秒查询，最长监控 7200 秒；RELEASE_POLL_INTERVAL 可设 1–300 秒，RELEASE_WATCH_TIMEOUT 可设 1–86400 秒。
- 示例：`RELEASE_POLL_INTERVAL=10 RELEASE_WATCH_TIMEOUT=14400 bash scripts/release-windows-exe.sh --tag v1.0.3-win.2`。
- CLI 需 GitHub Actions 读取权限；状态与 job 摘要变化时输出进度和 run URL。
- Windows 使用 PowerShell/WScript.Shell 本地弹窗（15 秒自动关闭）；macOS 使用 osascript；Linux 使用 notify-send。无图形会话或通知失败时降级为终端文本及响铃，不伪造弹窗成功。
- success 通知以整条 workflow（包括 publish_release）完成为准；失败、取消、跳过等非 success 结论提示失败并返回非零。
- 单次查询耗尽重试后仍继续下一轮，不把断网说成打包失败；监控超时提示 UNKNOWN，返回非零，不取消线上任务。
- Ctrl+C 停止本地等待，不取消 GitHub 上的构建。保持终端开启；没有安装后台守护进程。

## 运行关联与限制

- request_id 在一次脚本调用及其 dispatch 重试间保持稳定，用于精确匹配 displayTitle，不使用“最新一次运行”推断。
- 工作流新增可选 request_id 输入及 run-name。旧的手动触发仍可用，默认名称使用 github.run_id。需要先提交并推送这次 YAML 改动，且默认分支也应具备 workflow_dispatch 入口。
- 查询最多最近 100 个该分支手动运行；10 分钟内找不到匹配请求则明确报告 UNKNOWN，不退回匹配其他人的运行。
- dispatch 响应丢失时即便重试耗尽，也先搜索本次 request_id，因为远端可能已经受理。
- 发现同一 request_id 的多个运行时警告，并固定跟踪最早的那个；不保证没有更晚出现的重复运行，不自动取消他人/重复任务。concurrency 只串行运行、不去重。
- 监控截止时间在轮询边界检查，重试或单个网络调用可能让实际等待略超限；联网重试沿用主脚本的配置。
- 本次不修改实际构建命令或发布逻辑，不自动打开网页、不执行真实网络发布。

## 验证记录

- Windows Git Bash：两个脚本的 bash -n、主脚本 --help、git diff --check 通过。
- 独立沙箱 24 个完整脚本模拟场景通过：打包完成后发布仍进行、运行延迟出现、发现/状态查询重试及耗尽后恢复、dispatch 响应丢失、重复运行关联、成功/失败/取消/超时/跳过、通知失败降级、异常 run ID、监控超时、认证/推送失败、查询被中断、dry-run 和非法参数。
- Git、GitHub CLI、等待及通知均用替身。真实 GitHub workflow、Windows 弹窗、macOS/Linux 通知尚未实测，不将模拟结果当作线上发布成功。
