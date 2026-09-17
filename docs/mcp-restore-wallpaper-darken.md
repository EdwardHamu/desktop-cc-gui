# 恢复壁纸变暗配置

## PLAN

恢复先前被设为透明的 .workspace-wallpaper-scrim 黑色背景。WorkspaceWallpaperHost.tsx 中 darken > 0 条件及 opacity: darken / 100 已保留，无需更改设置存储或用户数值。

## 行为

仅恢复 src/styles/globals.css 的壁纸暗化层：值为 0 时不挂载遮罩，大于 0 时按百分比设置黑色遮罩不透明度。图片和视频共用该层。其他透明背景、终端透明、小屏侧栏遮罩、毛玻璃与白色 14% 边框均不改。
