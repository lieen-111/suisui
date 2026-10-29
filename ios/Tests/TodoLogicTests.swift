import XCTest

/// Runs on the CI simulator. Mirrors the web rules verified by scripts/verify-completion.cjs and verify-beta.cjs.
final class TodoLogicTests: XCTestCase {
    private func doc(_ tasks: [TodoItem]) -> TodoDocument {
        var d = TodoDocument()
        d.tasks = tasks
        return d
    }

    func testCompletedMoveToEndInCompletionOrderIncludingPinned() {
        var d = TodoDocument()
        TodoLogic.complete("seed-1", in: &d, now: 1000) // pinned
        TodoLogic.complete("seed-5", in: &d, now: 1000)
        let order = TodoLogic.cardOrder(d.tasks).map(\.id)
        XCTAssertEqual(Array(order.suffix(2)), ["seed-1", "seed-5"])
        XCTAssertEqual(order.first, "seed-2")
    }

    func testRestoreThenRecompleteAppendsAgain() {
        var d = TodoDocument()
        TodoLogic.complete("seed-2", in: &d, now: 10)
        TodoLogic.complete("seed-3", in: &d, now: 10)
        TodoLogic.restore("seed-2", in: &d)
        XCTAssertEqual(TodoLogic.pending(d.tasks).first?.id, "seed-1", "Pinned pending stays first")
        TodoLogic.complete("seed-2", in: &d, now: 10)
        XCTAssertEqual(TodoLogic.cardOrder(d.tasks).last?.id, "seed-2")
    }

    func testPinnedFirstKeepsInsertionOrder() {
        let d = doc([TodoItem(id: "a", title: "A"), TodoItem(id: "b", title: "B", pinned: true), TodoItem(id: "c", title: "C"), TodoItem(id: "d", title: "D", pinned: true)])
        XCTAssertEqual(TodoLogic.pending(d.tasks).map(\.id), ["b", "d", "a", "c"])
    }

    func testRolloverResetsDailyAndArchivesYesterday() {
        let calendar = Calendar(identifier: .gregorian)
        let evening = calendar.date(from: DateComponents(year: 2026, month: 10, day: 29, hour: 21))!
        let morning = calendar.date(from: DateComponents(year: 2026, month: 10, day: 30, hour: 7))!
        var d = TodoDocument()
        d.day = DayKey.today(evening, calendar: calendar)
        TodoLogic.complete("seed-4", in: &d, now: evening.timeIntervalSince1970 * 1000) // daily
        TodoLogic.complete("seed-2", in: &d, now: evening.timeIntervalSince1970 * 1000)
        let result = TodoLogic.rollover(&d, now: morning, calendar: calendar)
        XCTAssertEqual(result.reset, 1)
        XCTAssertEqual(result.archived, 1)
        XCTAssertEqual(d.tasks.count, 5)
        XCTAssertFalse(d.tasks.first { $0.id == "seed-4" }!.done)
        XCTAssertEqual(d.archive.map(\.id), ["seed-2"])
        XCTAssertEqual(d.day, "2026-10-30")
        XCTAssertEqual(TodoLogic.rollover(&d, now: morning, calendar: calendar), .init(), "Second run the same day changes nothing")
    }

    func testDecodesWebBackupAndSkipsInvalidEntries() throws {
        let json = """
        {"app":"suisui","version":2,"tasks":[
          {"id":"seed-1","title":"网页导出","group":"life","pinned":true,"done":false,"completedAt":0,"repeat":"daily","createdAt":5},
          {"id":"bad","title":"   "},
          {"id":"x","title":"未知分组","group":"other"},
          {"id":"seed-1","title":"重复 id"}
        ],"archive":[{"id":"old","title":"历史","group":"work","completedAt":1}],
        "settings":{"cardColor":"#F5F7F3","cardTransparency":140,"density":"compact","wallpaper":"lake","photo":""}}
        """
        let d = try TodoRepository.decode(Data(json.utf8))
        XCTAssertEqual(d.tasks.map(\.id), ["seed-1", "x"])
        XCTAssertEqual(d.tasks[0].repeatRule, .daily)
        XCTAssertEqual(d.tasks[1].group, .work)
        XCTAssertEqual(d.archive.first?.done, true)
        XCTAssertEqual(d.settings.cardColor, "#f5f7f3")
        XCTAssertEqual(d.settings.cardTransparency, 90)
        XCTAssertEqual(d.settings.rows, 4)
    }

    func testBareArrayBackupAndRoundTrip() throws {
        let d = try TodoRepository.decode(Data(#"[{"id":"n1","title":"数组备份"}]"#.utf8))
        XCTAssertEqual(d.tasks.map(\.title), ["数组备份"])
        let again = try TodoRepository.decode(try TodoRepository.backupData(d))
        XCTAssertEqual(again.tasks, d.tasks)
        let raw = try JSONSerialization.jsonObject(with: try TodoRepository.backupData(d)) as! [String: Any]
        XCTAssertNotNil((raw["tasks"] as? [[String: Any]])?.first?["repeat"], "Uses the web key name 'repeat'")
    }

    func testMergeAndReplace() {
        var current = TodoDocument()
        let backup = doc([TodoItem(id: "seed-1", title: "已存在"), TodoItem(id: "new", title: "新的")])
        XCTAssertEqual(TodoLogic.importBackup(backup, mode: .merge, includeSettings: false, into: &current), 1)
        XCTAssertEqual(current.tasks.count, 7)
        TodoLogic.importBackup(backup, mode: .replace, includeSettings: false, into: &current)
        XCTAssertEqual(current.tasks.count, 2)
    }

    func testCardPagesAreClampedAndFitThe4KBLimit() throws {
        var d = TodoDocument()
        d.tasks = (0..<40).map { TodoItem(id: "t\($0)", title: String(repeating: "很长的待办标题", count: 20)) }
        d.activityPage = 99
        let state = CardContent.state(for: d)
        XCTAssertEqual(state.pageCount, 14)
        XCTAssertEqual(state.page, 13)
        XCTAssertLessThanOrEqual(state.items.first!.title.count, CardContent.titleLimit)
        XCTAssertLessThan(try JSONEncoder().encode(state).count, 4096)
    }

    func testAutomaticInkMatchesWeb() {
        XCTAssertTrue(HexColor.prefersLightInk("#112b24", mode: "auto"))
        XCTAssertFalse(HexColor.prefersLightInk("#f5f7f3", mode: "auto"))
        XCTAssertFalse(HexColor.prefersLightInk("#999999", mode: "auto"), "Mid-gray favors dark ink, as in verify.cjs")
        XCTAssertTrue(HexColor.prefersLightInk("#999999", mode: "light"))
    }
}
