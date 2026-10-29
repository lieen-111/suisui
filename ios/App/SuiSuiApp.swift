import AppIntents
import SwiftUI

@main
struct SuiSuiApp: App {
    @StateObject private var model = TodoModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .onOpenURL { model.handle($0) }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { model.becameActive() }
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var model: TodoModel

    var body: some View {
        TabView(selection: $model.tab) {
            TasksView()
                .tabItem { Label("清单", systemImage: "checklist") }
                .tag(TodoModel.Tab.tasks)
            LockScreenView()
                .tabItem { Label("锁屏", systemImage: "iphone") }
                .tag(TodoModel.Tab.lock)
            SettingsView()
                .tabItem { Label("设置", systemImage: "slider.horizontal.3") }
                .tag(TodoModel.Tab.settings)
        }
        .tint(model.doc.settings.accentColor)
        .overlay(alignment: .bottom) {
            if let toast = model.toast {
                ToastView(toast: toast)
                    .padding(.bottom, 64)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.snappy, value: model.toast)
    }
}

struct ToastView: View {
    @EnvironmentObject private var model: TodoModel
    let toast: TodoModel.Toast

    var body: some View {
        HStack(spacing: 16) {
            Text(toast.message).font(.subheadline).lineLimit(2)
            if toast.canUndo {
                Button("撤销") { model.undo() }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color(hex: "#b9f3cd"))
            }
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 18)
        .padding(.vertical, 11)
        .background(Color(hex: "#233b30"), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .shadow(color: Color(hex: "#152e27", opacity: 0.25), radius: 14, y: 6)
        .padding(.horizontal, 16)
        .accessibilityElement(children: .combine)
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
            TodoLogic.add(title: text, group: .work, repeatRule: daily ? .daily : .none, in: &$0)
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
