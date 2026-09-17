# 底栏毛玻璃与主文字色

## PLAN

用户指定的 h-7 / max-md:hidden 底栏为 AppStatusBar。宿主增加 chat-glass-surface relative 与透明背景，复用 ::before 的 blur(10px) saturate(125%)，保留高度、响应式隐藏、边框与交互。

## 范围

根节点标记 data-app-status-bar，文字使用 text-text-primary；将已有侧栏主文字色规则扩展到此标记的 HTML 后代，覆盖同步进度、分隔符、版本按钮 hover 及插件文本的其他颜色。SVG 自身显式颜色保持原样，currentColor 图标跟随宿主；不改变背景、整体 opacity 或业务逻辑。Portal 到底栏外的更新日志弹窗不受此文字选择器影响。

新增底栏组件样式回归断言，复查插件注册/卸载/排序/异常隔离及版本按钮交互。
