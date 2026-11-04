import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

@main
struct SuiSuiWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodayLockWidget()
        TodayHomeWidget()
        TodayLiveActivity()
    }
}

// MARK: - Timeline

struct TodayEntry: TimelineEntry {
    let date: Date
    let doc: TodoDocument
}

struct TodayProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry { TodayEntry(date: Date(), doc: TodoDocument()) }

    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        completion(TodayEntry(date: Date(), doc: context.isPreview ? TodoDocument() : TodoRepository.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let now = Date()
        let doc = TodoRepository.read()
        // Show the new day's list right after midnight (daily items reset, yesterday's finished items leave).
        let midnight = DayKey.nextMidnight(after: now)
        var tomorrow = doc
        TodoLogic.rollover(&tomorrow, now: midnight.addingTimeInterval(1))
        completion(Timeline(entries: [TodayEntry(date: now, doc: doc), TodayEntry(date: midnight, doc: tomorrow)], policy: .after(midnight.addingTimeInterval(60))))
    }
}

// MARK: - Lock Screen widget (always on the Lock Screen, no 8-hour limit)

struct TodayLockWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SuiSuiLock", provider: TodayProvider()) { entry in
            LockWidgetView(entry: entry)
        }
        .configurationDisplayName("今日待办")
        .description("锁屏上看到下一件事，点圆圈直接完成。")
        .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline])
    }
}

struct LockWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TodayEntry

    private var open: [TodoItem] { TodoLogic.pending(entry.doc.tasks) }
    private var doneCount: Int { entry.doc.tasks.filter(\.done).count }
    private var en: Bool { entry.doc.settings.english }

    var body: some View {
        switch family {
        case .accessoryCircular:
            Gauge(value: Double(doneCount), in: 0...Double(max(1, entry.doc.tasks.count))) {
                Image(systemName: "checklist")
            } currentValueLabel: {
                if open.isEmpty { Image(systemName: "checkmark") } else { Text("\(open.count)") }
            }
            .gaugeStyle(.accessoryCircularCapacity)
            .widgetURL(URL(string: "suisui://tasks"))
            .containerBackground(for: .widget) { AccessoryWidgetBackground() }
            .accessibilityLabel(TodoLogic.summary(entry.doc.tasks, english: en))
        case .accessoryInline:
            Text(entry.doc.settings.lockPrivacy ? (open.isEmpty ? L.t(en, "今天的事都完成了", "All done for today") : L.t(en, "还有 \(open.count) 件待办", "\(open.count) left")) : TodoLogic.summary(entry.doc.tasks, english: en))
                .widgetURL(URL(string: "suisui://tasks"))
                .containerBackground(for: .widget) { Color.clear }
        default:
            rectangular
                .widgetURL(URL(string: "suisui://tasks"))
                .containerBackground(for: .widget) { Color.clear }
        }
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 4) {
                Image(systemName: "checklist")
                Text(open.isEmpty ? L.t(en, "今天的事都完成了", "All done for today") : L.t(en, "还有 \(open.count) 件", "\(open.count) left"))
            }
            .font(.system(size: 12, weight: .semibold))
            .widgetAccentable()
            ForEach(entry.doc.settings.lockPrivacy ? [] : Array(open.prefix(2))) { task in
                Button(intent: ToggleTaskIntent(taskID: task.id)) {
                    HStack(spacing: 5) {
                        Image(systemName: "circle").font(.system(size: 12))
                        Text(task.title).font(.system(size: 13)).lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(L.t(en, "完成：", "Finish: ") + task.title)
            }
            if entry.doc.settings.lockPrivacy && !open.isEmpty {
                Text(L.t(en, "解锁后打开碎碎清单查看", "Unlock to see in SuiSui")).font(.system(size: 12)).foregroundStyle(.secondary)
            }
            if open.isEmpty {
                Text(doneCount > 0 ? L.t(en, "完成了 \(doneCount) 件，休息一下", "\(doneCount) done — take a break") : L.t(en, "打开碎碎清单添加一件", "Open SuiSui to add one"))
                    .font(.system(size: 12)).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Home Screen widget (same card as the lock-screen preview)

struct TodayHomeWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SuiSuiHome", provider: TodayProvider()) { entry in
            HomeWidgetView(entry: entry)
        }
        .configurationDisplayName("碎碎清单")
        .description("今天的待办，直接勾选；完成的划线排到最后。")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct HomeWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TodayEntry

    var body: some View {
        let state = cardState()
        TodayCardView(state: state, showsPaging: false)
            .widgetURL(URL(string: "suisui://tasks"))
            .containerBackground(for: .widget) { CardPalette(state.style).background }
    }

    private func cardState() -> TodayActivityAttributes.ContentState {
        var doc = entry.doc
        if family == .systemLarge { doc.settings.density = "compact" }
        var state = CardContent.state(for: doc, page: 0)
        switch family {
        case .systemLarge where !doc.settings.lockPrivacy:
            // Large widgets have room for more rows than the 160 pt Live Activity.
            state.items = TodoLogic.cardOrder(doc.tasks).prefix(9).map {
                CardItem(id: $0.id, title: String($0.title.prefix(CardContent.titleLimit)), done: $0.done, pinned: $0.pinned)
            }
            state.style.rows = 9
            state.pageCount = 1
        case .systemSmall:
            state.items = Array(state.items.prefix(3))
            state.style.rows = 3
        default:
            break
        }
        return state
    }
}

// MARK: - Live Activity (Lock Screen card + Dynamic Island)

struct TodayLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TodayActivityAttributes.self) { context in
            TodayCardView(state: context.state)
                .padding(.bottom, 2)
                .activityBackgroundTint(CardPalette(context.state.style).background)
                .activitySystemActionForegroundColor(CardPalette(context.state.style).ink)
                .widgetURL(URL(string: "suisui://tasks"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(L.t(context.state.style.english, "今天的待办", "Today"), systemImage: "checklist").font(.system(size: 13, weight: .semibold))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.doneCount)/\(context.state.pendingCount + context.state.doneCount)")
                        .font(.system(size: 13)).monospacedDigit()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(context.state.items.filter { !$0.done }.prefix(2)) { item in
                            Button(intent: ToggleTaskIntent(taskID: item.id)) {
                                HStack(spacing: 8) {
                                    Image(systemName: "circle")
                                    Text(item.title).lineLimit(1)
                                    Spacer(minLength: 0)
                                }
                                .font(.system(size: 14))
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                        if context.state.pendingCount == 0 {
                            Text(L.t(context.state.style.english, "今天的事，圆满完成。", "Today's done. Well done.")).font(.system(size: 14)).foregroundStyle(.secondary)
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: "checklist").foregroundStyle(Color(hex: "#e5e5ea"))
            } compactTrailing: {
                Text(context.state.pendingCount > 0 ? "\(context.state.pendingCount)" : "✓").monospacedDigit()
            } minimal: {
                Text(context.state.pendingCount > 0 ? "\(context.state.pendingCount)" : "✓").monospacedDigit()
            }
            .widgetURL(URL(string: "suisui://tasks"))
        }
    }
}
