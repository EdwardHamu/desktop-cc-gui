# 消息列表背景色 30%

## PLAN

用户确认只调整现有有色背景，已透明的背景不恢复原色。范围为 data-virtual-inner DOM 后代，不修改全局颜色变量，不把 opacity 设置在组件上。

## 实现与范围

src/styles/globals.css 增加局部颜色规则：用户气泡及折叠渐隐层、展开/收起按钮白底、图片占位/错误提示白底、工具差异行红绿底、bg-current 思考指示/过程连接线、图片查看器黑色遮罩。bg-button-primary 也按主题变量映射（若主题未定义该变量，不创造底色）。

颜色使用原色与透明色混合 30%；已有 /5、/10、/15、/20、/25、/40 修饰的色彩底色直接设为 0.3，而非再次乘以 0.3。图片内容、字体、图标、边框、阴影、毛玻璃、圆角和虚拟高度不修改。透明的 Markdown 代码块、表格、工具卡片底色保留。差异行透明 hover 状态保留。

审计涉及 MessageTimeline、CollapsibleMessage、MessageImages、GrantCard、ProcessDisclosure、ToolPayloadViewer、Markdown、task-list、agent-thinking、agent-log，以及 src/index.css 的 Markdown 背景。现有内置有色背景按以上规则覆盖；未来新增颜色类、任意第三方插件内联背景、iframe/shadow DOM 或 portal 到列表外的界面不会自动规范化，需要相应扩展规则。嵌套半透明背景可能叠加，0.3 指每层背景色 alpha，不代表合成后总 alpha。

## 验证

pnpm build 通过（大体积 chunk 警告）；src/styles/timeline-background-alpha.test.ts 的 3 项样式策略回归检查全部通过，包含选择器范围、只改背景、内置颜色覆盖和 94 个原透明声明保留；git diff --check 通过。测试是源码约束检查，不等同浏览器 computed style 或原生 WebView 视觉验收。本次未进行真实界面验证，未提交或推送。
