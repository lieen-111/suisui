import Foundation
import SwiftUI

struct TasksView: View {
    @EnvironmentObject private var model: TodoModel
    @State private var newTitle = ""
    @State private var newGroup = "work"
    @State private var newRepeat: RepeatRule = .none
    @State private var newTomorrow = false
    @State private var filter: String?
    @State private var editing: TodoItem?
    @State private var showHistory = false
    @FocusState private var inputFocused: Bool

    private var visiblePending: [TodoItem] { model.pending.filter { filter == nil || model.doc.group($0.group).id == filter } }

    private var progressCopy: String {
        let open = model.pending.count, done = model.done.count
        if open > 0 { return "还有 \(open) 件事，完成了 \(done) 件。" }
        return done > 0 ? "今天的 \(done) 件事，都完成了。" : "给今天留下一件想做的事。"
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    addBar
                } header: {
                    Text(progressCopy).textCase(nil)
                }

                Section {
                    Picker("分组", selection: $filter) {
                        Text("全部 \(model.pending.count)").tag(String?.none)
                        ForEach(model.doc.groups) { g in
                            Text("\(g.name) \(model.pending.filter { model.doc.group($0.group).id == g.id }.count)").tag(String?.some(g.id))
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())

                    if visiblePending.isEmpty {
                        EmptyStateRow(text: model.pending.isEmpty ? (model.done.isEmpty ? "今天从一件小事开始。" : "都完成了，给自己一点空白。") : "这个分组暂时没有待办")
                    }
                    ForEach(visiblePending) { task in
                        TaskRow(task: task) { editing = task }
                    }
                } header: {
                    Text("待完成").textCase(nil)
                }

                if !model.later.isEmpty {
                    Section {
                        ForEach(model.later) { task in
                            TaskRow(task: task) { editing = task }
                        }
                    } header: {
                        Text("以后").textCase(nil)
                    }
                }

                if !model.done.isEmpty {
                    Section {
                        ForEach(model.done) { task in DoneRow(task: task) }
                    } header: {
                        HStack {
                            Text("已完成 \(model.done.count)")
                            Spacer()
                            Button("现在移入历史") { model.archiveDone() }.font(.caption)
                        }
                        .textCase(nil)
                    } footer: {
                        Text("已完成的事项第二天会自动移入历史；重复的事项到下次该做的那天回到待完成。")
                    }
                }

                if !model.archive.isEmpty {
                    Section {
                        DisclosureGroup("历史 \(model.archive.count)", isExpanded: $showHistory) {
                            ForEach(model.archive.prefix(60)) { task in ArchiveRow(task: task) }
                        }
                    }
                }
            }
            .navigationTitle("今天，慢慢完成。")
            .navigationBarTitleDisplayMode(.large)
            .sheet(item: $editing) { task in EditTaskSheet(task: task) }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    private var addBar: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: "plus").foregroundStyle(.tint)
                TextField("接下来，要做什么？", text: $newTitle)
                    .focused($inputFocused)
                    .submitLabel(.done)
                    .onSubmit(submit)
                    .onChange(of: newTitle) { _, value in
                        if value.count > TodoItem.maxTitleLength { newTitle = String(value.prefix(TodoItem.maxTitleLength)) }
                    }
            }
            HStack(spacing: 8) {
                Picker("分组", selection: $newGroup) {
                    ForEach(model.doc.groups) { Text($0.name).tag($0.id) }
                }
                .pickerStyle(.menu)
                Picker("日期", selection: $newTomorrow) {
                    Text("今天").tag(false); Text("明天").tag(true)
                }
                .pickerStyle(.menu)
                .disabled(newRepeat != .none)
                Picker("重复", selection: $newRepeat) {
                    ForEach(RepeatRule.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.menu)
                Spacer()
                Button(action: submit) { Label("添加", systemImage: "plus") }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .disabled(newTitle.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .font(.footnote)
        }
        .padding(.vertical, 4)
    }

    private func submit() {
        if model.add(newTitle, group: newGroup, repeatRule: newRepeat, date: newTomorrow && newRepeat == .none ? DayKey.adding(days: 1) : "") {
            newTitle = ""
            filter = nil
            inputFocused = true
        }
    }
}

struct EmptyStateRow: View {
    let text: String
    var body: some View {
        HStack {
            Spacer()
            VStack(spacing: 8) {
                Image(systemName: "checkmark.circle").font(.title).foregroundStyle(.tint)
                Text(text).font(.subheadline).foregroundStyle(.secondary)
            }
            .padding(.vertical, 18)
            Spacer()
        }
    }
}

struct TaskRow: View {
    @EnvironmentObject private var model: TodoModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let task: TodoItem
    var onEdit: () -> Void
    @State private var progress: CGFloat = 0
    @State private var shattering = false

    var body: some View {
        HStack(spacing: 12) {
            Button(action: completeTapped) {
                Image(systemName: "circle").font(.title3).foregroundStyle(.secondary)
                    .frame(width: 32, height: 40).contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("完成：\(task.title)")

            VStack(alignment: .leading, spacing: 4) {
                ZStack(alignment: .topLeading) {
                    Text(task.title).opacity(shattering ? 0 : 1)
                    if shattering {
                        ShatterText(text: task.title, progress: progress, strength: CGFloat([0.7, 1.0, 1.5][model.doc.settings.intensity - 1]))
                            .allowsHitTesting(false)
                    }
                }
                HStack(spacing: 6) {
                    Circle().fill(Color(hex: model.doc.group(task.group).color)).frame(width: 5, height: 5)
                    Text(model.doc.group(task.group).name)
                    if task.repeatRule != .none { Label(repeatText, systemImage: "repeat").labelStyle(.titleAndIcon) }
                    if task.repeatRule == .none && !task.date.isEmpty && task.date != DayKey.today() {
                        Label(dateText, systemImage: "calendar").labelStyle(.titleAndIcon)
                            .foregroundStyle(task.date < DayKey.today() ? Color(hex: "#b14c6b") : Color.secondary)
                    }
                    if task.pinned { Label("置顶", systemImage: "pin.fill").labelStyle(.titleAndIcon).foregroundStyle(.tint) }
                }
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .onTapGesture(perform: onEdit)
        }
        .swipeActions(edge: .leading) {
            Button { model.togglePin(task.id) } label: {
                Label(task.pinned ? "取消置顶" : "置顶", systemImage: task.pinned ? "pin.slash" : "pin")
            }
            .tint(.accentColor)
        }
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) { model.delete(task.id) } label: { Label("删除", systemImage: "trash") }
            Button(action: onEdit) { Label("编辑", systemImage: "pencil") }.tint(.gray)
        }
        .contextMenu {
            Button(action: onEdit) { Label("编辑", systemImage: "pencil") }
            Button { model.togglePin(task.id) } label: { Label(task.pinned ? "取消置顶" : "置顶", systemImage: "pin") }
            Button(role: .destructive) { model.delete(task.id) } label: { Label("删除", systemImage: "trash") }
        }
    }

    private var repeatText: String {
        guard task.repeatRule == .weekly else { return task.repeatRule.label }
        let names = ["日", "一", "二", "三", "四", "五", "六"]
        return "每周" + names[min(max(task.repeatDay ?? 1, 0), 6)]
    }

    private var dateText: String {
        if task.date == DayKey.adding(days: 1) { return "明天" }
        let parts = task.date.split(separator: "-")
        let label = parts.count == 3 ? "\(Int(parts[1]) ?? 0)月\(Int(parts[2]) ?? 0)日" : task.date
        return task.date < DayKey.today() ? "已过期 · " + label : label
    }

    private func completeTapped() {
        guard !shattering else { return }
        guard model.doc.settings.motion, !reduceMotion else { model.complete(task.id); return }
        shattering = true
        withAnimation(.easeOut(duration: 0.75)) { progress = 1 }
        // Same rhythm as the web version: shards fly, then the row moves to the end struck through.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.52) { model.complete(task.id) }
    }
}

struct DoneRow: View {
    @EnvironmentObject private var model: TodoModel
    let task: TodoItem

    var body: some View {
        HStack(spacing: 12) {
            Button { model.restore(task.id) } label: {
                Image(systemName: "checkmark.circle.fill").font(.title3).foregroundStyle(.tint)
                    .frame(width: 32, height: 36).contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("恢复：\(task.title)")
            Text(task.title).strikethrough().foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            if task.repeatRule != .none {
                Image(systemName: "repeat").font(.caption).foregroundStyle(.secondary).accessibilityLabel("明天自动重新出现")
            }
        }
        .opacity(0.5)
        .swipeActions {
            Button(role: .destructive) { model.delete(task.id) } label: { Label("删除", systemImage: "trash") }
        }
    }
}

struct ArchiveRow: View {
    @EnvironmentObject private var model: TodoModel
    let task: TodoItem
    private static let format: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "zh_CN"); f.dateFormat = "M月d日"; return f
    }()

    var body: some View {
        HStack {
            Text(task.title).strikethrough().foregroundStyle(.secondary).lineLimit(2)
            Spacer()
            Text(Self.format.string(from: Date(timeIntervalSince1970: (task.completedAt > 0 ? task.completedAt : (task.archivedAt ?? 0)) / 1000)))
                .font(.caption2).foregroundStyle(.secondary).monospacedDigit()
            Button { model.unarchive(task.id) } label: { Image(systemName: "arrow.uturn.backward") }
                .buttonStyle(.borderless)
                .accessibilityLabel("放回待办：\(task.title)")
        }
        .font(.subheadline)
    }
}

struct EditTaskSheet: View {
    @EnvironmentObject private var model: TodoModel
    @Environment(\.dismiss) private var dismiss
    let task: TodoItem
    @State private var title = ""
    @State private var group = "work"
    @State private var repeatRule: RepeatRule = .none
    @State private var hasDate = false
    @State private var date = Date()

    var body: some View {
        NavigationStack {
            Form {
                TextField("待办内容", text: $title, axis: .vertical)
                Picker("分组", selection: $group) { ForEach(model.doc.groups) { Text($0.name).tag($0.id) } }
                Picker("重复", selection: $repeatRule) { ForEach(RepeatRule.allCases) { Text($0.label).tag($0) } }
                if repeatRule == .none {
                    Toggle("指定日期", isOn: $hasDate)
                    if hasDate { DatePicker("日期", selection: $date, displayedComponents: .date) }
                }
                Section {
                    Button("删除这件事", role: .destructive) { model.delete(task.id); dismiss() }
                }
            }
            .navigationTitle("编辑待办")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") {
                        model.update(task.id, title: title, group: group, repeatRule: repeatRule, date: hasDate ? DayKey.today(date) : "")
                        dismiss()
                    }
                        .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .onAppear {
                title = task.title; group = model.doc.group(task.group).id; repeatRule = task.repeatRule
                hasDate = !task.date.isEmpty
                let parts = task.date.split(separator: "-").compactMap { Int($0) }
                if parts.count == 3, let d = Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])) { date = d }
            }
        }
        .presentationDetents([.medium])
    }
}

// MARK: - Completion shatter

/// The task title breaks into triangular shards that each carry their slice of the text,
/// like the web version. Positions are deterministic so redraws don't jitter.
struct ShatterText: View {
    let text: String
    var progress: CGFloat
    var strength: CGFloat
    private let cols = 8
    private let rows = 3

    var body: some View {
        Text(text)
            .opacity(0)
            .overlay {
                GeometryReader { geo in
                    ZStack(alignment: .topLeading) {
                        ForEach(0..<(cols * rows * 2), id: \.self) { index in
                            shard(index, size: geo.size)
                        }
                    }
                }
            }
    }

    private func shard(_ index: Int, size: CGSize) -> some View {
        let cell = index / 2, x = cell % cols, y = cell / cols, upper = index % 2 == 0
        let r1 = pseudoRandom(index * 3 + 1), r2 = pseudoRandom(index * 3 + 2), r3 = pseudoRandom(index * 3 + 3)
        let dx = (CGFloat(x) / CGFloat(cols - 1) - 0.5) * (130 + r1 * 95) * strength
        let dy = (CGFloat(y - 1) * 44 - 35 - r2 * 45) * strength
        let anchor = UnitPoint(x: (CGFloat(x) + 0.5) / CGFloat(cols), y: (CGFloat(y) + 0.5) / CGFloat(rows))
        return Text(text)
            .frame(width: size.width, height: size.height, alignment: .topLeading)
            .background(Color.accentColor.opacity(0.16))
            .clipShape(ShardShape(col: x, row: y, cols: cols, rows: rows, upper: upper))
            .scaleEffect(1 - 0.7 * progress, anchor: anchor)
            .rotationEffect(.degrees((r3 - 0.5) * 140 * progress), anchor: anchor)
            .offset(x: dx * progress, y: dy * progress)
            .opacity(Double(1 - progress))
    }

    private func pseudoRandom(_ seed: Int) -> CGFloat {
        let v = sin(Double(seed) * 12.9898) * 43758.5453
        return CGFloat(v - v.rounded(.down))
    }
}

struct ShardShape: Shape {
    let col: Int, row: Int, cols: Int, rows: Int
    let upper: Bool

    func path(in rect: CGRect) -> Path {
        let w = rect.width / CGFloat(cols), h = rect.height / CGFloat(rows)
        let x0 = rect.minX + CGFloat(col) * w, y0 = rect.minY + CGFloat(row) * h
        let x1 = x0 + w + 0.5, y1 = y0 + h + 0.5
        var p = Path()
        if upper {
            p.move(to: CGPoint(x: x0, y: y0)); p.addLine(to: CGPoint(x: x1, y: y0)); p.addLine(to: CGPoint(x: x0, y: y1))
        } else {
            p.move(to: CGPoint(x: x1, y: y0)); p.addLine(to: CGPoint(x: x1, y: y1)); p.addLine(to: CGPoint(x: x0, y: y1))
        }
        p.closeSubpath()
        return p
    }
}
