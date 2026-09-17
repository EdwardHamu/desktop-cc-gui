# Alert 毛玻璃与关闭态开关

- div[role="alert"] 与 chat-glass-surface 共用静态壁纸缓存伪元素；不引入实时 backdrop-filter、额外快照或定时器。
- 仅匹配 div，不改变 p/span 提示。定位兜底放在 base layer，保留 sticky/absolute/fixed utility 优先级；保留颜色、交互、圆角和滚动布局。
- 共享 SwitchTrack 关闭轨道使用 neutral-200 / 深色 neutral-700，滑块使用 white → neutral-50，不再依赖已透明化的通用背景 token。
- 不对所有 data-react-aria-pressable label 设置背景，避免影响单选、复选等其他控件。保留开启态强调色、禁用态半透明和焦点环。
- 原生 WebView 视觉验收待确认。本次未提交、未推送。
