# 消息区与输入框居中对齐

- `MessageTimeline.tsx` 的 `data-virtual-inner` 使用与 Composer 相同的 `mx-auto w-full max-w-3xl` 宽度约束。
- 锚点导航的 72px 安全带改为左右对称，避免导航出现时消息区中心右移；无导航时保持左右 16px。
- 滚动容器使用 `scrollbar-gutter: stable both-edges`，平衡非覆盖式滚动条占位，不添加 JS 测量或帧循环。
- 保留毛玻璃、圆角、虚拟列表定位和文字左右 10px 内边距。
- 窄窗口下消息区因导航安全带可能比输入框窄，但中心线保持一致。此改动不强制所有尺寸下两者边缘等宽。
- 原生 WebView 视觉验收未执行；不支持 both-edges 的旧 WebView 仍可能有滚动条宽度一半的中心偏差。
