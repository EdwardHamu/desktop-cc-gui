# 修复 Windows Vitest 的 React Hook 双实例错误

## PLAN

先复现 5 项内部标题栏组件测试错误，再比较组件 ESM 导入与 ReactDOM CommonJS require 得到的 React 对象/Hook 引用。在根因处统一测试运行时路径，不改生产 Hook、不 mock React、不跳过测试、不放宽断言。

## 根因与实验

Windows PortableGit 启动目录盘符是 e:，pnpm 符号链接由 Node realpath 解析为 E:。修复前 React 两侧版本均为 18.3.1，但 useState 和 dispatcher 内部对象不是同一引用；Node require.cache 同时存在 e: 与 E: 前缀的 react/index.js、react/cjs/react.development.js。ReactDOM 激活的是另一个实例的 dispatcher，组件一侧仍为 null。

仅把 Vitest root/alias 改为真实路径能统一 React，但 cwd 仍旧导致 mock ID 与导入目标不一致，20 项旧测试中的 16 项失败。将 process.cwd 同步到真实根目录后，已有 20 项全部通过；临时身份探针也通过。这是有失败/成功对照的路径修复，不是屏蔽错误。

## 实现

- vitest.config.ts 使用 realpathSync.native(__dirname)，统一 root、@ alias、cwd；没有硬编码盘符，POSIX 同样使用实际根路径。cwd 变更只发生在 Vitest 配置加载阶段，测试按项目根目录运行。
- src/lib/react-runtime.test.ts 保留 ESM/CJS React 对象及 useState 引用一致性回归。临时 console 探针已移除。
- vitest.setup.ts 设置 React 官方 act 环境标记，声明 jsdom 并发根测试环境，不 mock Hook、不吞 act 警告或未捕获错误。
- 未更改生产代码、Vite 构建配置、依赖版本或锁文件，未重启应用、未提交推送。

## 最终验证

pnpm exec vitest run src/features/window-chrome src/lib/react-runtime.test.ts src/features/chat/components/MessageTimeline.test.tsx src/features/chat/components/use-composer-images.test.tsx src/features/chat/panel-tabs.test.tsx src/styles/timeline-background-alpha.test.ts：8 个文件、37 项全部通过，无 Invalid hook call 或 act 环境警告。包括标题栏原 6 项、窗口边界 11 项、退出确认 3 项、React 实例回归 1 项、消息列表 8 项、图片 Hook 3 项、侧栏标签 2 项和背景策略 3 项。

pnpm exec tsc --noEmit 与 git diff --check 通过。未跑完整仓库测试或真实原生窗口验收；本结果针对测试运行时根因，不意味着原生拖动/关闭行为已实机验证。
