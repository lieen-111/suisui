import Foundation

/// The stored file is written by the web page (the app's whole interface) and read by widgets, the Live
/// Activity and Lock Screen intents. The page's records carry more than the Swift model knows (notes,
/// subtasks, reminder times, durations, the completion log, the timer, every look setting), so native
/// changes are applied as a patch: only the values Swift actually changed are written back, everything
/// else in the stored JSON is kept as it was.
enum RawJSON {
    typealias Object = [String: Any]

    static func object(_ data: Data?) -> Object? {
        guard let data else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? Object
    }

    static func object<T: Encodable>(encoding value: T) -> Any? {
        guard let data = try? JSONEncoder().encode(value) else { return nil }
        return try? JSONSerialization.jsonObject(with: data)
    }

    static func data(_ object: Object) -> Data? {
        try? JSONSerialization.data(withJSONObject: object, options: [.withoutEscapingSlashes])
    }

    static func equal(_ a: Any?, _ b: Any?) -> Bool {
        switch (a, b) {
        case (nil, nil): return true
        case let (x as NSObject, y as NSObject): return x.isEqual(y)
        default: return false
        }
    }

    /// Applies the difference between `before` and `after` (both encoded from the Swift model) to `raw`.
    /// Arrays of objects with an `id` are matched by id, so a task keeps its unknown fields when it changes.
    /// `rawPool` / `beforePool` hold every task by id, so one that moved to the archive (or back) keeps them too.
    static func patch(_ raw: Any?, before: Any?, after: Any?, rawPool: [String: Object] = [:], beforePool: [String: Object] = [:]) -> Any? {
        if equal(before, after), let raw { return raw }
        guard let after else { return nil }
        if let a = after as? Object {
            let b = before as? Object ?? [:]
            var out = raw as? Object ?? [:]
            for key in Set(a.keys).union(b.keys) {
                if let value = a[key] {
                    // Task lists share the pools (a task can move between them); nothing else does.
                    let lists = key == "tasks" || key == "archive"
                    if !equal(b[key], value) || out[key] == nil {
                        out[key] = patch(out[key], before: b[key], after: value, rawPool: lists ? rawPool : [:], beforePool: lists ? beforePool : [:])
                    }
                } else if b[key] != nil {
                    out.removeValue(forKey: key)
                }
            }
            return out
        }
        if let a = after as? [Any], a.allSatisfy({ ($0 as? Object)?["id"] is String }) {
            var bById = beforePool, rawById = rawPool
            for item in before as? [Any] ?? [] { if let o = item as? Object, let id = o["id"] as? String { bById[id] = o } }
            for item in raw as? [Any] ?? [] { if let o = item as? Object, let id = o["id"] as? String { rawById[id] = o } }
            return a.map { item -> Any in
                let o = item as! Object, id = o["id"] as! String
                guard let r = rawById[id] else { return o }
                return patch(r, before: bById[id], after: o) ?? o
            }
        }
        return after
    }

    /// Every object with an id in the file's task lists, so a task moved between lists keeps its fields.
    static func taskPool(_ raw: Object?) -> [String: Object] {
        var pool: [String: Object] = [:]
        for key in ["archive", "tasks"] {
            for item in raw?[key] as? [Any] ?? [] { if let o = item as? Object, let id = o["id"] as? String { pool[id] = o } }
        }
        return pool
    }

    static func int(_ value: Any?) -> Int64 { (value as? NSNumber)?.int64Value ?? 0 }
}
