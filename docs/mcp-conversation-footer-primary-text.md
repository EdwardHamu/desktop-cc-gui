# 会话底部容器统一主文字色

## PLAN

用户指定 mx-auto w-full max-w-3xl 容器的内部文字统一为 --color-text-primary。源码在 ConversationFooter.tsx 中有 4 处匹配：附件、ActiveRunStatus、StatusBar、MessageQueue。新增 conversation-footer-text 语义类并在这些宿主设置 text-text-primary，共享已有局部文字颜色覆盖规则，以覆盖后代显式文字色和交互状态。

## 范围

只作用于这 4 个容器及其 HTML 后代，不用宽度/布局工具类全局匹配。保留布局、背景、整体透明度与功能，SVG 显式颜色不改，currentColor 图标可随宿主变化。通过 portal 渲染到容器之外的弹窗不受影响；容器内原来的警告/次要文字颜色差异会统一为主文字色。
