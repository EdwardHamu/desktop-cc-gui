# 弹出菜单伪元素毛玻璃

## PLAN

对已有绝对定位弹出菜单复用 chat-glass-surface，不给所有 absolute 元素打全局补丁。在 src/components/base/dropdown/menu-styles.ts 的两个公共菜单样式入口替换旧 surface-frosted，避免宿主旧磨砂和伪元素滤镜叠加。

## 范围与行为

- ComposerPickerMenu 的 absolute 菜单使用 menuPopoverSurface，包含 @ 文件和 / 命令选择。
- 共用 menuPopoverSurface 的 add-menu、cli-menu、branch-menu、project-folder-menu、HeaderOpenActions 也统一使用此背景。
- MENU_POPOVER_SURFACE 用于 React Aria 定位的 Dropdown/Select 弹层，跟随同一修改。Select 的触发按钮不是弹出菜单，不改其 surface-frosted。
- 菜单宿主透明，::before 使用 backdrop-filter: blur(10px) saturate(125%) 及 WebKit 前缀；继承圆角、pointer-events:none、隔离的负 z-index，直接复用 src/styles/globals.css 的已有实现。
- 保留原定位来源、left/bottom、z-index、边框、阴影、菜单行状态、进出场动画、键盘操作和滚动设置。不增加 relative 类覆盖绝对定位，也不新增 overflow 裁剪。
- 图表 tooltip、消息锚点提示、状态展开面板、搜索覆盖层和拖动手柄不是本次菜单范围，不因含 absolute 而改动。
- 不支持 backdrop-filter 时透明降级；真实 WebView 合成、滚动菜单滤镜覆盖和点击交互仍需要视觉验收，不能将样式类测试当作真机通过。

## 验证

新增 menu-styles.test.ts 的 2 项测试通过，验证两个公共入口都启用透明伪元素玻璃且移除旧 surface-frosted，并保留宽度、圆角、padding 和定位来源。TypeScript 类型检查及 git diff --check 通过。未执行真实 WebView 菜单视觉和交互验证；未提交或推送。上一任务中的 React Hook 测试失败并未由这两项样式测试解决。
