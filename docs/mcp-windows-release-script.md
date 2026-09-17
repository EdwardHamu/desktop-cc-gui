# Windows EXE 一键推送与发布

## PLAN

新增 scripts/release-windows-exe.sh，先推送当前 HEAD，再通过 GitHub CLI 调用 .github/workflows/release-windows-exe.yml 的 workflow_dispatch。工作流本身保持不变。只验证脚本，不实际发布。

## 使用

补充：脚本现在在 dispatch 后持续监控并在完成时发出桌面通知，不再立即退出；workflow 已增加可选 request_id 和 run-name 以关联本次运行。持续轮询、超时、通知及重复运行边界详见 docs/mcp-windows-release-monitor.md。下文首次版本的“工作流保持不变”及“打印链接供跟踪”不代表当前完整行为。

需要 Git、Bash（Windows 使用 Git Bash）以及 GitHub CLI。先执行 `gh auth login --hostname github.com`，账号需要仓库推送及 Actions 运行权限。

脚本要求干净工作区，包含新脚本在内的变更必须先提交。不会自动提交、强制推送或创建本地标签。

```bash
# 查看帮助
bash scripts/release-windows-exe.sh --help
# 预览：不推送、不触发工作流、不进行网络认证
bash scripts/release-windows-exe.sh --dry-run
# 推送当前分支到 origin，使用工作流默认标签 v<tauri version>
bash scripts/release-windows-exe.sh
# 推荐为新构建指定唯一标签，避免覆盖已有安装包
bash scripts/release-windows-exe.sh --tag v1.0.3-win.1
# 指定推送远端和目标分支
bash scripts/release-windows-exe.sh --remote origin --branch sync1 --tag v1.0.3-win.1
```

`--branch` 表示把当前 HEAD 推送到该远端分支，不会切换或读取同名本地分支。任意目录均可使用脚本绝对路径调用。

## 安全与失败行为

### 网络重试（本次 PLAN 与行为）

- 将所有联网操作统一接入 retry_network：gh auth status、git push、gh workflow run；本地 Git 查询不重试。
- 默认每个操作最多尝试 3 次（含首次），失败后等待 2、4 秒；指数退避上限 60 秒。
- RELEASE_MAX_ATTEMPTS 可设 1–10；RELEASE_RETRY_DELAY 可设 1–60 秒。非法或空值在联网前报错；设 1 次可禁用重试。
- 示例：`RELEASE_MAX_ATTEMPTS=5 RELEASE_RETRY_DELAY=3 bash scripts/release-windows-exe.sh --tag v1.0.3-win.2`。
- 操作成功即停止重试；次数耗尽非零退出，不进入下一阶段。Ctrl+C/SIGTERM 或子命令返回 130/143 时立即退出，不再重试。
- dry-run 仅输出策略和命令，不认证、不推送、不 dispatch、不等待。
- 所有普通非零失败均会有界重试（包括权限失败和非快进拒绝）；不绕过鉴权，不强制推送，不静默丢弃错误。
- workflow_dispatch 不提供幂等键：请求可能已接收但响应丢失，重试可能排入多个任务；现有 concurrency 只串行执行，不能去重。脚本在 dispatch 重试时警告；耗尽后必须先查看 Actions，不能直接断言未触发。
- 重试次数限制不等于单次请求超时；单次网络连接的超时沿用 Git/GitHub CLI 自身行为。

- 默认推送 origin 的当前分支，解析远端 push URL 决定 GitHub 仓库，避免 fork 的 gh 默认仓库指向 upstream。
- 仅支持 github.com 的 HTTPS、git@ SSH、ssh://git@ URL；拒绝多 push URL、嵌入凭据 URL、脏工作区、无效参数/引用名；detached HEAD 必须显式传 --branch。
- 推送失败不 dispatch；认证失败不推送；dispatch 失败会明确提示 Git 推送已经成功。
- 推送和 dispatch 不是原子操作；如有其他人同时推送同一远端分支，工作流可能使用更新后的分支 HEAD。发布期间应避免并发修改该分支。
- GitHub 要求该 workflow 在默认分支上也存在。release environment 若有审批规则，需要在 GitHub 手动批准。
- 默认标签来自 src-tauri/tauri.conf.json。已有标签时工作流使用 `gh release upload --clobber` 覆盖同名 EXE，不移动旧标签；新构建推荐指定唯一 --tag。
- 成功仅表示 dispatch 请求已被接受，不表示构建、签名或 Release 发布成功。脚本打印 Actions 页面链接供跟踪。
- 仅编写脚本不等于授权本次实际发布；本次不运行真实 push/dispatch。

## 验证记录

- 重试改动：重新运行原有 16 个模拟场景，并新增运行 20 个重试场景，全部通过。覆盖三阶段失败后恢复/耗尽、退避 2/4 秒与 60 秒上限、自定义次数、单次模式、130/143 中断退出、等待被中断、非法配置、dry-run 无网络/无等待和重复 dispatch 警告。git/gh/sleep 均为替身，未触发真实发布。
- 本次 Windows 主机 Git Bash 的 bash -n、--help 及 git diff --check 通过；未提交或推送本次重试改动。

- Windows 主机 Git Bash：bash -n 和 --help 均通过。
- 独立沙箱中对同一脚本使用替身 git/gh 验证 16 个场景：默认参数、自定义参数、dry-run、帮助、缺失/未知参数、脏工作区、detached HEAD、非法分支、非法/多 push URL、认证失败、推送失败、dispatch 失败及 HTTPS/SSH URL 解析，全部通过。
- 上述流程测试不访问 GitHub；真实认证、推送和工作流构建尚未执行。
