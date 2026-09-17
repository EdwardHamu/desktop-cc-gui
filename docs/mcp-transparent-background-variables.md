# background 命名变量透明化

## PLAN 与范围

用户确认仅修改变量名包含 background 的 CSS 自定义属性。定位 src/styles/theme.css 的浅色、深色及 Tailwind @theme 映射声明，将值直接设为 transparent，保留变量名称及消费方。

不修改文档示例、变量名不含 background 的颜色、文字/边框 token、直接写死的 background 样式或原生窗口配置；保留已有发布脚本与工作流未提交改动。

## 结果

- 修改 src/styles/theme.css 的 94 处声明，涉及 32 个不同变量名。
- 包含 default、hover、active、disabled、错误/警告背景、徽标、控件内部和状态标签背景；这些区域的背景状态区分会消失。
- 不代表整个界面或原生桌面窗口完全透明；surface、bubble、overlay 等不含 background 的变量保持原值。
- 只按名称筛选，引用这些变量的非背景属性也会随变量值变成透明。

## 验证

主机 Node 断言通过：94 处声明全部为 transparent，32 个变量名称保持不变；与 HEAD 比较确认主题文件其他内容逐字未变。git diff --check 通过，编辑器未返回错误或警告。未执行完整构建或真实界面视觉验证，未提交或推送。
