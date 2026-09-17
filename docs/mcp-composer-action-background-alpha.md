# 输入区操作按钮背景透明度

- composer-toolbar.tsx 的发送和停止按钮使用 bg-button-primary/30，背景 alpha 为 0.3。
- 不设置整体 opacity，不改变图标颜色；发送按钮既有禁用态 opacity-40 保留，会继续作用于整个禁用按钮。
- 保留点击行为、尺寸、圆角和动画。本次修改不扩展到其他主按钮。
