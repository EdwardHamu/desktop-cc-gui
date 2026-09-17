# 状态动画降至 5fps

## PLAN

审计所有源码 role=status：持续动画来自 AgentThinking、侧栏/标签栏运行圆点，另有 UpdateToast 的出入场和内部 CSS transition；设置中的纯文字通知无动画。仅降低这些装饰动画的可见更新频率，不节流消息存储/流式文本/输入/滚动或下载数据。

## 实现

- wave/spin 点阵 JS interval 从 80ms 改为 200ms，移除 220ms opacity 平滑插值；相位步长按原 640ms 周期调整，避免只是放慢动画。计时器从 100ms 改为 200ms，仍根据真实时间计算。
- 星星原关键帧曲线重采样为 1.4s 内 7 个等间隔画面，step-end 保持帧；交错延迟也对齐 200ms。∞ 的 1.2s 用 steps(6,end)，2.6s 文字扫光用 steps(13,end)。不对含多个关键帧片段的动画盲用 steps(5)，否则并不是 5fps。
- sidebar-thread-status-processing 心跳重采样为每秒 5 帧；周期由 0.92s 微调至 1s 以对齐 200ms。sidebar-thread-status-unseen 本来静态，不新增动画。
- UpdateToast Motion 出入场改为 200ms 单步保持；已有 status 内 transition 同样按 200ms 单步切换。不为静态元素新增 transition；prefers-reduced-motion 保留/补齐。
- 此处 5fps 指每个装饰动画的可见采样率，不是锁定整个 WebView/显示器刷新率；不声称已测得 CPU/GPU 降幅。计时器和动态业务文字仍保留各自语义，嵌套插件自定义 JS/canvas 动画未被全局劫持。

## 验证

AgentThinking 既有 5 项、新增帧率/计时/卸载清理/减少动态效果/星星延迟/CSS 参数/Toast 单步函数 7 项，以及背景策略 3 项，合计 15 项通过。新增测试使用 fake timers 确认前 199ms 无点阵变化，200ms 边界更新，卸载清理 timer；CSS 检查按关键帧片段数验证采样周期。首次测试中一处换行匹配因 Windows CRLF 失败，统一测试读取的换行后通过，未修改目标行为断言。

pnpm build（TypeScript + Vite）通过，保留大体积 chunk 警告；git diff --check 无输出。未做真实 WebView 可见帧率或 CPU/GPU 测量，未提交或推送。
