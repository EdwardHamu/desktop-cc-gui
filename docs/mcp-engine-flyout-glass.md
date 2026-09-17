# 修复模型子菜单漏接毛玻璃

## PLAN 与根因

用户指出 absolute left-full bottom-0 z-10 ml-2 子菜单没有毛玻璃。搜索唯一命中 engine-model-panel.tsx 的 FLYOUT_CLASSES：该桌面模型子菜单自行拼接旧背景样式，没有使用共享 menuPopoverSurface，因此此前菜单样式修改未覆盖它。不是仅凭 absolute 定位就能自动继承父菜单的毛玻璃伪元素。

## 修复

EngineFlyout 改为复用 menuPopoverSurface，保留 absolute/left-full/bottom-0/z-10/ml-2、w-80、最大宽度、rounded-lg、p-1、边框与阴影。共享规则提供透明背景及 chat-glass-surface::before 的 blur(10px) saturate(125%)；继承共同进入/退出样式。外层不加 relative 或 overflow 裁剪，滚动继续由内部模型列表负责；移动端第二层弹窗不改。

## 回归验证

新增 engine-model-panel.test.tsx，用实际 React 渲染模型子菜单；仅隔离翻译和与本修改无关的 effort 滑块。修复前准确失败于缺少 chat-glass-surface。测试同时约束定位/宽度/圆角/透明背景、内部列表滚动类及模型点击回调。不以 jsdom 类名检查冒充真实 WebView 视觉验收。
