import SwiftUI
import UIKit

/// App-side state. Every change goes through TodoRepository so widgets, the Live Activity and
/// Lock Screen taps (which write the same file) stay consistent.
@MainActor
final class TodoModel: ObservableObject {
    enum Tab: Hashable { case tasks, lock, settings }

    struct Toast: Identifiable, Equatable {
        let id = UUID()
        let message: String
        let canUndo: Bool
    }

    @Published private(set) var doc: TodoDocument
    @Published var toast: Toast?
    @Published var tab: Tab = .tasks
    @Published private(set) var liveActivityRunning = false
    @Published private(set) var liveActivitiesAllowed = true

    private var undoSnapshot: TodoDocument?
    private var toastTask: Task<Void, Never>?

    init() {
        doc = TodoRepository.load()
        refreshActivityStatus()
    }

    // MARK: Derived lists

    var pending: [TodoItem] { TodoLogic.pending(doc.tasks) }
    var done: [TodoItem] { TodoLogic.done(doc.tasks) }
    var archive: [TodoItem] { doc.archive.sorted { ($0.archivedAt ?? 0) > ($1.archivedAt ?? 0) } }

    // MARK: Changes

    func change(_ message: String? = nil, undoable: Bool = false, animated: Bool = true, _ body: (inout TodoDocument) -> Void) {
        let previous = doc
        let updated = TodoRepository.mutate(body)
        if animated { withAnimation(.snappy(duration: 0.37)) { doc = updated } } else { doc = updated }
        propagate()
        if let message { show(message, undo: undoable ? previous : nil) }
    }

    func complete(_ id: String) {
        change("已完成一项待办", undoable: true) { TodoLogic.complete(id, in: &$0) }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
    func restore(_ id: String) { change("已恢复到待完成") { TodoLogic.restore(id, in: &$0) } }
    func toggle(_ id: String) {
        if doc.tasks.first(where: { $0.id == id })?.done == true { restore(id) } else { complete(id) }
    }
    func togglePin(_ id: String) { change { TodoLogic.togglePin(id, in: &$0) } }
    func delete(_ id: String) { change("已删除待办", undoable: true) { TodoLogic.delete(id, in: &$0) } }
    func add(_ title: String, group: TaskGroup, repeatRule: RepeatRule) -> Bool {
        let clean = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return false }
        change("待办已添加") { TodoLogic.add(title: clean, group: group, repeatRule: repeatRule, in: &$0) }
        return true
    }
    func update(_ id: String, title: String, group: TaskGroup, repeatRule: RepeatRule) {
        change("已保存修改") { TodoLogic.update(id, title: title, group: group, repeatRule: repeatRule, in: &$0) }
    }
    func archiveDone() {
        let count = doc.tasks.filter { $0.done && $0.repeatRule != .daily }.count
        guard count > 0 else { show("每天重复的事项会在明天自动重置，不需要清理"); return }
        change("已把 \(count) 件移入历史", undoable: true) { TodoLogic.archiveDone(in: &$0) }
    }
    func unarchive(_ id: String) { change("已放回待完成") { TodoLogic.unarchive(id, in: &$0) } }
    func resetExamples() { change("已恢复示例清单", undoable: true) { $0.tasks = TodoDocument.examples() } }
    func pageCard(forward: Bool) {
        change(animated: false) { doc in
            let pages = CardContent.state(for: doc).pageCount
            doc.activityPage = min(max(doc.activityPage + (forward ? 1 : -1), 0), pages - 1)
        }
    }

    func setting<T>(_ keyPath: WritableKeyPath<AppSettings, T>) -> Binding<T> {
        Binding(get: { self.doc.settings[keyPath: keyPath] },
                set: { value in self.change(animated: false) { $0.settings[keyPath: keyPath] = value } })
    }

    func undo() {
        guard let snapshot = undoSnapshot else { return }
        undoSnapshot = nil
        toast = nil
        withAnimation(.snappy) { doc = TodoRepository.mutate { $0 = snapshot } }
        propagate()
    }

    // MARK: Backup

    func backupData() throws -> Data { try TodoRepository.backupData(doc) }

    func importBackup(_ backup: TodoDocument, mode: TodoLogic.ImportMode, includeSettings: Bool) {
        var added = 0
        change(nil, undoable: false) { added = TodoLogic.importBackup(backup, mode: mode, includeSettings: includeSettings, into: &$0) }
        show(mode == .replace ? "已用备份替换清单" : "已合并备份，新增 \(added) 件", undo: nil)
    }

    // MARK: Lifecycle

    func becameActive() {
        let previousDay = doc.day
        doc = TodoRepository.load() // picks up Lock Screen taps and applies the new-day rules
        if previousDay != doc.day { show("新的一天，清单已整理好") }
        refreshActivityStatus()
        propagate()
        if doc.settings.liveActivityOnOpen, liveActivitiesAllowed, !liveActivityRunning, !pending.isEmpty {
            Task { await startLiveActivity(announce: false) }
        }
    }

    func handle(_ url: URL) {
        guard url.scheme == "suisui" else { return }
        switch url.host {
        case "lock": tab = .lock
        case "settings": tab = .settings
        default: tab = .tasks
        }
    }

    // MARK: Live Activity

    func startLiveActivity(announce: Bool = true) async {
        do {
            try await LiveActivityController.start(doc)
            refreshActivityStatus()
            if announce { show("已在锁屏显示今天的待办") }
        } catch {
            refreshActivityStatus()
            if announce { show(liveActivitiesAllowed ? "没能开启实时活动，请稍后再试" : "实时活动已在系统设置中关闭") }
        }
    }

    func endLiveActivity() async {
        await LiveActivityController.end()
        refreshActivityStatus()
        show("已从锁屏移除")
    }

    func refreshActivityStatus() {
        liveActivitiesAllowed = LiveActivityController.isAvailable
        liveActivityRunning = LiveActivityController.isRunning
    }

    // MARK: Private

    private func propagate() {
        TodoRepository.reloadWidgets()
        let snapshot = doc
        Task { await LiveActivityController.update(snapshot) }
    }

    func show(_ message: String, undo snapshot: TodoDocument? = nil) {
        undoSnapshot = snapshot
        toast = Toast(message: message, canUndo: snapshot != nil)
        toastTask?.cancel()
        let seconds: UInt64 = snapshot != nil ? 8 : 4
        toastTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: seconds * 1_000_000_000)
            guard !Task.isCancelled else { return }
            self?.toast = nil
            self?.undoSnapshot = nil
        }
    }
}

extension AppSettings {
    var accentColor: Color {
        switch accent {
        case "rose": return Color(hex: "#b14c6b")
        case "blue": return Color(hex: "#226a9a")
        default: return Color(hex: "#13765b")
        }
    }
}

extension Color {
    /// sRGB hex for storage; used by the color picker.
    var hexString: String {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(self).getRed(&r, green: &g, blue: &b, alpha: &a)
        return HexColor.hex(red: Double(r), green: Double(g), blue: Double(b))
    }
}
