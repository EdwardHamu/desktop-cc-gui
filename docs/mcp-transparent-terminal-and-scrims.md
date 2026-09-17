# 终端与两类遮罩背景透明化

## PLAN

按用户要求仅处理终端内容区默认背景、全窗口壁纸暗化层、小屏侧栏遮罩。保留其他已有变更，不修改文字和交互行为。

- src/features/terminal/appearance.ts：深浅主题背景均设为 rgba(0, 0, 0, 0)，保留字体、前景、ANSI、光标、选区色。
- src/features/terminal/TerminalView.tsx：在创建 xterm 时启用 allowTransparency，配合透明背景，避免仅改变外层 CSS。
- src/styles/globals.css：壁纸 scrim 背景设为 transparent；原 darken 设置仍保留，但不再有视觉暗化作用。
- src/features/chat/ChatSidebarFrame.tsx：bg-black/40 改为 bg-transparent，保留覆盖层和 onClick 关闭侧栏。

此处透明是显露应用下层内容/壁纸，不等于原生窗口穿透桌面。终端程序通过 ANSI 主动绘制的单元格背景和选区仍保留，不强行清除程序自身的颜色。

## 验证

- 新增终端主题测试 2 项通过：浅/深主题默认背景透明，前景、光标、选区颜色保留。
- pnpm exec tsc --noEmit 与 git diff --check 通过。
- 未执行真实 WebView/WebGL 视觉验证；未重启应用、未提交或推送。已有终端实例需重新创建或刷新页面以应用 allowTransparency 创建选项。
