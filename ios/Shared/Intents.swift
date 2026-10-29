import AppIntents
import Foundation

// These intents are compiled into both the app and the widget extension (Apple requires the type to be
// visible to the widget that uses it). As LiveActivityIntents they run in the app's process, which is
// what allows a Lock Screen tap to also refresh the Live Activity.

/// Completes or restores one task from the Lock Screen, a widget or the Live Activity.
struct ToggleTaskIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "勾选待办"
    static var description = IntentDescription("在锁屏或小组件上完成、恢复一件待办。")
    static var isDiscoverable: Bool = false

    @Parameter(title: "待办 ID")
    var taskID: String

    init() {}
    init(taskID: String) { self.taskID = taskID }

    func perform() async throws -> some IntentResult {
        let doc = TodoRepository.mutate { TodoLogic.toggle(taskID, in: &$0) }
        await LiveActivityController.update(doc)
        TodoRepository.reloadWidgets()
        return .result()
    }
}

/// The Live Activity cannot scroll, so it pages through the list instead.
struct PageCardIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "翻页"
    static var isDiscoverable: Bool = false

    @Parameter(title: "向后")
    var forward: Bool

    init() {}
    init(forward: Bool) { self.forward = forward }

    func perform() async throws -> some IntentResult {
        let doc = TodoRepository.mutate { doc in
            let pages = CardContent.state(for: doc).pageCount
            doc.activityPage = min(max(doc.activityPage + (forward ? 1 : -1), 0), pages - 1)
        }
        await LiveActivityController.update(doc)
        TodoRepository.reloadWidgets()
        return .result()
    }
}

/// "在锁屏显示今日待办" — usable from Shortcuts. A daily personal automation (e.g. every morning at 7)
/// restarts the Live Activity without a server, working around its 8-hour limit.
struct StartTodayActivityIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "在锁屏显示今日待办"
    static var description = IntentDescription("在锁屏和灵动岛显示今天的待办，可直接勾选。实时活动最长持续 8 小时。")

    init() {}

    func perform() async throws -> some IntentResult {
        let doc = TodoRepository.load()
        try await LiveActivityController.start(doc)
        TodoRepository.reloadWidgets()
        return .result()
    }
}

struct EndTodayActivityIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "从锁屏移除今日待办"

    init() {}

    func perform() async throws -> some IntentResult {
        await LiveActivityController.end()
        return .result()
    }
}
