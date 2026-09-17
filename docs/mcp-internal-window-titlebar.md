# 应用内标题栏

## PLAN

关闭主窗口原生 decorations，移除 macOS Overlay/hiddenTitle 配置。App 全局插入 32px 内部标题栏，聊天内容占剩余高度；移除 macOS traffic-light 预留及旧 Windows 原生标题栏分隔线。浏览器不渲染内部桌面标题栏。既有透明/毛玻璃/边框修改全部保留。

## 行为与权限

- 内部组件提供应用图标/标题、拖动、双击最大化/还原、最小化、最大化/还原、关闭；中文/英文标签、键盘按钮和焦点样式。
- 标题栏拖动只绑定空白/标题区一个 mousedown 处理器，不再叠加 data-tauri-drag-region；窗口按钮不触发拖动。原有标签栏和侧栏拖动行为保留。
- 关闭按钮调用 requestAppClose，复用 CloseConfirmDialogHost；取消不退出，确认后仍经现有 destroy 和 Rust Destroyed 清理链路。直接请求确认避免 native close listener 尚未安装时绕过确认。
- native-window.ts 通过现有 Tauri 窗口 API 边界执行操作。仅 main capability 增加 minimize/toggle-maximize；查询/事件使用已有 core:default，destroy 权限保持原样。不增加远程 origins 或新后端命令。
- 最大化状态由原生 resize 事件同步；订阅卸载及晚到注册均清理，旧查询不覆盖新状态。按钮调用防重入，失败显示可读提示并记录错误。
- 原生 decorations 变更需要重新启动 Tauri 窗口，前端热更新不足以移除已存在的系统标题栏。Windows Snap Layout 悬停菜单等原生非客户区体验不由普通 HTML 按钮提供；系统拖边缩放及各平台行为需要原生验收。
- 本次不修改桌面运行进程，不擅自重启正在进行的会话，不提交或推送。

## 验证结果

- pnpm build（tsc --noEmit + Vite）通过，存在大体积 chunk 警告。
- Vitest 发现 3 个测试文件、20 项用例：15 项通过，5 项失败，另有 5 个未捕获错误。native-window 的 11 项（含边界/权限配置）及 close-confirm 的 3 项通过；组件测试浏览器分支通过，其余 5 项在 useWindowChrome 调用 useState 处报 Invalid hook call / null dispatcher，根因未确定。未跳过测试或放宽断言；不宣称组件交互验收通过。
- git diff --check 通过；新增窗口模块编辑器无错误/警告。
- 未重新启动应用、未执行原生打包或真实 Windows/macOS/Linux 窗口交互验收。原生 decorations/权限变更需重新构建并启动桌面端，现有二进制仅重开不会应用源码配置变化。

## 原生验收清单

确认无系统标题栏且无 macOS 原生按钮空位；窗口标题区拖动与双击最大化；最小化后从任务栏恢复；通过按钮/系统快捷键/拖边吸附后图标同步；窗口按钮不拖动窗口；关闭确认取消与确定；设置弹窗/退出确认中的交互；窗口拖边缩放；浏览器和小屏端无桌面按钮且聊天高度正确。
