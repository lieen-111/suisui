import SwiftUI

/// Preview of the Lock Screen card plus everything needed to put it on the real Lock Screen.
struct LockScreenView: View {
    @EnvironmentObject private var model: TodoModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    preview
                    liveActivityCard
                    guide
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
            .navigationTitle("锁屏")
            .background(Color(.systemGroupedBackground))
        }
    }

    private var preview: some View {
        let state = CardContent.state(for: model.doc)
        return VStack(spacing: 0) {
            TimelineView(.everyMinute) { context in
                VStack(spacing: 2) {
                    Text(context.date, format: .dateTime.month().day().weekday(.wide)).font(.system(size: 15, weight: .medium))
                    Text(context.date, format: .dateTime.hour(.twoDigits(amPM: .omitted)).minute(.twoDigits))
                        .font(.system(size: 72, weight: .semibold)).monospacedDigit()
                }
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.15), radius: 12)
            }
            .padding(.top, 28)
            Spacer(minLength: 24)
            TodayCardView(state: state, onToggle: { model.toggle($0) }, onPage: { model.pageCard(forward: $0) })
                .background(CardPalette(state.style).background, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                .padding(.horizontal, 14)
                .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity)
        // Background images don't affect layout, so a wide photo can't push the page sideways.
        .background {
            Image("Wallpaper").resizable().scaledToFill()
                .overlay(LinearGradient(colors: [Color(hex: "#102f2d", opacity: 0.72), Color(hex: "#102f2d", opacity: 0.1), Color(hex: "#102d29", opacity: 0.5)], startPoint: .top, endPoint: .bottom))
                .accessibilityHidden(true)
        }
        .frame(height: 470)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .accessibilityElement(children: .contain)
        .padding(.top, 4)
    }

    private var liveActivityCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("实时活动（锁屏大卡片）", systemImage: "lock.rectangle.on.rectangle").font(.headline)
            Text(statusCopy).font(.subheadline).foregroundStyle(.secondary)
            HStack {
                if model.liveActivityRunning {
                    Button { Task { await model.startLiveActivity() } } label: { Label("刷新", systemImage: "arrow.clockwise") }
                        .buttonStyle(.bordered)
                    Button(role: .destructive) { Task { await model.endLiveActivity() } } label: { Text("从锁屏移除") }
                        .buttonStyle(.bordered)
                } else {
                    Button { Task { await model.startLiveActivity() } } label: { Label("在锁屏显示", systemImage: "lock.fill") }
                        .buttonStyle(.borderedProminent)
                        .disabled(!model.liveActivitiesAllowed)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var statusCopy: String {
        if !model.liveActivitiesAllowed { return "实时活动在系统设置里被关闭了。请到 设置 > 碎碎清单 > 实时活动 打开。" }
        if model.liveActivityRunning { return "正在锁屏显示。点圆圈完成，点箭头翻页。苹果限制每次最长 8 小时，打开碎碎清单或运行快捷指令会重新开始。" }
        return "亮屏就能看到、点圆圈直接完成。每次最长 8 小时；可在设置里选择打开 App 时自动显示。"
    }

    private var guide: some View {
        VStack(alignment: .leading, spacing: 18) {
            GuideBlock(title: "一直显示：添加锁屏小组件", icon: "rectangle.on.rectangle", steps: [
                "锁屏状态下长按屏幕，点“自定”，选择“锁定屏幕”。",
                "点时间下方的小组件区域，在列表里找到“碎碎清单”。",
                "选择长条（显示两件待办，可直接勾选）或圆形（剩余数量）。"
            ])
            GuideBlock(title: "每天早上自动出现", icon: "clock.arrow.circlepath", steps: [
                "打开“快捷指令”App，选择“自动化”，新建“特定时间”，例如每天 7:00，选择“立即运行”。",
                "添加操作“在锁屏显示今日待办”（碎碎清单提供），完成。",
                "以后每天这个时间，今日待办会出现在锁屏上，不需要服务器。"
            ])
            GuideBlock(title: "关于直接勾选", icon: "faceid", steps: [
                "苹果规定：锁定状态下点按钮，系统会先确认是你本人。",
                "带面容 ID 的 iPhone 亮屏看一眼就会解锁（锁头打开），停留在锁屏即可直接勾选，不用进入 App。",
                "触控 ID 机型需要按一下指纹；也可以从小组件进入 App 完成。"
            ])
        }
    }
}

struct GuideBlock: View {
    let title: String
    let icon: String
    let steps: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(title, systemImage: icon).font(.headline)
            ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("\(index + 1)").font(.caption.weight(.semibold)).foregroundStyle(.tint)
                        .frame(width: 20, height: 20).background(Circle().fill(Color.accentColor.opacity(0.12)))
                    Text(step).font(.subheadline).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
