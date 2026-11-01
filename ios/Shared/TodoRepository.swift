import Foundation
import WidgetKit

/// One JSON file in the App Group container, shared by the app, the widget extension and
/// intents that run from the Lock Screen. Writes are coordinated across processes.
enum TodoRepository {
    static let fileName = "suisui-data.json"

    /// The App Group shared by the app and its widget extension.
    /// Free-Apple-ID re-signing tools (Sideloadly, AltStore, SideStore) may rename the group, so when the
    /// configured name has no container, the real one is read from the bundle's embedded provisioning profile.
    static let appGroupID: String = {
        let configured = (Bundle.main.object(forInfoDictionaryKey: "SuiSuiAppGroup") as? String) ?? ""
        if !configured.isEmpty, FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: configured) != nil {
            return configured
        }
        let candidates = provisionedAppGroups()
        // Prefer a group that still contains the configured name, then any group that resolves.
        let ordered = candidates.filter { !configured.isEmpty && $0.contains(configured.replacingOccurrences(of: "group.", with: "")) } + candidates
        return ordered.first { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: $0) != nil } ?? configured
    }()

    /// Reads `com.apple.security.application-groups` from embedded.mobileprovision (present in development,
    /// ad-hoc and sideloaded builds; absent in TestFlight/App Store builds, where the configured name is correct).
    private static func provisionedAppGroups() -> [String] {
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url),
              let start = data.range(of: Data("<?xml".utf8)),
              let end = data.range(of: Data("</plist>".utf8), in: start.lowerBound..<data.endIndex),
              let plist = try? PropertyListSerialization.propertyList(from: data[start.lowerBound..<end.upperBound], format: nil) as? [String: Any],
              let entitlements = plist["Entitlements"] as? [String: Any],
              let groups = entitlements["com.apple.security.application-groups"] as? [String]
        else { return [] }
        return groups
    }

    /// Without a signed App Group (e.g. an unsigned simulator build) fall back to the app's own folder,
    /// so the app still works; widgets then show sample data.
    static var fileURL: URL {
        if !appGroupID.isEmpty,
           let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupID) {
            return container.appendingPathComponent(fileName)
        }
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        return base.appendingPathComponent(fileName)
    }

    static var usesSharedContainer: Bool {
        !appGroupID.isEmpty && FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupID) != nil
    }

    private static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return e
    }()

    static func decode(_ data: Data) throws -> TodoDocument {
        try JSONDecoder().decode(TodoDocument.self, from: data)
    }

    static func encode(_ doc: TodoDocument) throws -> Data {
        try encoder.encode(doc)
    }

    /// Posted (in this process) after a native change, so the open app can hand the new data to its page.
    static let didChange = Notification.Name("SuiSuiDataDidChange")

    /// A fresh install starts empty, like the web app (no sample tasks).
    static var empty: TodoDocument { var d = TodoDocument(); d.tasks = []; return d }

    /// Reads the current state and applies the new-day rules (persisting them if anything changed).
    static func load() -> TodoDocument {
        mutate { _ in }
    }

    /// Read-only view with today's rules applied in memory: widgets use this, so a timeline refresh never
    /// writes (and never makes the open page's next save look stale).
    static func read() -> TodoDocument {
        var doc = (try? Data(contentsOf: fileURL)).flatMap { try? decode($0) } ?? empty
        TodoLogic.rollover(&doc)
        return doc
    }

    /// Read-modify-write under a file coordinator, so a Lock Screen tap and the open app don't overwrite each other.
    /// Only the values the change touched are written; fields the Swift model does not know are kept (see RawJSON).
    /// Like the Android shell, every real change bumps `rev`, and a completion adds a line to the review log.
    @discardableResult
    static func mutate(_ change: (inout TodoDocument) -> Void) -> TodoDocument {
        let url = fileURL
        var result = empty
        var changed = false
        var coordinationError: NSError?
        withoutActuallyEscaping(change) { change in
            NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: url, options: .forMerging, error: &coordinationError) { target in
                let applied = apply(stored: try? Data(contentsOf: target), change)
                result = applied.doc
                if let data = applied.write {
                    try? data.write(to: target, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                    changed = true
                }
            }
        }
        if coordinationError != nil {
            // Coordination failing is rare; still return the best available state.
            result = (try? Data(contentsOf: url)).flatMap { try? decode($0) } ?? result
        }
        if changed { NotificationCenter.default.post(name: didChange, object: nil) }
        return result
    }

    /// The pure part of `mutate`: the new document, and the bytes to store when anything changed.
    /// A file that cannot be read is never overwritten (the page or a later version may still read it).
    static func apply(stored: Data?, _ change: (inout TodoDocument) -> Void) -> (doc: TodoDocument, write: Data?) {
        var doc = empty
        if let stored {
            guard let decoded = try? decode(stored) else { return (empty, nil) }
            doc = decoded
        }
        let before = doc
        TodoLogic.rollover(&doc)
        change(&doc)
        guard doc != before else { return (doc, nil) }
        let raw = RawJSON.object(stored)
        let old = RawJSON.object(encoding: before)
        let patched = raw == nil ? RawJSON.object(encoding: doc)
            : RawJSON.patch(raw, before: old, after: RawJSON.object(encoding: doc), rawPool: RawJSON.taskPool(raw), beforePool: RawJSON.taskPool(old as? RawJSON.Object))
        var out = patched as? RawJSON.Object ?? [:]
        if raw != nil { logCompletions(&out, before: before, after: doc) }
        out["schema"] = out["schema"] ?? 2
        out["rev"] = RawJSON.int(out["rev"]) + 1
        return (doc, RawJSON.data(out))
    }

    /// Same lines app.js writes (markDone / unmarkDone), so lock-screen ticks show up in the weekly and monthly review.
    private static func logCompletions(_ out: inout RawJSON.Object, before: TodoDocument, after: TodoDocument) {
        var log = out["log"] as? [Any] ?? []
        var tasks = out["tasks"] as? [Any] ?? []
        let old = Dictionary(before.tasks.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        for (i, item) in tasks.enumerated() {
            guard var t = item as? RawJSON.Object, let id = t["id"] as? String,
                  let now = after.tasks.first(where: { $0.id == id }), let was = old[id] else { continue }
            if now.done && !was.done {
                let minutes = Int((RawJSON.int(t["focusMs"]) + 30_000) / 60_000)
                log.append(["id": id, "title": now.title, "group": now.group, "at": now.completedAt, "min": minutes] as [String: Any])
                t["focusMs"] = 0
                tasks[i] = t
            } else if !now.done && was.done {
                if let j = log.lastIndex(where: { ($0 as? RawJSON.Object)?["id"] as? String == id && RawJSON.equal(($0 as? RawJSON.Object)?["at"], was.completedAt as NSNumber) }) {
                    t["focusMs"] = RawJSON.int((log[j] as? RawJSON.Object)?["min"]) * 60_000
                    tasks[i] = t
                    log.remove(at: j)
                }
            }
        }
        out["tasks"] = tasks
        out["log"] = Array(log.suffix(3000))
    }

    /// The page saves its whole record. Like the Android shell, an older revision is refused (a Lock Screen
    /// tap saved newer data meanwhile); the page then takes the stored copy. Returns the stored document.
    static func writeFromPage(_ data: Data) -> (accepted: Bool, doc: TodoDocument?) {
        guard let incoming = RawJSON.object(data), incoming["tasks"] is [Any] else { return (false, nil) }
        var accepted = false
        var coordinationError: NSError?
        NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: fileURL, options: .forMerging, error: &coordinationError) { target in
            let current = RawJSON.object(try? Data(contentsOf: target))
            let currentRev = RawJSON.int(current?["rev"]), rev = RawJSON.int(incoming["rev"])
            if current != nil && currentRev > 0 && rev <= currentRev { return }
            accepted = (try? data.write(to: target, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])) != nil
        }
        return (accepted, try? decode(data))
    }

    /// The stored record as the page reads it ("" before the first save).
    static func rawString() -> String {
        var text = ""
        var coordinationError: NSError?
        NSFileCoordinator(filePresenter: nil).coordinate(readingItemAt: fileURL, options: [], error: &coordinationError) { target in
            text = (try? String(contentsOf: target, encoding: .utf8)) ?? ""
        }
        return text
    }

    /// Export payload: same shape as the web backup, minus the Live Activity page marker.
    static func backupData(_ doc: TodoDocument) throws -> Data {
        var copy = doc
        copy.exportedAt = ISO8601DateFormatter().string(from: Date())
        copy.activityPage = 0
        return try encode(copy)
    }

    static func reloadWidgets() {
        WidgetCenter.shared.reloadAllTimelines()
    }
}
