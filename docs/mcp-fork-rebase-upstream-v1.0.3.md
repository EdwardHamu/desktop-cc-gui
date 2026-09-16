# Fork 重基到 upstream v1.0.3

分支 `sync1`，基线 `upstream/main` = `e125f8605`（v1.0.3）。

## 为什么不是 merge

upstream 在 merge-base `0d1cd763f` 之后重写了架构，370 个 commit：包名由
`ccgui` 0.9.5 变为 `ccgui-next` 1.0.3，包管理器 npm 转 pnpm workspace，
文件数 12655 降到 516。fork 侧 14 个 commit 改过的 15 个文件里，只有
`src/styles/globals.css` 在新版仍然存在（且已是 Tailwind v4 重写版）。

机械 merge 会把已删除的旧模块（`session_index`、`session_management`、
`cc_gui_daemon`、分散 CSS）拖回来。因此采用方案 B：**以 upstream 为新基线，
逐个移植仍有价值的能力**。

## 重基结果

`48ba0b700` = upstream v1.0.3 代码骨架（516 文件）+ fork 治理资产（7655 文件：
`openspec/` `dev-guidelines/` `.agents/` `docs/` `.claude/`）。
`AGENTS.md` 做 semantic merge = upstream 57 行 + fork 治理章节 47 行。

备份：分支 `backup/fork-main-20260916` 与 tag
`backup/pre-upstream-rebase-20260916`，均指向重基前的 `8ca84fa17`。

## Capability matrix：14 个 fork commit 的去向

| 原 commit | 能力 | 处置 |
|---|---|---|
| `68f5280e4` `2e6130cbd` `253ab46c6` `72b40fef2` `35acefc16` | Windows exe 发布 | 移植 → `c8719d410` |
| `6e0394b1b` | 禁用 OpenCode 会话目录投影 | 重定义后移植 → `3cfd963a1` |
| `8bc1c426a` `dc5e4c087` `9083d08cd` `c5b5c0865` `ec0119c6b` `cf8da983a` `8ca84fa17` | 毛玻璃／透明度／壁纸 | Tailwind v4 下重写 → `7723d669d` `6b6744917` |
| `e2b0ed2bd` | npm lockfile 同步 | 自然失效（已转 pnpm） |

## 移植明细

### 1. 会话目录投影跟随引擎开关 — `3cfd963a1`

原实现是 OpenCode 特例。勘察发现 upstream **已内建**完整引擎禁用机制
（`DISABLED_PROVIDER_ID` 伪 provider + `disabled_from` 存档 +
`ensure_engine_enabled` 守发送路径），唯一缺口是
`history::scanner::gather_candidates()` 无条件扫描全部引擎目录。

因此不移植特例，改为新增 `disabled_engines()` 并对 `config::ENGINES` 全表
泛化：filename-keyed 的 7 条链路各自条件 extend，head-keyed 的 4 个引擎在
循环内 `continue`。config 读不出时回退全扫，不会因配置损坏丢历史。

按用户裁决，OpenCode 随配置中的 opencode 一起禁用，而非仅停投影。

### 2. Windows exe 发布流程 — `c8719d410`

新增 `.github/workflows/release-windows-exe.yml`。三条 Windows workflow 分工：

| workflow | 触发 | 产物 |
|---|---|---|
| `build-windows-artifact.yml`（upstream） | push 到 `v1.0.0`/`feat/**`/`fix/**` | run artifact，不发版 |
| `release.yml`（upstream） | 手动 dispatch + 版本校验 | 多平台签名 updater |
| `release-windows-exe.yml`（fork） | tag / 手动 | Windows-only 免签名 GitHub Release |

npm→pnpm 映射：`npm ci` → `pnpm install --frozen-lockfile`；
`npm run tauri -- build` → `pnpm exec tauri build --no-sign`；
`beforeBuildCommand` 原为 `release-notes:generate && tsc && vite build`，
upstream 已无 `release-notes:generate`，改为 `pnpm build`
（= `tsc --noEmit && vite build`）。保留 fork 独有的 sccache +
swatinem/rust-cache + `gh release create/upload` 幂等发布。

### 3. 弹层毛玻璃 — `7723d669d`

原实现依赖已删除的分散 CSS（`main.css`/`themes.*.css`），按 Tailwind v4 的
分层约定重做：

- **token 层**（`theme.css`）：`:root` 定义 `--color-surface-frosted{,-strong,-border}`
  与 `--blur-frosted`，`.dark` 覆盖为石墨色（边框改亮色发丝线，深色画布靠亮边
  分离浮层），`@theme inline` 再导出
- **工具类层**（`globals.css`）：`.surface-frosted{,-strong,-edge}`。先写不透明
  兜底，再在 `@supports (backdrop-filter)` 内覆盖为半透明+模糊；同时输出
  `-webkit-` 前缀兼容 WebView2
- **接入点**：`menu-styles.ts` 的 `MENU_POPOVER_SURFACE` 与 `menuPopoverSurface()`
  一处改动即覆盖全部 Dropdown/Select 浮层

刻意不给画布／侧边栏／消息行加 `backdrop-filter`：会把滚动的会话流提升为
独立合成层，代价高于收益。

### 4. 工作区壁纸 — `6b6744917`

upstream 完全没有壁纸能力，属纯移植。fork 原实现约 5200 行，其中 1218 行
WebGL 流体着色器在 Windows 上被 fork 自己禁用（原
`WorkspaceWallpaperHost.tsx:102`），是死代码，不再回迁。mode 由
`none/fluid/custom` 收敛为 `none/custom`。

三个关键结论：

1. **无需改 Rust**。`AppSettings` 的 `#[serde(flatten)] bin_overrides` 会原样
   round-trip 未知字段，`settings.rs:651` 的 `retain` 只清理非法的 `*Bin`
   **字符串**，`workspaceWallpaper` 是对象，不受影响。
2. **CSP 必须补 `media-src`**。upstream 只在 `img-src` 放行 `asset:`，
   视频壁纸会被静默拦截。媒体走 asset 协议（`protocol-asset` 已启用、
   scope `$HOME/**`），文件字节不经过 IPC。
3. **外壳不透明会完全遮住壁纸**。用 `[data-wallpaper="on"]` 限定作用域，
   仅在壁纸开启时用 `color-mix` 把两层画布调半透明并保留各自主题色；
   未开启时渲染结果与 upstream 一致。

## 验证

| 项 | 结果 |
|---|---|
| `tsc --noEmit` | 通过（装齐依赖前有 723 个报错，全部源于 `node_modules` 陈旧） |
| `vite build` | 通过 |
| `vitest run` | 434 passed；唯一失败 `codex-settle.test.ts` 在空改动基线上同样失败，属 upstream 既有问题 |
| 新增单测 | 壁纸 12 个（消毒/降级/路径解析）、scanner 2 个回归测试 |
| Tailwind 编译探针 | 以真实 `theme.css`+`globals.css` 过 v4 编译器，9 项断言全过 |
| `rustfmt --check` | 改动区 clean；存量违规 21→18 且全在改动区外 |

**Rust 无法本机编译**：`openssl-sys v0.9.117` 是直接依赖且 `features=["vendored"]`
（`Cargo.toml:35`，为统一 git2→libgit2-sys/libssh2-sys 的 feature），其 build
script 需要 perl，本机唯一 perl 是 Git Bash 自带的且缺 `Locale::Maketext::Simple`。
`3cfd963a1` 的逻辑改用隔离最小 crate 复刻验证（6/6 通过）。**CI 仍需跑一次
`cargo test` 把关。**

## 遗留

- `sync1` 仅本地，尚未 `git push`
- 壁纸未移植：媒体库／多壁纸轮播／WebGL 流体（按裁决砍掉）
- `codex-settle.test.ts` 的 upstream 既有失败未处理
