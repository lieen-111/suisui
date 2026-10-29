# 碎碎清单 · 原生 iOS 版

这是真正能上 iPhone 锁屏的版本：锁屏小组件、实时活动（锁屏大卡片 + 灵动岛）上直接勾选待办。
代码已写完，**还没有在 Mac 或真机上编译运行过**——第一次云端编译可能需要修几处小问题，见文末“当前状态”。

## 它能做到什么（按苹果 2026 年官方文档核对）

| 位置 | 能看到 | 能直接勾选 | 限制 |
|---|---|---|---|
| 锁屏小组件（长条） | 剩余数量 + 最前面 2 件 | 能，点圆圈 | 系统规定的小尺寸，单色显示；不能滚动 |
| 锁屏小组件（圆形 / 文字行） | 剩余数量 / 下一件 | 不能（点按打开 App） | — |
| 实时活动（锁屏大卡片） | 标题、3 或 4 条、剩余数量；完成的划线半透明排在最后 | 能，点圆圈；箭头翻页 | 高度不超过 160pt，**不能滚动，所以改成翻页**；每次最长 8 小时，之后最多再在锁屏停留 4 小时 |
| 灵动岛 | 剩余数量；长按展开看 2 件 | 展开后能 | — |
| 主屏幕小组件 | 小 / 中 / 大三种尺寸，与锁屏卡片同样式 | 能 | — |
| App 内 | 全部清单、碎裂动画、历史、外观、备份 | 能 | — |

**关于“直接勾选”：** 苹果规定锁定状态下按钮不生效，系统会先确认是机主。带面容 ID 的 iPhone 亮屏看一眼就解锁（锁头变成打开状态），这时停在锁屏即可勾选，不用进入 App；触控 ID 机型需要按一下指纹。

**碎裂动画只在 App 内。** 锁屏和小组件由系统绘制，只允许系统自带的过渡动画，所以那里是“划线 + 半透明 + 排到最后”。

**每天自动出现：** 实时活动有 8 小时上限。不搭服务器的做法是：
1. 设置里默认开启“打开 App 时自动在锁屏显示”；
2. 用户在“快捷指令 > 自动化”里设一个每天 7:00 运行“在锁屏显示今日待办”（App 已提供这个操作）。
锁屏小组件没有时间限制，一直都在。

## 文件结构

```text
ios/
  project.yml            XcodeGen 工程描述（不用手写 .xcodeproj）
  App/                   主 App：清单、锁屏页、设置、碎裂动画、Siri/快捷指令
  Widgets/               小组件扩展：锁屏小组件、主屏小组件、实时活动
  Shared/                两边共用：数据模型、规则、存储、卡片视图、App Intents
  Tests/                 规则单元测试（在云端模拟器上运行）
../.github/workflows/
  ios-build.yml          每次推送自动编译 + 测试（不需要苹果账号）
  ios-testflight.yml     手动触发：签名并上传 TestFlight
```

数据保存在 App Group 共享文件 `suisui-data.json`，App、小组件和锁屏点按都读写同一份。格式与网页版备份相同，**网页版导出的 JSON 可以直接导入**，反之亦然。

## 没有 Mac，怎么做出来、发给别人

苹果的规则：不上架 App Store，让陌生人装上原生 App，现实可行的只有 **TestFlight**（最多 10,000 名外部测试员，可用公开链接邀请，每个构建 90 天有效）。它需要 Apple 开发者会员。

### 费用

- Apple Developer Program：中国大陆 **¥688/年**（个人身份即可，用 iPhone 上的 Apple Developer App 实名注册，需要身份证和自拍）。
- GitHub：免费账号可用。私有仓库的 macOS 云端分钟数按 10 倍计算，免费额度有限；仓库设为公开则 macOS 运行免费。
- 不需要服务器，不需要 Mac。

### 一次性准备（都在浏览器 / iPhone 上完成）

1. **注册开发者**：iPhone 安装 Apple Developer App → 账户 → 立即注册，选“个人”。审核通过后付费。
2. **定一个 Bundle ID**，例如 `com.你的拼音.suisui`，以后不能改。
3. **在 developer.apple.com > Certificates, Identifiers & Profiles** 里：
   - Identifiers → App Groups → 新建 `group.com.你的拼音.suisui`；
   - Identifiers → App IDs → 新建 `com.你的拼音.suisui`，勾选 App Groups，并关联上面的组；
   - 再新建 `com.你的拼音.suisui.widgets`，同样勾选并关联 App Groups。
4. **App Store Connect > 我的 App > 新建 App**：平台 iOS，名称“碎碎清单”（若被占用需换名），Bundle ID 选第 3 步的主 ID，SKU 随意。
5. **App Store Connect > 用户和访问 > 集成 > App Store Connect API**：生成密钥，**权限选“管理”(Admin)**（云端自动签名需要），下载 `.p8` 文件（只能下载一次），记下 Key ID 和 Issuer ID。
6. **GitHub**：新建仓库，上传整个项目文件夹（不要上传 `.p8`）。在仓库 Settings → Secrets and variables → Actions：
   - Secrets：`APPLE_TEAM_ID`（developer.apple.com > 会员资格 里的团队 ID）、`ASC_KEY_ID`、`ASC_ISSUER_ID`、`ASC_KEY_P8`（用记事本打开 .p8，整段粘贴）；
   - Variables：`BUNDLE_ID` = `com.你的拼音.suisui`。

### 每次发版

1. 推送代码后，`iOS build check` 会自动在云端 Mac 上编译并跑测试，绿色即通过。
2. 打开 Actions → `iOS TestFlight` → Run workflow。约 10–20 分钟后，构建会出现在 App Store Connect 的 TestFlight 页面（苹果处理还需几分钟到半小时）。
3. 首次：在 TestFlight 里填写测试信息，新建“外部测试”群组，加入构建，提交 Beta 审核（每个新版本号的第一个构建都要审，通常 1 天内）。
4. 审核通过后打开“公开链接”，把链接或二维码发给别人。对方安装苹果官方的 TestFlight App，点链接即可安装碎碎清单。
5. 构建 90 天后过期；工作流每月 1 日自动上传新构建。改版本号（`project.yml` 里的 `MARKETING_VERSION`）会触发新一轮 Beta 审核。

**正式上架**中国区 App Store 还需要 ICP 备案等手续，与 TestFlight 是两回事，见根目录《落地路线.md》。

## 本地有 Mac 时

```bash
brew install xcodegen
cd ios && xcodegen generate && open SuiSui.xcodeproj
```
在 Signing & Capabilities 里选自己的团队，真机运行。免费 Apple ID 也能装到自己手机上调试（7 天有效），但不能分发给别人。

## 真机验收清单（第一次装上后逐条确认）

- [ ] 添加、编辑、删除、置顶、每天重复；完成时碎裂，排到最后；撤销。
- [ ] 锁屏长按 → 自定 → 添加“碎碎清单”长条小组件；面容 ID 解锁状态下点圆圈完成，App 里同步变化。
- [ ] “锁屏”页点“在锁屏显示”，锁屏出现大卡片；点圆圈完成，翻页按钮可用；灵动岛显示剩余数。
- [ ] 改底色、透明度、文字颜色、每页条数，锁屏卡片和小组件随之变化。
- [ ] 快捷指令自动化“在锁屏显示今日待办”按时出现。
- [ ] 过零点后：每天重复的事项回到待完成，前一天完成的移入历史。
- [ ] 从网页版导出备份，在 App 里导入（合并 / 替换），再从 App 导出、在网页版导入。
- [ ] 打开“减弱动态效果”后不再碎裂，完成状态正常。
- [ ] 小屏机型（SE / mini）和大屏机型（Pro Max）各看一次布局。

## 当前状态（2026-10-29）

- 已完成：全部 Swift 源码、工程描述、隐私清单、图标、单元测试、两条云端流水线。
- 已验证：所有 Swift 文件通过语法解析（`python scripts/check-swift-syntax.py`）；数据规则与网页版逐条对照编写。
- **未验证**：类型检查与编译（需要 Xcode）、真机、锁屏实际显示效果。开发环境没有 Mac，也没有连接 GitHub。第一次运行 `iOS build check` 若报错，把日志交给 Claude 修即可。
