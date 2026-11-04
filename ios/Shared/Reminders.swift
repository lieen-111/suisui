import Foundation
import UserNotifications

/// "到点提醒" and the end of a focus timer, as local notifications (same behaviour as the Android shell):
/// every task with a time (HH:MM) rings on the days it is due, planned for today and tomorrow from the stored
/// data, so it works with the app closed. Re-planned after every save, every Lock Screen tap and on launch.
enum Reminders {
    static let reminderCategory = "suisui.reminder"
    static let timerCategory = "suisui.timer"
    static let completeAction = "suisui.complete"
    private static let prefix = "remind-"
    private static let timerID = "timer"

    static func registerCategories() {
        let done = UNNotificationAction(identifier: completeAction, title: L.t(TodoRepository.read().settings.english, "完成", "Done"), options: [])
        UNUserNotificationCenter.current().setNotificationCategories([
            UNNotificationCategory(identifier: reminderCategory, actions: [done], intentIdentifiers: [], options: []),
            UNNotificationCategory(identifier: timerCategory, actions: [done], intentIdentifiers: [], options: [])
        ])
    }

    /// Asks once, the first time something needs a notification. Never from a widget or Lock Screen tap.
    static func requestIfNeeded() async {
        let center = UNUserNotificationCenter.current()
        guard await center.notificationSettings().authorizationStatus == .notDetermined else { return }
        _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
    }

    static func status() async -> String {
        switch await UNUserNotificationCenter.current().notificationSettings().authorizationStatus {
        case .authorized, .provisional, .ephemeral: return "granted"
        case .denied: return "denied"
        default: return "default"
        }
    }

    /// Plans reminders from the stored file. Returns whether any task has a reminder time.
    @discardableResult
    static func schedule(now: Date = Date(), calendar: Calendar = .current) -> Bool {
        guard let raw = RawJSON.object(try? Data(contentsOf: TodoRepository.fileURL)),
              let doc = try? TodoRepository.decode(RawJSON.data(raw) ?? Data()) else { return false }
        var times: [String: String] = [:]
        for item in raw["tasks"] as? [Any] ?? [] {
            if let t = item as? RawJSON.Object, let id = t["id"] as? String, let time = t["time"] as? String,
               time.range(of: #"^([01]\d|2[0-3]):[0-5]\d$"#, options: .regularExpression) != nil { times[id] = time }
        }
        var requests: [UNNotificationRequest] = []
        for offset in 0...1 {
            guard let day = calendar.date(byAdding: .day, value: offset, to: now) else { continue }
            for task in doc.tasks {
                guard let time = times[task.id] else { continue }
                if task.done && (offset == 0 || task.repeatRule == .none) { continue }
                guard TodoLogic.dueToday(task, on: day, calendar: calendar) else { continue }
                var parts = calendar.dateComponents([.year, .month, .day], from: day)
                parts.hour = Int(time.prefix(2)); parts.minute = Int(time.suffix(2)); parts.second = 0
                guard let at = calendar.date(from: parts), at > now else { continue }
                let content = UNMutableNotificationContent()
                content.title = "⏰ \(time) \(task.title)"
                content.body = L.t(doc.settings.english, "到点了。点“完成”直接勾掉。", "It's time. Tap “Done” to tick it off.")
                content.sound = .default
                content.categoryIdentifier = reminderCategory
                content.userInfo = ["id": task.id]
                requests.append(UNNotificationRequest(identifier: "\(prefix)\(task.id)@\(DayKey.today(day, calendar: calendar))",
                                                      content: content,
                                                      trigger: UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)))
            }
        }
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { pending in
            let stale = pending.map(\.identifier).filter { $0.hasPrefix(prefix) }
            center.removePendingNotificationRequests(withIdentifiers: stale)
            requests.prefix(60).forEach { center.add($0) }
        }
        return !times.isEmpty
    }

    /// The page's focus timer: `{"id","title","endsAt"}` while counting down, "" when stopped or paused.
    static func setTimer(json: String) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [timerID])
        guard let t = RawJSON.object(json.data(using: .utf8)), let endsAt = (t["endsAt"] as? NSNumber)?.doubleValue,
              endsAt > Date.nowMillis + 1000 else { return }
        let content = UNMutableNotificationContent()
        let english = TodoRepository.read().settings.english
        content.title = L.t(english, "时间到：", "Time's up: ") + ((t["title"] as? String) ?? L.t(english, "专注", "Focus"))
        content.body = L.t(english, "这一段专注结束了。做完了就点“完成”。", "This focus session is over. Tap “Done” if you finished.")
        content.sound = .default
        content.categoryIdentifier = timerCategory
        content.userInfo = ["id": (t["id"] as? String) ?? ""]
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: (endsAt - Date.nowMillis) / 1000, repeats: false)
        center.add(UNNotificationRequest(identifier: timerID, content: content, trigger: trigger))
    }
}
