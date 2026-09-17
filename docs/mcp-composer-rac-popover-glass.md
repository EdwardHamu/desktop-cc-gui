# Composer 的 React Aria 弹出层补齐毛玻璃

## PLAN 与定位

用户明确选择输入区权限/上下文用量弹窗。data-rac 是 React Aria 自动标记，不仅出现在弹出面板，也出现在按钮、列表和对话框，因此不做 [data-rac] 全局滤镜覆盖。

检查发现 permission-menu.tsx 的 PERMISSION_POPOVER 与 ai-chat-composer.tsx 的 CONTEXT_POPOVER_CLASSES 都独立拼接旧 bg-background-primary-default 样式，未使用 chat-glass-surface。已有 Dropdown/Select 弹出菜单已通过共享 recipe 接入，不属于这两处漏接。

## 修复范围

两处改为 menuPopoverSurface：权限菜单保留 323px、20px 圆角、p-1.5 及上下 placement 对应变换原点；上下文弹窗保留 340px、rounded-2xl、p-2、origin-bottom-right。复用透明伪元素 blur(10px) saturate(125%) 和原有同值动画。React Aria 自身绝对定位为伪元素定位宿主，不增添 relative，不更改触发器、焦点、outside-dismiss、内部内容或遮罩。

新增 composer-popover-styles.test.ts：源码接线及 recipe 参数回归，不等同真实浏览器合成效果测试。本次不改设置/通用对话框、Select 触发器或其他 data-rac 节点。
