import AppIntents
import SwiftUI
import UserNotifications

@main
struct SuiSuiApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @StateObject private var shell = WebShell()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            // The same interface as the Android app and the web version (app/), full screen.
            WebShellView()
                .environmentObject(shell)
                .ignoresSafeArea()
                .background(Color(uiColor: .systemBackground))
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { shell.becameActive() }
        }
    }
}

/// Notification actions: "完成" on a reminder or a finished timer ticks the task without opening the app.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Reminders.registerCategories()
        return true
    }

    /// While the app is open the page shows its own reminder bar, so only a quiet list entry is added.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.list]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard response.actionIdentifier == Reminders.completeAction,
              let id = response.notification.request.content.userInfo["id"] as? String, !id.isEmpty else { return }
        let doc = TodoRepository.mutate { TodoLogic.complete(id, in: &$0) }
        TodoRepository.reloadWidgets()
        Reminders.schedule()
        await LiveActivityController.update(doc)
    }
}

// MARK: - Siri & Shortcuts

/// Adds a task without opening the app, e.g. "嘿 Siri，用碎碎清单添加待办".
struct AddTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "添加碎碎待办"
    static var description = IntentDescription("添加一件待办，锁屏和小组件会立即更新。")

    @Parameter(title: "内容")
    var text: String

    @Parameter(title: "每天重复", default: false)
    var daily: Bool

    init() {}

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let doc = TodoRepository.mutate {
            TodoLogic.add(title: text, group: $0.groups.first?.id ?? "work", repeatRule: daily ? .daily : .none, in: &$0)
        }
        await LiveActivityController.update(doc)
        TodoRepository.reloadWidgets()
        return .result(dialog: "已添加：\(text)")
    }
}

struct SuiSuiShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: StartTodayActivityIntent(),
                    phrases: ["用\(.applicationName)在锁屏显示待办", "打开\(.applicationName)锁屏待办"],
                    shortTitle: "锁屏显示待办",
                    systemImageName: "lock.rectangle.on.rectangle")
        AppShortcut(intent: AddTaskIntent(),
                    phrases: ["用\(.applicationName)添加待办"],
                    shortTitle: "添加待办",
                    systemImageName: "plus.circle")
    }
}
