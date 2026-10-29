# 碎碎清单：完整开发交接包

最新状态请先看 `先读我-最新交接.md`；商业与落地取舍看 `落地路线.md`；原生 iOS 版看 `ios/README.md`。

- 网页版（`app/`）：可用测试版，固定 Netlify 地址。新增导入备份、每日整理、每天重复、历史、锁屏提醒通知、添加到主屏幕引导。
- 原生版（`ios/`）：锁屏小组件 + 实时活动，可在锁屏直接勾选。代码已写完，**尚未编译和真机验证**。

打包日期：2026 年 10 月 29 日。当前交付是可运行的网页原型，目标产品是 iPhone 锁屏待办。名称暂定。

PWA 更新：已补齐主屏幕图标、应用信息、离线缓存和保留本地数据的更新流程。手机安装方式和临时链接限制见 `PWA-iPhone-使用说明.md`。仍未完成原生锁屏接入和 iPhone 实机验证。

## 回家如何打开

### Windows

双击根目录 `START-WINDOWS.cmd`。已附 Windows x64 Node.js，无需先安装 Node 或下载网页依赖。启动后会打开浏览器，并在终端显示访问地址。保持该窗口运行，按 Ctrl+C 停止。

如果端口已经被其他程序占用，启动器会自动换一个端口。不同端口的浏览器本地数据彼此独立。

### Mac / Linux

安装 Node.js 20 或以上，在这个文件夹内运行 `npm start`，打开终端显示的地址。网页依赖已经在 `app/vendor`，运行预览不需要 `npm install`。

### 不启动服务

可以直接双击 `app/index.html` 看界面。日常开发建议使用启动脚本，浏览器本地保存和后续测试会更稳定。

## 在 Claude 里接着做

使用能读写本地文件的 Claude Code 或相应本地工作区，把**整个文件夹**作为项目打开。根目录 `CLAUDE.md` 已包含产品需求、当前实现、关键文件和测试方式。

可直接对 Claude 说：

> 先阅读 CLAUDE.md、PRODUCT.md、DESIGN.md 和 HANDOFF.md，运行这个项目。保留现有功能，在这份代码上继续优化。当前是网页原型，不要把它当作已完成的原生 iOS App。

如果使用只支持聊天和上传附件的 Claude，把同名 ZIP 上传；这种模式是否能直接运行和修改本地项目，取决于你使用的客户端功能。

## 文件结构

```text
app/                      完整网页代码、素材和浏览器依赖（上传到 Netlify 的就是这个文件夹）
ios/                      原生 iOS 工程源码（XcodeGen）、单元测试、使用说明
.github/workflows/        云端 Mac 编译与 TestFlight 上传
落地路线.md               三条路线对比、费用、推进顺序、商业判断
scripts/                  本地服务与可搬走的验证脚本
runtime/windows-x64/      Windows 启动运行环境及许可证
node_modules/             测试需要的 Playwright 包，未附浏览器安装包
reference/                用户提供的参考截图
screenshots/              已保存的界面和测试截图
.impeccable/design.json    设计系统侧车资料
CLAUDE.md                 给 Claude 的接续开发说明
HANDOFF.md                已完成、未完成、测试和已知限制
PRODUCT.md                确认过的产品要求
DESIGN.md                 当前设计系统
START-WINDOWS.cmd         Windows 双击启动
package.json              跨平台开发命令
```

## 当前行为

- 待办增删改、工作/生活分组、置顶。
- 完成时碎裂，显示划线和半透明状态，并移到清单末尾；未完成始终排在前面。
- 已完成事项按完成顺序排列，再点可恢复；支持撤销。
- 框内上下滚动全部事项，标题和底部固定，完成时保留滚动位置。
- 材质、底色、透明度、文字深浅、壁纸和动画幅度可调整。
- 浏览器本地保存，支持导出 / 导入备份（合并或替换），与原生版互通。
- 每天自动整理：前一天完成的移入历史，“每天”重复的事项回到待完成。
- 锁屏提醒：从主屏幕打开时可开启，离开应用后未完成事项出现在锁屏通知里（不能在通知里勾选）。

## 数据跟随说明

代码和资源已经完整打包。当前浏览器中输入的待办、壁纸及外观设置存在原电脑的 localStorage，**不会随代码文件夹自动迁移**。

如果需要带走真实待办，在原预览的清单页点击右上角下载按钮，把导出的 `suisui-tasks.json` 一并带走。现在可以在“设置 > 数据与备份”或清单页右上角导入。仍没有云同步。不要把示例数据误当成你保存的数据。

## 测试

先启动预览，再运行：

```text
npm test
npm run test:completion
npm run test:beta
npm run test:pwa        （自带临时服务器）
```

原生代码语法检查（不需要 Mac）：`pip install tree-sitter tree-sitter-language-pack` 后运行 `npm run check:swift`。编译与单元测试在 GitHub Actions 的云端 Mac 上运行。

测试包已经附带。Windows 默认尝试系统 Edge；其他系统默认使用 Playwright Chromium，首次测试可运行 `npx playwright install chromium` 安装浏览器。也可通过 `PLAYWRIGHT_CHANNEL` 选择已安装的浏览器。

Windows 如果没有把 Node/npm 安装到系统，Claude 也可直接运行：

```text
runtime\windows-x64\node.exe scripts\verify.cjs
runtime\windows-x64\node.exe scripts\verify-completion.cjs
```

如果启动服务用了其他端口，设置 `LOCKTODO_URL` 为终端显示的地址后再测试。

## 交付边界

原生 Swift 工程已写好，但还没有编译产物、iOS 安装包、苹果开发者签名或 TestFlight 构建。网页中框内滚动和碎裂效果不代表真实锁屏支持：原生锁屏卡片用翻页代替滚动，碎裂只在 App 内。
