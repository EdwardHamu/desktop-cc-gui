# 会话完成系统通知与提示音

## 行为与设置

- 设置 → 通用 → 会话完成提醒：新增系统通知、提示音两个独立开关，默认关闭，保存到既有 AppSettings。
- 用户选择每次完成都提醒，不以应用前后台、当前会话选中状态或窗口焦点作为条件。
- `sessionCompletionToast` / `sessionCompletionSound` 缺省为 false，兼容旧 settings.json；中英文文案齐全。
- 使用原生 `notify-rust` 发系统 toast；使用 `rodio` 在原生音频设备上合成约 320ms 双音提示，无音频下载、浏览器自动播放依赖或额外解码器。
- Toast 自身静音，由独立提示音开关控制声音，避免双响。通知正文不包含消息内容、文件路径或密钥。

## 接入与性能

- `src-tauri/src/lib.rs` 在唯一应用 engine EventSink 注册 observer，终端 sink 保持不变。
- `src-tauri/src/event_sink.rs` 在 live push 时调用 observer，广播给桌面/远程网页之前只处理一次，不依赖 React 挂载或历史加载。
- `src-tauri/src/completion_notifications.rs` 仅对 done/error 终态检查去重；普通 token、usage、工具事件不加锁或读设置。
- 最近 1024 个 runId 有界去重；同一 session 的新 run 可正常提醒。error 或显式 data.cancelled 事件不提醒，error 后的重复 done 不提醒。
- 沿用现有引擎 done 语义：部分手动停止也以普通 done 收尾，因此也视作本轮结束并提醒；没有声称所有取消路径都可区分。
- 设置 IO、系统通知和短音频设备初始化均在后台 blocking task 中运行，不阻塞引擎读取和 UI。声音与 toast 失败互不影响，错误写入 completion-notification 日志。
- Linux 音频需要 ALSA 开发库；现有 release workflow 已安装 libasound2-dev。Cargo.lock 已更新。

## 验证

- 设置交互与 IPC 回归：2 个测试文件、6 项测试通过。
- TypeScript 全量检查、Vite 生产构建、git diff --check 通过；构建保留已有大 chunk 提示。
- 新原生模块已通过独立 Windows Cargo 测试探针的真实依赖编译与 5 项测试：runId 去重、终态过滤、有界缓存、observer/flush 不重放、真实 AppSettings 类型默认与序列化。探针直接引用当前通知模块和 event_sink；从真实 settings 源码提取类型/默认值，仅替换 read_settings 磁盘 IO。不是全应用集成验收。
- 完整 `cargo check --lib` 仍被原有 vendored OpenSSL 构建环境阻塞：Perl 缺少 Locale/Maketext/Simple.pm；未擅自修改系统环境。
- 尚未执行已安装原生客户端 toast 展示/实际听音验收，也没有重启正在运行的客户端；需要重新编译启动原生应用，单独前端热更新不会启用 Rust 新逻辑。
- 系统通知权限、勿扰模式、静音或无可用音频设备可能抑制提醒；Windows 开发二进制未注册应用通知身份时使用 notify-rust 的开发 fallback，正式安装版使用应用 identifier。
- 本次改动未提交、未推送，未触发在线打包。
