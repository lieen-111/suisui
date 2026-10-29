# 打包验证

## 第二轮（2026-10-29，Linux 云端环境）

- 使用预装 Playwright Chromium（非 Edge），`verify.cjs`、`verify-completion.cjs`、`verify-beta.cjs`、`verify-pwa.cjs` 全部通过。`verify-pwa.cjs` 已改为非 Windows 不强制 Edge，并按正则替换 Service Worker 版本号。
- WebKit 无法下载（网络白名单），Safari 未测；实体 iPhone 未测。
- `ios/` 13 个 Swift 文件通过 tree-sitter 语法解析；未编译（无 Mac、未连接 GitHub）。plist、entitlements、隐私清单、XcodeGen YAML、两条工作流 YAML 均通过解析。
- 网页图标保持与第一轮字节一致；新增 `ios/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png`（同一 Lucide 图形，无透明通道）。

以下为第一轮记录。


日期：2026-10-29。

PWA 增量验证：

- 原有两套行为与完成排序测试在本机重新运行，通过。
- `scripts/verify-pwa.cjs` 已从新的 PWA 交接目录使用随包 Node / Playwright 运行，通过离线重载、离线完成、待办及外观持久化、更新保留数据、旧缓存清理、图标尺寸和多宽度溢出检查。
- PWA 结果见 `pwa-test-results/verification.json`；截图见同目录。使用 Chromium / Edge，WebKit 浏览器未安装，Safari 与实体 iPhone 未验证。
- 下列两份原有随包脚本的 8794 测试记录来自前一轮完整开发包，PWA 增量的原有行为回归使用当前工作区脚本与 8793 服务。

- 在交接包内使用 `runtime/windows-x64/node.exe` 启动 `scripts/server.cjs`。
- 验证 8793 已被原预览占用时，交接包自动启动在 8794，没有关闭原服务。
- 从交接包本地 `node_modules` 加载 Playwright，未使用原电脑的绝对依赖路径。
- 使用 `LOCKTODO_URL=http://localhost:8794` 运行两份随包测试，均通过。
- `scripts/verify.cjs`：增删改、分组、完成、恢复、撤销、本地持久化、外观设置、上传、导出、减少动态效果、手机布局。
- `scripts/verify-completion.cjs`：完成后置底、置顶任务完成、完成顺序保存、恢复/重新完成、触摸/滚轮/键盘滚动、固定框头框尾、滚动位置、划线及半透明。
- 未进行真实 iPhone、Safari 或原生 iOS 测试。

这些记录证明当前包在本机可独立运行，不保证未知电脑的系统架构、浏览器安装、权限或防火墙配置相同。

`MANIFEST.sha256.json` 记录打包文件的相对路径、长度和 SHA-256，用于完整性检查。
