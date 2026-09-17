# 开发者工具快捷键

## PLAN

- 复用 src/features/shortcuts/runtime.ts 的分发链，在普通可配置动作前识别固定调试快捷键。
- F12（各桌面平台）、Ctrl+Shift+I（Windows/Linux）、Command+Option+I（macOS）打开当前窗口的开发者工具；已打开时不主动关闭。
- 仅桌面 Tauri 环境调用原生 IPC，不接入 src/lib/transport.ts 的远端 Web bridge。
- 开启 Tauri devtools feature，使 release 也支持；不自动打开、不添加系统全局快捷键。
- 忽略输入法组合过程，吞掉按住重复触发，保留输入区使用，沿用 runtime 卸载清理。

## 实现路径

- src/features/shortcuts/devtools.ts：按键与桌面环境保护、失败日志。
- src/features/shortcuts/runtime.ts：接入既有分发器。
- src-tauri/src/devtools.rs：异步 command，仅操作调用者 WebView。
- src-tauri/src/lib.rs：模块和 command 注册。
- src-tauri/Cargo.toml：开启 devtools feature。

## 边界与验证

原生开发者工具没有纯 Web 等价实现；仅在用户按键时调用，无持久化启动设置。
Windows、macOS、Linux 的真实窗口行为尚未人工验证。macOS release devtools 使用私有 API，不适合 Mac App Store 分发；本项目当前为 Developer ID 直接分发。
本次不修改自定义快捷键设置协议，调试键为固定快捷键。

## 已执行验证

- pnpm exec tsc --noEmit：通过（退出码 0）。

- Vitest：devtools.test.ts、runtime.test.ts、shortcuts.test.ts，3 个文件共 25 项通过。
- 新增 Rust 模块 rustfmt 检查通过；lib.rs 检查报告已有模块排序及 interval 换行差异，遵守局部格式化规则未改无关代码。
- 快捷键目录及新增 Rust 模块的编辑器诊断均无错误或警告；git diff --check 无输出。
- cargo check --locked 被本机 OpenSSL 构建依赖阻塞：Perl 缺少 Locale/Maketext/Simple.pm，未完成 Rust 编译验证；未擅自安装或调整系统依赖。
- 未重启应用、未验证真实窗口弹出、未打包 release、未提交或推送。
