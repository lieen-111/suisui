import Foundation

/// Pure list rules, identical to the web version:
/// - pending before done; pinned pending first; done in completion order (latest last);
/// - completing again after a restore appends to the end again (monotonic completedAt);
/// - on a new day, daily items reset and yesterday's finished one-offs move to history.
enum TodoLogic {
    static func pending(_ tasks: [TodoItem]) -> [TodoItem] {
        stable(tasks.filter { !$0.done }) { $0.pinned && !$1.pinned }
    }

    static func done(_ tasks: [TodoItem]) -> [TodoItem] {
        stable(tasks.filter(\.done)) { $0.completedAt < $1.completedAt }
    }

    /// Order used by the lock-screen card, widgets and Live Activity.
    static func cardOrder(_ tasks: [TodoItem]) -> [TodoItem] { pending(tasks) + done(tasks) }

    /// Swift's sort is not stable; keep insertion order for ties so pinned/unpinned keep their order.
    private static func stable(_ items: [TodoItem], by before: (TodoItem, TodoItem) -> Bool) -> [TodoItem] {
        items.enumerated().sorted { a, b in
            if before(a.element, b.element) { return true }
            if before(b.element, a.element) { return false }
            return a.offset < b.offset
        }.map(\.element)
    }

    static func complete(_ id: String, in doc: inout TodoDocument, now: Double = Date.nowMillis) {
        guard let i = doc.tasks.firstIndex(where: { $0.id == id }), !doc.tasks[i].done else { return }
        let latest = doc.tasks.map { $0.completedAt + 1 }.max() ?? 0
        doc.tasks[i].done = true
        doc.tasks[i].completedAt = max(now, latest)
    }

    static func restore(_ id: String, in doc: inout TodoDocument) {
        guard let i = doc.tasks.firstIndex(where: { $0.id == id }) else { return }
        doc.tasks[i].done = false
    }

    static func toggle(_ id: String, in doc: inout TodoDocument) {
        guard let task = doc.tasks.first(where: { $0.id == id }) else { return }
        if task.done { restore(id, in: &doc) } else { complete(id, in: &doc) }
    }

    static func togglePin(_ id: String, in doc: inout TodoDocument) {
        guard let i = doc.tasks.firstIndex(where: { $0.id == id }) else { return }
        doc.tasks[i].pinned.toggle()
    }

    @discardableResult
    static func add(title: String, group: TaskGroup, repeatRule: RepeatRule, in doc: inout TodoDocument) -> TodoItem? {
        let item = TodoItem(title: title, group: group, repeatRule: repeatRule)
        guard !item.title.isEmpty else { return nil }
        doc.tasks.append(item)
        return item
    }

    static func update(_ id: String, title: String, group: TaskGroup, repeatRule: RepeatRule, in doc: inout TodoDocument) {
        let clean = String(title.trimmingCharacters(in: .whitespacesAndNewlines).prefix(TodoItem.maxTitleLength))
        guard let i = doc.tasks.firstIndex(where: { $0.id == id }), !clean.isEmpty else { return }
        doc.tasks[i].title = clean
        doc.tasks[i].group = group
        doc.tasks[i].repeatRule = repeatRule
    }

    static func delete(_ id: String, in doc: inout TodoDocument) {
        doc.tasks.removeAll { $0.id == id }
    }

    /// Moves finished one-off items to history now. Daily items stay until tomorrow resets them.
    @discardableResult
    static func archiveDone(in doc: inout TodoDocument, now: Double = Date.nowMillis) -> Int {
        let finished = doc.tasks.filter { $0.done && $0.repeatRule != .daily }
        guard !finished.isEmpty else { return 0 }
        doc.archive.append(contentsOf: finished.map { var t = $0; t.archivedAt = now; return t })
        doc.archive = Array(doc.archive.suffix(TodoDocument.archiveLimit))
        let ids = Set(finished.map(\.id))
        doc.tasks.removeAll { ids.contains($0.id) }
        return finished.count
    }

    static func unarchive(_ id: String, in doc: inout TodoDocument) {
        guard let i = doc.archive.firstIndex(where: { $0.id == id }) else { return }
        var item = doc.archive.remove(at: i)
        item.archivedAt = nil
        item.done = false
        item.completedAt = 0
        if doc.tasks.contains(where: { $0.id == item.id }) { item.id = TodoItem.newID() }
        doc.tasks.append(item)
    }

    struct RolloverResult: Equatable { var reset = 0; var archived = 0; var changed = false }

    @discardableResult
    static func rollover(_ doc: inout TodoDocument, now: Date = Date(), calendar: Calendar = .current) -> RolloverResult {
        let today = DayKey.today(now, calendar: calendar)
        guard doc.day != today else { return RolloverResult() }
        let cutoff = DayKey.startOfToday(now, calendar: calendar)
        var result = RolloverResult(changed: true)
        var keep: [TodoItem] = []
        for var t in doc.tasks {
            if t.done && t.repeatRule == .daily {
                t.done = false; t.completedAt = 0; result.reset += 1; keep.append(t)
            } else if t.done && doc.settings.autoArchive && t.completedAt < cutoff {
                t.archivedAt = now.timeIntervalSince1970 * 1000; doc.archive.append(t); result.archived += 1
            } else {
                keep.append(t)
            }
        }
        doc.tasks = keep
        doc.archive = Array(doc.archive.suffix(TodoDocument.archiveLimit))
        doc.day = today
        doc.activityPage = 0
        return result
    }

    enum ImportMode { case merge, replace }

    /// Returns how many tasks were added.
    @discardableResult
    static func importBackup(_ backup: TodoDocument, mode: ImportMode, includeSettings: Bool, into doc: inout TodoDocument) -> Int {
        var added = 0
        switch mode {
        case .replace:
            doc.tasks = backup.tasks
            doc.archive = Array(backup.archive.suffix(TodoDocument.archiveLimit))
            added = backup.tasks.count
        case .merge:
            let ids = Set(doc.tasks.map(\.id))
            let fresh = backup.tasks.filter { !ids.contains($0.id) }
            doc.tasks.append(contentsOf: fresh)
            let archived = Set(doc.archive.map(\.id))
            doc.archive = Array((doc.archive + backup.archive.filter { !archived.contains($0.id) && !ids.contains($0.id) }).suffix(TodoDocument.archiveLimit))
            added = fresh.count
        }
        if includeSettings { doc.settings = backup.settings }
        doc.activityPage = 0
        return added
    }

    /// Plain-text summary used by the inline widget and accessibility.
    static func summary(_ tasks: [TodoItem]) -> String {
        let open = pending(tasks)
        guard let first = open.first else { return tasks.isEmpty ? "今天还没有待办" : "今天的事都完成了" }
        return open.count == 1 ? "最后一件：\(first.title)" : "还有 \(open.count) 件 · \(first.title)"
    }
}
