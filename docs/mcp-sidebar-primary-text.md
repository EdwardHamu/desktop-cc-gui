# 侧边栏统一主文字色

## PLAN

给 AiChatSidebar 的 aside 标记 data-chat-sidebar，在 globals.css 仅该范围覆盖文字 color 为 var(--color-text-primary)，不改全局主题变量。覆盖嵌套会话/工作区/分组/辅助文本与交互状态的显式文字色，输入占位文字也统一。

## 范围

浅/深主题跟随现有 text-primary。布局、背景、边框、字体及节点整体 opacity 保持不变。SVG 自身显式颜色不覆盖；以 currentColor 继承宿主色的图标会随宿主文字变化。不覆盖 portal 到侧边栏 DOM 外的菜单/弹窗。该规则放在 timeline 背景策略前，避免改变已有策略测试的截取边界。
