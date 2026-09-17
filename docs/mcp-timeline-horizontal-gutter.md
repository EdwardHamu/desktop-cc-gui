# 虚拟消息列表左右留白 10px

## PLAN

data-virtual-inner 内每行使用 absolute + left: 0 + width: 100%，外层 padding 不能使行按普通文档流内缩。将行改为 left: 10 / right: 10，移除显式 width，让绝对定位的自动宽度收缩 20px；同时移除用户消息容器的 -mr-1.5，避免突破右留白。

## 范围与验证

仅修改 MessageTimeline.tsx 的两处布局。用户/助手消息、工具过程、权限卡片和尾部思考指示共用该行布局。保留 measureElement、data-index、translateY、总高度、背景、圆角与虚拟化结构；换行后的高度仍由原有测量更新。组件自身内边距继续保留，所以气泡文字可能比容器边缘多缩进一些。任意插件主动溢出不由该留白约束强行裁剪。

pnpm exec tsc --noEmit 与 git diff --check 均通过。未进行实际窗口布局/滚动验证，未提交或推送。
