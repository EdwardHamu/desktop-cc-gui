# 毛玻璃改用静态壁纸缓存

## PLAN 与用户选择

用户目标是减少所有玻璃容器重绘，确认选择：动态壁纸继续播放，玻璃使用静态快照。真实 backdrop-filter 对背后的每次动画变化都可能重新采样；浏览器文字、滚动、变换和布局绘制无法禁止。因此本实现移除实时滤镜，不承诺整个页面零重绘。

## 架构

WorkspaceWallpaperGate 挂唯一 useGlassWallpaper 缓存所有者。壁纸路径变化时通过独立媒体元素解码一次，冻结首帧（图片/GIF/视频），不会 seek/play/pause 原来的可见壁纸。pause/currentTime/timeupdate 不参与失效。每份原始快照及最终纹理最长边限 1600px，不乘设备 DPR，避免各个虚拟列表/面板分配大滤镜面。

壁纸帧按 cover/contain/center/fill 和现有 blur 放大规则组合到视口画布，叠加 darken；10px 模糊 + 125% 饱和度在 Web Worker 中预计算，使用 3 次盒式滤波近似高斯。输出为不透明 JPEG blob，一张 object URL 通过 --glass-wallpaper-image 被所有容器共享。主线程仅合成/像素拷贝/编码提交，不跑持续滤镜；不依赖 Canvas filter 的平台支持。

重建条件：换壁纸、blur/darken/objectFit 配置、明暗主题（背景留白底色）、窗口 resize 停止 250ms 后。调整大小时暂用旧图缩放，既有原始冻结帧复用，不重新抽取视频帧。只保留当前原始帧和当前已发布 URL，替换时 revoke 旧 URL；异步结果用 AbortSignal 防止过期结果发布，取消时终止 worker，解码/worker 有 20s 超时。无定时轮询、逐帧 RAF 或每容器 observer。

## 覆盖与视觉取舍

- chat-glass-surface::before 改为静态图片，保留定位/圆角/不拦截鼠标/负层级与宿主 isolation。
- 旧 surface-frosted / strong 复用同一缓存并保留自己的浅/深色覆盖层；不再使用旧 16px / 180% 实时滤镜。
- CliConfigBody 唯一独立 backdrop-blur-[1px] 也改为缓存层；不全局覆盖第三方插件任意 backdrop-filter。
- background-attachment: fixed + 100vw/100vh 避免每个容器做独立模糊或 JS 测量；浏览器在 transform 祖先下对 fixed 背景的处理可能与普通视口背景不同，弹出/缩放期间的对齐需要原生视觉验收。
- 玻璃现在只显示壁纸，不模糊前景文字/其他组件，也不跟随视频后续帧。无壁纸、解码/CORS/worker 失败时用不透明明暗主题底色，绝不退回实时滤镜。失败记录警告，root 的 data-glass-cache 可检查 loading/ready/error/none。
- Windows/macOS/Linux 使用同一缓存算法，不按平台隐藏入口；CSP 已允许 self worker 和 blob 图片，不拓宽本地文件读取范围或远程权限。原生 asset 协议的 CORS/Canvas 可读性尚须实机验收。
- 静态纹理仍可能因位置/尺寸/文字/阴影/转场而被浏览器重绘/合成；视频在玻璃区域外依然消耗解码与合成资源。不能把本次修改称作已实现“仅切壁纸时整个容器重绘”。


## 验证结果

- `pnpm exec tsc --noEmit`：通过（包含新增测试）。
- 主题、弹出菜单、模型子菜单、底栏、时间线背景回归：9 个测试文件、51 项测试全部通过。
- 新增资源测试覆盖视频不播放且只冻结一帧、取消解码、Canvas CORS 读取失败、解码超时、Worker 像素传输/完成/失败/取消清理。测试使用 DOM/Worker/Canvas mock，不代表原生媒体和实际 Worker 集成验收。
- `pnpm exec vite build`：通过；仍有大于 500 kB 的 chunk 提示。
- `git diff --check`：无空白错误；保留此前 ConversationFooter 主文字色未提交改动。
- 未执行原生 WebView 视觉、asset 协议 CORS、CSP 运行时或性能录制验收；不宣称零重绘或已测得 GPU 降幅。尤其需要检查滚动和 transformed 祖先下 fixed 背景的对齐。
- 当前改动未提交、未推送。
