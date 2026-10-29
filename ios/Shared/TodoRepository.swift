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

    /// Reads the current state and applies the new-day rules (persisting them if anything changed).
    static func load() -> TodoDocument {
        mutate { _ in }
    }

    /// Read-modify-write under a file coordinator, so a Lock Screen tap and the open app don't overwrite each other.
    @discardableResult
    static func mutate(_ change: (inout TodoDocument) -> Void) -> TodoDocument {
        let url = fileURL
        var result = TodoDocument()
        var coordinationError: NSError?
        withoutActuallyEscaping(change) { change in
            NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: url, options: .forMerging, error: &coordinationError) { target in
                var doc = (try? Data(contentsOf: target)).flatMap { try? decode($0) } ?? TodoDocument()
                let before = doc
                TodoLogic.rollover(&doc)
                change(&doc)
                if doc != before || !FileManager.default.fileExists(atPath: target.path) {
                    if let data = try? encode(doc) { try? data.write(to: target, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]) }
                }
                result = doc
            }
        }
        if coordinationError != nil {
            // Coordination failing is rare; still return the best available state.
            result = (try? Data(contentsOf: url)).flatMap { try? decode($0) } ?? result
        }
        return result
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
