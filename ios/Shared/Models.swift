import Foundation

// Data model shared by the app, widgets and Live Activity.
// JSON keys match the web version's backup format (app/app.js), so a backup exported from
// the web app imports here and vice versa. Timestamps are milliseconds since 1970, like JavaScript.

/// User-defined group (the web app's `groups` array). Tasks refer to it by id.
struct TaskGroup: Codable, Hashable, Identifiable {
    var id: String
    var name: String
    var color: String

    static let defaults = [
        TaskGroup(id: "work", name: "工作", color: "#13765b"),
        TaskGroup(id: "life", name: "生活", color: "#b14c6b")
    ]
}

enum RepeatRule: String, Codable, CaseIterable, Identifiable {
    case none, daily, weekdays, weekly
    var id: String { rawValue }
    var label: String {
        switch self {
        case .none: return "不重复"
        case .daily: return "每天"
        case .weekdays: return "工作日"
        case .weekly: return "每周"
        }
    }
}

struct TodoItem: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    var group: String
    var pinned: Bool
    var done: Bool
    var completedAt: Double
    var repeatRule: RepeatRule
    var createdAt: Double
    var archivedAt: Double?
    /// One-off tasks may be scheduled for a day ("YYYY-MM-DD"); empty means today.
    var date: String
    /// Weekly repeats: 0 = Sunday … 6 = Saturday (same as JavaScript).
    var repeatDay: Int?

    static let maxTitleLength = 120

    enum CodingKeys: String, CodingKey {
        case id, title, group, pinned, done, completedAt, createdAt, archivedAt, date, repeatDay
        case repeatRule = "repeat"
    }

    init(id: String = TodoItem.newID(), title: String, group: String = "work", pinned: Bool = false,
         done: Bool = false, completedAt: Double = 0, repeatRule: RepeatRule = .none,
         createdAt: Double = Date.nowMillis, archivedAt: Double? = nil, date: String = "", repeatDay: Int? = nil) {
        self.id = id
        self.title = String(title.trimmingCharacters(in: .whitespacesAndNewlines).prefix(Self.maxTitleLength))
        self.group = group
        self.pinned = pinned
        self.done = done
        self.completedAt = completedAt
        self.repeatRule = repeatRule
        self.createdAt = createdAt
        self.archivedAt = archivedAt
        self.date = repeatRule == .none && DayKey.isValid(date) ? date : ""
        self.repeatDay = repeatRule == .weekly ? repeatDay : nil
    }

    // Lenient decoding: unknown or missing values fall back to defaults, like the web validator.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let id = try c.decode(String.self, forKey: .id)
        let title = try c.decode(String.self, forKey: .title).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !id.isEmpty, !title.isEmpty else {
            throw DecodingError.dataCorruptedError(forKey: .title, in: c, debugDescription: "Empty task")
        }
        self.id = String(id.prefix(80))
        self.title = String(title.prefix(Self.maxTitleLength))
        let group: String = (try? c.decodeIfPresent(String.self, forKey: .group)) ?? ""
        self.group = group.isEmpty ? "work" : String(group.prefix(40))
        self.pinned = (try? c.decodeIfPresent(Bool.self, forKey: .pinned)) ?? false
        self.done = (try? c.decodeIfPresent(Bool.self, forKey: .done)) ?? false
        self.completedAt = (try? c.decodeIfPresent(Double.self, forKey: .completedAt)) ?? 0
        self.repeatRule = RepeatRule(rawValue: (try? c.decodeIfPresent(String.self, forKey: .repeatRule)) ?? "") ?? .none
        self.createdAt = (try? c.decodeIfPresent(Double.self, forKey: .createdAt)) ?? 0
        self.archivedAt = try? c.decodeIfPresent(Double.self, forKey: .archivedAt)
        let date: String = (try? c.decodeIfPresent(String.self, forKey: .date)) ?? ""
        self.date = repeatRule == .none && DayKey.isValid(date) ? date : ""
        let day = (try? c.decodeIfPresent(Int.self, forKey: .repeatDay)) ?? nil
        self.repeatDay = repeatRule == .weekly ? (day.flatMap { (0...6).contains($0) ? $0 : nil } ?? DayKey.weekday()) : nil
    }

    static func newID() -> String {
        "t-\(Int(Date.nowMillis))-\(UUID().uuidString.prefix(5).lowercased())"
    }
}

struct AppSettings: Codable, Equatable {
    var accent: String = "green"
    var density: String = "comfortable"
    var cardMaterial: String = "frosted"
    var cardColor: String = "#112b24"
    var cardTransparency: Double = 15
    var cardText: String = "auto"
    var motion: Bool = true
    var intensity: Int = 2
    var autoArchive: Bool = true
    /// Lock screen shows only the count, not the titles.
    var lockPrivacy: Bool = false
    /// Native only: start the Live Activity whenever the app is opened (the web app ignores this key).
    var liveActivityOnOpen: Bool = true

    var rows: Int { density == "compact" ? 4 : 3 }

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = AppSettings()
        accent = (try? c.decodeIfPresent(String.self, forKey: .accent)).flatMap { ["green", "rose", "blue"].contains($0) ? $0 : nil } ?? d.accent
        density = (try? c.decodeIfPresent(String.self, forKey: .density)).flatMap { ["compact", "comfortable"].contains($0) ? $0 : nil } ?? d.density
        cardMaterial = (try? c.decodeIfPresent(String.self, forKey: .cardMaterial)).flatMap { ["frosted", "glass", "flat"].contains($0) ? $0 : nil } ?? d.cardMaterial
        cardColor = (try? c.decodeIfPresent(String.self, forKey: .cardColor)).flatMap { HexColor.isValid($0) ? $0.lowercased() : nil } ?? d.cardColor
        cardTransparency = min(90, max(0, (try? c.decodeIfPresent(Double.self, forKey: .cardTransparency)) ?? d.cardTransparency))
        cardText = (try? c.decodeIfPresent(String.self, forKey: .cardText)).flatMap { ["auto", "light", "dark"].contains($0) ? $0 : nil } ?? d.cardText
        motion = (try? c.decodeIfPresent(Bool.self, forKey: .motion)) ?? d.motion
        intensity = min(3, max(1, (try? c.decodeIfPresent(Int.self, forKey: .intensity)) ?? d.intensity))
        autoArchive = (try? c.decodeIfPresent(Bool.self, forKey: .autoArchive)) ?? d.autoArchive
        lockPrivacy = (try? c.decodeIfPresent(Bool.self, forKey: .lockPrivacy)) ?? d.lockPrivacy
        liveActivityOnOpen = (try? c.decodeIfPresent(Bool.self, forKey: .liveActivityOnOpen)) ?? d.liveActivityOnOpen
    }
}

/// The whole persisted state. The same shape is used for backups.
struct TodoDocument: Codable, Equatable {
    var app: String = "suisui"
    var version: Int = 2
    var exportedAt: String?
    var day: String = DayKey.today()
    var tasks: [TodoItem] = TodoDocument.examples()
    var archive: [TodoItem] = []
    var groups: [TaskGroup] = TaskGroup.defaults
    var settings = AppSettings()
    /// Which "page" of the list the Live Activity shows (it cannot scroll, so it pages).
    var activityPage: Int = 0

    static let archiveLimit = 300

    enum CodingKeys: String, CodingKey { case app, version, exportedAt, day, tasks, archive, groups, settings, activityPage }

    init() {}

    init(from decoder: Decoder) throws {
        // A bare array of tasks is accepted too (older or hand-made backups).
        if let single = try? decoder.singleValueContainer(), let list = try? single.decode([Lenient<TodoItem>].self) {
            self.init()
            tasks = TodoDocument.unique(list.compactMap(\.value))
            return
        }
        self.init()
        let c = try decoder.container(keyedBy: CodingKeys.self)
        guard let list = try? c.decode([Lenient<TodoItem>].self, forKey: .tasks) else {
            throw DecodingError.dataCorruptedError(forKey: .tasks, in: c, debugDescription: "没有找到待办列表")
        }
        tasks = TodoDocument.unique(list.compactMap(\.value))
        archive = TodoDocument.unique(((try? c.decodeIfPresent([Lenient<TodoItem>].self, forKey: .archive)) ?? []).compactMap(\.value))
            .map { var t = $0; t.done = true; if t.archivedAt == nil { t.archivedAt = Date.nowMillis }; return t }
        settings = (try? c.decodeIfPresent(AppSettings.self, forKey: .settings)) ?? AppSettings()
        var seen = Set<String>()
        let decodedGroups = ((try? c.decodeIfPresent([Lenient<TaskGroup>].self, forKey: .groups)) ?? nil)?.compactMap(\.value)
            .filter { !$0.id.isEmpty && !$0.name.isEmpty && seen.insert($0.id).inserted } ?? []
        groups = decodedGroups.isEmpty ? TaskGroup.defaults : Array(decodedGroups.prefix(12))
        let storedDay = (try? c.decodeIfPresent(String.self, forKey: .day)) ?? nil
        // Like the web app: a record without a day marker counts as today, so nothing is archived on upgrade.
        day = storedDay.flatMap { DayKey.isValid($0) ? $0 : nil } ?? DayKey.today()
        activityPage = (try? c.decodeIfPresent(Int.self, forKey: .activityPage)) ?? 0
        exportedAt = try? c.decodeIfPresent(String.self, forKey: .exportedAt)
    }

    /// The group a task belongs to; unknown ids fall back to the first group (as on the web).
    func group(_ id: String) -> TaskGroup { groups.first { $0.id == id } ?? groups.first ?? TaskGroup.defaults[0] }

    static func unique(_ items: [TodoItem]) -> [TodoItem] {
        var seen = Set<String>()
        return items.filter { seen.insert($0.id).inserted }
    }

    static func examples() -> [TodoItem] {
        [
            TodoItem(id: "seed-1", title: "把锁屏待办的想法做出来", group: "work", pinned: true, createdAt: 0),
            TodoItem(id: "seed-2", title: "整理今天的拍摄素材", group: "work", createdAt: 0),
            TodoItem(id: "seed-3", title: "给家里打个电话", group: "life", createdAt: 0),
            TodoItem(id: "seed-4", title: "出门走走，至少二十分钟", group: "life", repeatRule: .daily, createdAt: 0),
            TodoItem(id: "seed-5", title: "把下周的选题记下来", group: "work", createdAt: 0),
            TodoItem(id: "seed-6", title: "读完床头的那一章", group: "life", createdAt: 0)
        ]
    }
}

/// Decodes an element if possible and silently skips invalid entries instead of failing the whole list.
struct Lenient<T: Decodable>: Decodable {
    let value: T?
    init(from decoder: Decoder) throws { value = try? T(from: decoder) }
}

enum DayKey {
    static func today(_ date: Date = Date(), calendar: Calendar = .current) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
    static func isValid(_ value: String) -> Bool {
        value.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil
    }
    static func startOfToday(_ date: Date = Date(), calendar: Calendar = .current) -> Double {
        calendar.startOfDay(for: date).timeIntervalSince1970 * 1000
    }
    /// 0 = Sunday … 6 = Saturday, matching JavaScript's getDay().
    static func weekday(_ date: Date = Date(), calendar: Calendar = .current) -> Int {
        calendar.component(.weekday, from: date) - 1
    }
    static func adding(days: Int, to date: Date = Date(), calendar: Calendar = .current) -> String {
        today(calendar.date(byAdding: .day, value: days, to: date) ?? date, calendar: calendar)
    }
    static func nextMidnight(after date: Date = Date(), calendar: Calendar = .current) -> Date {
        calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: date)) ?? date.addingTimeInterval(86_400)
    }
}

extension Date {
    static var nowMillis: Double { Date().timeIntervalSince1970 * 1000 }
}

enum HexColor {
    static func isValid(_ hex: String) -> Bool {
        hex.range(of: #"^#[0-9a-fA-F]{6}$"#, options: .regularExpression) != nil
    }
    static func rgb(_ hex: String) -> (Double, Double, Double) {
        guard isValid(hex), let value = Int(hex.dropFirst(), radix: 16) else { return (17 / 255, 43 / 255, 36 / 255) }
        return (Double((value >> 16) & 0xff) / 255, Double((value >> 8) & 0xff) / 255, Double(value & 0xff) / 255)
    }
    static func hex(red: Double, green: Double, blue: Double) -> String {
        func c(_ v: Double) -> Int { Int((min(1, max(0, v)) * 255).rounded()) }
        return String(format: "#%02x%02x%02x", c(red), c(green), c(blue))
    }
    /// Same automatic text rule as the web app: compare WCAG contrast of the two ink colors to the base color.
    static func prefersLightInk(_ hex: String, mode: String) -> Bool {
        if mode == "light" { return true }
        if mode == "dark" { return false }
        func lin(_ v: Double) -> Double { v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4) }
        func lum(_ c: (Double, Double, Double)) -> Double { 0.2126 * lin(c.0) + 0.7152 * lin(c.1) + 0.0722 * lin(c.2) }
        let base = lum(rgb(hex))
        func contrast(_ ink: Double) -> Double { (max(ink, base) + 0.05) / (min(ink, base) + 0.05) }
        return contrast(lum((244 / 255, 251 / 255, 247 / 255))) >= contrast(lum((24 / 255, 43 / 255, 34 / 255)))
    }
}
