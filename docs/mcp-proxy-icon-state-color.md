# 代理图标状态色

- ai-chat-composer.tsx 的 Globe SVG 直接设置语义 color，避免按钮主文字色覆盖继承颜色。
- 开启绿色（notification-success-foreground），关闭灰色（foreground-icon-tertiary），随浅色/深色主题变化。
- 保留代理开关、提示、aria-pressed、禁用态和无有效地址时隐藏的行为，不改变全局文字颜色。
- 新增源码回归检查；原生窗口视觉效果待确认。
