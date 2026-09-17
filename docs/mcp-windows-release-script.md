# Windows EXE 一键推送与发布

## PLAN

新增 scripts/release-windows-exe.sh，先推送当前 HEAD，再通过 GitHub CLI 调用 .github/workflows/release-windows-exe.yml 的 workflow_dispatch。工作流本身保持不变。只验证脚本，不实际发布。

## 使用

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

- 默认推送 origin 的当前分支，解析远端 push URL 决定 GitHub 仓库，避免 fork 的 gh 默认仓库指向 upstream。
- 仅支持 github.com 的 HTTPS、git@ SSH、ssh://git@ URL；拒绝多 push URL、嵌入凭据 URL、脏工作区、无效参数/引用名；detached HEAD 必须显式传 --branch。
- 推送失败不 dispatch；认证失败不推送；dispatch 失败会明确提示 Git 推送已经成功。
- 推送和 dispatch 不是原子操作；如有其他人同时推送同一远端分支，工作流可能使用更新后的分支 HEAD。发布期间应避免并发修改该分支。
- GitHub 要求该 workflow 在默认分支上也存在。release environment 若有审批规则，需要在 GitHub 手动批准。
- 默认标签来自 src-tauri/tauri.conf.json。已有标签时工作流使用 `gh release upload --clobber` 覆盖同名 EXE，不移动旧标签；新构建推荐指定唯一 --tag。
- 成功仅表示 dispatch 请求已被接受，不表示构建、签名或 Release 发布成功。脚本打印 Actions 页面链接供跟踪。
- 仅编写脚本不等于授权本次实际发布；本次不运行真实 push/dispatch。

## 验证记录

- Windows 主机 Git Bash：bash -n 和 --help 均通过。
- 独立沙箱中对同一脚本使用替身 git/gh 验证 16 个场景：默认参数、自定义参数、dry-run、帮助、缺失/未知参数、脏工作区、detached HEAD、非法分支、非法/多 push URL、认证失败、推送失败、dispatch 失败及 HTTPS/SSH URL 解析，全部通过。
- 上述流程测试不访问 GitHub；真实认证、推送和工作流构建尚未执行。
