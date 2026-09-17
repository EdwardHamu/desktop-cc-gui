# 全局边框统一为白色 14%

## PLAN

用户明确将刚才透明的黑/深灰边框和其他所有 border 统一为 rgb(255 255 255 / 0.14)。修改 theme.css 的全部 border 命名颜色 token，并在 globals.css 仅覆盖 border-color，防止 accent 类、border-transparent、/50 等透明度修饰导致例外。

## 行为

- 主题中包含 border 的颜色变量（普通/hover/active/错误/复选框/焦点/分隔线/磨砂边缘），浅色、深色和 Tailwind 映射统一为指定值。
- 全局元素及 ::before/::after 用 border-color 的 important 声明落实统一颜色，不改宽度、线型、圆角、定位和背景；不存在的边框不凭空新增。
- 滚动条 thumb 的显式透明 border 也同步统一。背景裁剪仍沿用原样。
- 当前语义 token 的错误/焦点差异被统一，浅色背景上白色 14% 对比度较弱，这是用户指定颜色的结果。
- 自定义阴影、直接写死的 outline/ring 不是 CSS border，不做全局清除；引用 border token 的 ring/stroke 等会随变量颜色变化。
- 不改变原生系统窗口边框，不能覆盖第三方 iframe/shadow DOM 内部样式或外部更强的 important 边色规则。
- 保留本次开始前未提交的透明边框改动文档作为历史记录；本实现取代其透明颜色行为。

## 验证

已替换 50 处主题边框颜色声明。pnpm build（TypeScript + Vite）通过，存在大体积 chunk 警告；git diff --check 通过。未执行真实界面视觉和键盘焦点可见性验收，未提交或推送。
