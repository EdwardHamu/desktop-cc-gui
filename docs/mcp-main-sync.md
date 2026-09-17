# 当前分支覆盖 main

- 用户要求中英文 README 使用指定外链预览图，并以当前 sync1 内容完整替换 main。
- 一并提交此前已验证的消息区/Composer 居中改动（14 项测试、TypeScript、diff 检查通过）。
- 覆盖前 main/origin/main 为 `8ca84fa1712477b531b7e71a4e3d90c145ad13bd`。
- 先创建备份分支，再用绑定旧远程 SHA 的 force-with-lease 更新 origin/main；不修改 upstream。
- 预览图使用用户指定的外部 URL，可用性依赖该图床。
