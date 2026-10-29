import ActivityKit
import Foundation

/// Live Activity data. Apple limits static + dynamic data to 4 KB, so only the visible page is sent
/// and titles are shortened; the full list always lives in the app.
struct TodayActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var items: [CardItem]
        var pendingCount: Int
        var doneCount: Int
        var page: Int
        var pageCount: Int
        var style: CardStyle
    }
    var startedDay: String
}

struct CardItem: Codable, Hashable, Identifiable {
    var id: String
    var title: String
    var done: Bool
    var pinned: Bool
}

/// Appearance values the card needs; independent of the app's accent color (same rule as the web app).
struct CardStyle: Codable, Hashable {
    var cardColor: String
    var transparency: Double
    var textMode: String
    var material: String
    var rows: Int

    init(_ settings: AppSettings) {
        cardColor = settings.cardColor
        transparency = settings.cardTransparency
        textMode = settings.cardText
        material = settings.cardMaterial
        rows = settings.rows
    }
}

enum CardContent {
    static let titleLimit = 40

    /// Builds one page of the card. `page` is clamped, so stale pages after deletions are safe.
    static func state(for doc: TodoDocument, page requested: Int? = nil) -> TodayActivityAttributes.ContentState {
        let rows = doc.settings.rows
        let ordered = TodoLogic.cardOrder(doc.tasks)
        let pageCount = max(1, Int((Double(ordered.count) / Double(rows)).rounded(.up)))
        let page = min(max(requested ?? doc.activityPage, 0), pageCount - 1)
        let items = ordered.dropFirst(page * rows).prefix(rows).map {
            CardItem(id: $0.id, title: String($0.title.prefix(titleLimit)), done: $0.done, pinned: $0.pinned)
        }
        return .init(items: Array(items), pendingCount: TodoLogic.pending(doc.tasks).count,
                     doneCount: doc.tasks.filter(\.done).count, page: page, pageCount: pageCount,
                     style: CardStyle(doc.settings))
    }
}

/// Starting, refreshing and ending the Live Activity. Only effective from the app process
/// (the app itself, or a LiveActivityIntent, which the system runs in the app's process).
enum LiveActivityController {
    /// Activities run for at most 8 hours; the system then keeps them on the Lock Screen for up to 4 more.
    static let activeWindow: TimeInterval = 8 * 3600

    static var isAvailable: Bool { ActivityAuthorizationInfo().areActivitiesEnabled }
    static var isRunning: Bool { !Activity<TodayActivityAttributes>.activities.isEmpty }

    static func start(_ doc: TodoDocument) async throws {
        await end()
        let content = ActivityContent(state: CardContent.state(for: doc), staleDate: Date().addingTimeInterval(activeWindow))
        _ = try Activity.request(attributes: TodayActivityAttributes(startedDay: doc.day), content: content, pushType: nil)
    }

    static func update(_ doc: TodoDocument) async {
        let state = CardContent.state(for: doc)
        for activity in Activity<TodayActivityAttributes>.activities {
            // Keep the original stale date; ActivityKit ends the activity after 8 hours regardless.
            await activity.update(ActivityContent(state: state, staleDate: activity.content.staleDate))
        }
    }

    static func end() async {
        for activity in Activity<TodayActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
}
