# 拖动区域与右侧栏伪元素毛玻璃

## PLAN

两个 data-tauri-drag-region 宿主（AiChatSidebar 顶部、SessionTabStrip）及 ChatSidePanel 外容器复用 chat-glass-surface，定位设为 relative，背景透明。右侧内容外壳同步透明。无须改共享 CSS 或新增另一套滤镜。

## 范围

共享 ::before 为绝对定位、inset: 0、z-index: -1、pointer-events: none、圆角继承，使用 blur(10px) saturate(125%) 及 WebKit 前缀。内部 WindowTitleBar 已使用该方案，保持原样。右侧栏只在外层挂一次，拖宽分隔条不加滤镜；保留既有 overflow、折叠宽度、拖动事件和面板挂载逻辑。左侧拖动条位于已有玻璃侧栏内，属于嵌套玻璃，真实视觉与合成效果需原生验收。第三方面板自身不透明背景不在此次覆盖范围。
