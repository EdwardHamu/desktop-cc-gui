# 背景样式排查

静态排查 src 源码；不包含运行时插件注入样式、依赖包内部样式或实际 WebView 合成结果。本次不修改功能代码。

## 硬编码且影响大区域

- src/features/terminal/appearance.ts:15,38：xterm 主题背景固定为 #0d0d0d / #ffffff。src/features/terminal/TerminalView.tsx:62,140 将此主题传给终端。外部 CSS 容器透明不等于 xterm 内容透明。
- src/styles/globals.css:473-493：壁纸层 fixed/inset:0，scrim 的 background-color 为 #000。src/features/theme/WorkspaceWallpaperHost.tsx:84-85 仅 darken > 0 时挂载，opacity=darken/100。属于全窗口遮罩，不是始终显示的黑底。
- src/features/chat/ChatSidebarFrame.tsx:120-125：小屏侧栏打开时 absolute inset-0 的 bg-black/40 遮罩；md:hidden，属于条件显示的大面积覆盖层。

## 未被上次按变量名筛选覆盖的变量背景

- src/styles/theme.css:213,370：--color-overlay-backdrop 为黑色 40%/60%。使用于全屏对话框遮罩 src/components/dialogs.tsx:52、设置遮罩 src/components/application/settings/settings-modal.tsx:268、命令面板遮罩 src/features/commands/CommandPalette.tsx:145、图片查看器 src/features/chat/components/MessageImages.tsx:45。
- src/styles/theme.css:229-230,377-378：surface-frosted 系列保留浅色白色 82%/92%、深色近黑 78%/90%。src/styles/globals.css:443,527 使用；实际消费包括 src/components/base/dropdown/menu-styles.ts:21,49 与 src/components/base/select/select.tsx:107。主要影响浮层而不是全屏主容器。不能仅凭 strong 类定义宣称所有强磨砂面板生效，需考虑 CSS 顺序。
- src/styles/theme.css:211,369 与 src/features/chat/components/MessageTimeline.tsx:246：用户消息气泡沿用 accent 色，长消息可占较大区域。

## 主框架

src/features/chat/ChatPage.tsx:174 的全屏根壳为 bg-background-secondary-default；:211 的主体内容为 bg-background-primary-default，已受上次透明变量修改影响。src/features/terminal/TerminalDock.tsx:103 和 TerminalView.tsx:164 的外容器同样使用已透明的背景 token。

## 小区域及不宜批量删除的背景

- src/features/settings/WebAccessSection.tsx:199、AboutSection.tsx:174：局部 bg-white 容器。
- src/features/chat/components/CollapsibleMessage.tsx:15、MessageImages.tsx:108,117：bg-white/25、/40、/20、/15 按钮/占位图/提示背景。
- UsageChart.tsx 与 agent-limits-card.tsx 的 backgroundColor 主要为图例/进度条。
- src/styles/globals.css:29-43,314-327 的 background-image 用于 background-clip:text 的文字流光；不能当容器背景清除，否则可能导致透明文字不可见。

优先排查终端内容、壁纸暗化层和各类全屏遮罩；主壳布局本身未发现独立写死的不透明纯色背景。未进行视觉实测。
