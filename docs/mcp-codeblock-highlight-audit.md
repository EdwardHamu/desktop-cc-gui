# md-codeblock 语法高亮检查

- 检查对象：当前 main 分支的聊天 Markdown 代码块；本次未修改功能代码。
- `src/features/chat/components/Markdown.tsx:274` 已将 cachedHighlight 加入 rehype 渲染管线，代码卡片保留高亮后的 children。
- `src/features/chat/components/cached-highlight.ts:1` 使用 rehype-highlight；模块级初始化并按组件缓存高亮结果。
- 语言标记交给高亮器处理。初始化未启用 detect，已安装 rehype-highlight 的默认 detect=false，因此无语言标记的代码不会自动猜测语言。
- streaming 状态下尚未闭合的 fenced code 暂不高亮；闭合后或消息结束后正常进入高亮流程。
- `src/index.css:285` 起配置 hljs token 颜色，`src/main.tsx` 已导入该样式；色值来自 `src/styles/theme.css` 的浅色/深色 token。
- 当前全局强制主文字色规则包含侧栏、底栏等特定作用域，不是对所有 md-codeblock 的统一覆盖；位于这些特殊作用域内的代码文字可能被覆盖。
- 结论：聊天代码块语法高亮已启用，但不等于未标语言也会自动识别。本次为源码及安装依赖检查，未执行原生 WebView 视觉验收。
