# 聊天容器伪元素毛玻璃

## PLAN

用户要求 composer 输入框背景透明，并为 composer、侧栏、data-virtual-inner 三处容器采用伪元素毛玻璃，值为 blur(10px) saturate(125%)。复用独立 chat-glass-surface 类，不复用原先带底色的 surface-frosted。

## 实现与边界

- src/components/application/ai-chat/ai-chat-composer.tsx：展开时的输入框外壳改为 bg-transparent 并启用 chat-glass-surface；编辑区原本已为 bg-transparent，不往 contentEditable 内添加装饰节点，以免干扰占位符与补全文字伪元素。折叠时保持原先的透明缩条。
- src/components/application/ai-chat/ai-chat-sidebar.tsx：侧栏 aside 本体透明，使用 relative 定位和通用玻璃类；小屏 max-md:absolute 定位照旧。
- src/features/chat/components/MessageTimeline.tsx：仅在 data-virtual-inner 上加类，保留原总高度、relative 定位和虚拟行 translateY/measureElement。
- src/styles/globals.css：仅 ::before 执行 blur(10px) saturate(125%)，提供 WebKit 前缀。无半透明白/黑色洗底，宿主与伪元素背景色均为透明。
- isolation:isolate 将 z-index:-1 的伪元素限定在宿主内部；内容正常绘制在其上。pointer-events:none 不拦截鼠标事件；border-radius:inherit 保留输入框圆角。
- 不统一修改子元素定位/z-index、不新增 overflow:hidden、不改布局/虚拟列表计算、不创建真实背景 DOM 节点；原侧栏自身的 overflow-hidden 保留。
- 不支持 backdrop-filter 时仍保持透明，降级为无模糊效果。纯色底上不一定能看出毛玻璃，需要下层有纹理/壁纸。
- 这是 CSS 毛玻璃，不是原生窗口透明。毛玻璃仅作用于容器下方图像，不直接模糊输入内容/消息文字。

## 平台与性能限制

Windows WebView2、macOS WKWebView、Linux WebKitGTK 的合成效果尚未真机验证。本次不添加平台隐藏逻辑，不修改壁纸图片/视频播放或引入 WebGL 背景。项目规范提示 WebView2 对 backdrop-filter 叠加 WebGL 存在黑底风险；未来引入该类壁纸时须独立验证。

data-virtual-inner 的高度是整段虚拟列表总高度，长会话可能产生较大的滤镜表面；不能仅凭伪元素或虚拟化声称没有性能开销，需真机检查长消息滚动、菜单层级、缩放、侧栏收起/展开及流式更新。

## 验证结果

- pnpm build 通过（TypeScript + Vite，退出码 0）；存在大于 500 kB 的 chunk 提示，不属于构建失败。
- globals.css 编辑器诊断未返回错误或警告；git diff --check 通过。
- MessageTimeline.test.tsx 与 use-composer-images.test.tsx 合计 11 项：5 通过、6 失败，并有 7 个运行错误；日志出现 Invalid hook call 与 useState 读取 null，未修复或跳过测试。未对改动前基线运行对照，不能直接断言这些失败与本次无关。
- 未执行 Windows/macOS/Linux 实际 WebView 视觉、输入、滚动性能验收；未重启应用、未提交或推送。

## 后续验证：React Hook 测试运行时修复

先前记录的 Invalid hook call 已定位为 Windows 盘符大小写导致 React 双实例。Vitest 路径统一后，MessageTimeline 8 项、use-composer-images 3 项全部通过，无需更改生产组件或放宽测试断言。详见 docs/mcp-react-hook-test-runtime.md；此测试结果不替代真实 WebView 毛玻璃合成/性能验收。
