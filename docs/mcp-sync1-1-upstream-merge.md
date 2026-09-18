# sync1.1 合并 upstream v1.0.5

## 计划与边界

从 main `339f3a692f8d07a29d197223a80562549f882a8c` 创建 sync1.1，合并 upstream/main `85acd141ecf7d6d2741a7bc4137dff35fb2a6983`，上游版本 1.0.5。合并前工作区干净，保留 main，不重置或重基，不整文件 ours/theirs 覆盖。此次只做本地合并，不推送。

## 冲突能力矩阵

| 入口 | 本项目必须保留 | 上游接入/合并方式 |
| --- | --- | --- |
| lib.rs / tauri.conf.json | devtools、通知 observer、无原生装饰的内部标题栏 | 保留 restart IPC 与 setup 动态建窗；只建一个 main 窗口 |
| titlebar/settings/chrome | 默认内部标题栏、毛玻璃、关闭确认 | 增加 internal 模式作为默认，兼容 native/mac 可选样式；避免重复窗口按钮 |
| sidebar | 毛玻璃、主文字色 | 使用上游 SidebarDragStrip 抽取，在新组件保留玻璃 |
| MessageTimeline | 10px 文字留白、居中最大宽度、缓存玻璃 | 接入 UserMessageRow 智能体标记/复制过滤，不恢复负外边距 |
| SessionTabStrip | 玻璃、拖动、无重复类型 | 接入 SessionTab/useTabDragReorder/useTabStripChrome 拆分 |
| GeneralSection/i18n | 壁纸设置、通知设置 | 合并标题栏设置及双语词条 |
| Vitest | Windows canonical root、单React运行时与setup | 保留上游测试路径 include |

## 验证计划

检查所有冲突标记、TypeScript、Vite构建、相关前端回归及流式/消息测试；Rust 验证根据实际环境报告，不把前端通过视为原生验收。完成后写入最终结果并生成中文 merge commit。


## 最终验证与限制

- 10 个原始冲突文件已逐项合并；titlebar 增加 internal 默认值，保留 upstream native/mac 选项。启动样式跨组件重挂载冻结，保存设置不会在原生窗口重建前切换按钮；关闭按钮继续使用本项目关闭确认入口。
- 用户消息改用 upstream UserMessageRow，保留智能体标签及复制过滤，同时移除回归的负右边距；保留缓存玻璃、最大宽度和 10px 行内边距。
- 全量 Vitest：100 文件、609 项通过。另有 Node 流式/Markdown 回归 25 项通过。
- TypeScript 与 Vite 生产构建通过；构建有既有大 chunk 警告，未启动或重启原生应用。
- Cargo.lock 自动合并后主包版本仍为 1.0.4，已由 Cargo 离线更新为 1.0.5；locked/offline metadata 通过。
- 完整 Cargo 检查被本机 vendored OpenSSL 的 Perl 缺少 Locale/Maketext/Simple.pm 阻塞，尚未证明原生整包编译或视觉运行通过。
- Rustfmt 对 lib.rs/settings.rs 检查非零，合并前同两文件基线也非零；遵循禁止无关整文件格式化规则，没有进行全文件重排。检查日志留在临时目录，不混入代码。
- 最终合并包含上游的大量智能体目录与功能文件；不将上游的大批新增文件误记为手工冲突修复。
- main 保持原提交；仅在 sync1.1 生成双亲合并提交，不推送远程。
- 暂存差异检查在上游原样引入的智能体 prompt 中报告空白和一行 Markdown `=======` 分隔符；37 个被标记文件均逐字节等于 upstream/main。排除该第三方目录后差异检查通过；没有为通过检查重写上游 prompt。无未解决索引项，无真正的冲突开始/结束标记。
