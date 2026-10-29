import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @EnvironmentObject private var model: TodoModel
    @State private var exporting = false
    @State private var exportFile: BackupFile?
    @State private var importing = false
    @State private var pendingImport: TodoDocument?
    @State private var importSettings = false
    @State private var importError: String?

    private let presets: [(String, String)] = [("#112b24", "松绿"), ("#202326", "石墨"), ("#f5f7f3", "雾白"), ("#563746", "梅紫"), ("#294c64", "湖蓝")]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("打开 App 时自动在锁屏显示", isOn: model.setting(\.liveActivityOnOpen))
                } header: { Text("锁屏") } footer: {
                    Text("实时活动每次最长 8 小时。也可以用“快捷指令”自动化每天定时开启，见“锁屏”页。")
                }

                Section {
                    ColorPicker("底色", selection: Binding(
                        get: { Color(hex: model.doc.settings.cardColor) },
                        set: { model.setting(\.cardColor).wrappedValue = $0.hexString }
                    ), supportsOpacity: false)
                    HStack(spacing: 14) {
                        ForEach(presets, id: \.0) { hex, name in
                            Button { model.setting(\.cardColor).wrappedValue = hex } label: {
                                Circle().fill(Color(hex: hex)).frame(width: 28, height: 28)
                                    .overlay(Circle().strokeBorder(.secondary.opacity(0.4)))
                                    .overlay(Circle().strokeBorder(Color.accentColor, lineWidth: model.doc.settings.cardColor == hex ? 2 : 0).padding(-4))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(name)底色")
                        }
                    }
                    .padding(.vertical, 4)
                    VStack(alignment: .leading) {
                        HStack { Text("透明度"); Spacer(); Text("\(Int(model.doc.settings.cardTransparency))%").foregroundStyle(.secondary).monospacedDigit() }
                        Slider(value: model.setting(\.cardTransparency), in: 0...90, step: 1)
                    }
                    Picker("文字颜色", selection: model.setting(\.cardText)) {
                        Text("自动").tag("auto"); Text("浅色").tag("light"); Text("深色").tag("dark")
                    }
                    Picker("每页显示", selection: model.setting(\.density)) {
                        Text("舒适 · 3 条").tag("comfortable"); Text("紧凑 · 4 条").tag("compact")
                    }
                } header: { Text("待办框") } footer: {
                    Text("锁屏上的磨砂背景由系统提供；底色和透明度叠加在上面。")
                }

                Section("强调色") {
                    Picker("强调色", selection: model.setting(\.accent)) {
                        Text("松绿").tag("green"); Text("莓红").tag("rose"); Text("湖蓝").tag("blue")
                    }
                    .pickerStyle(.segmented)
                }

                Section {
                    Toggle("碎裂动画", isOn: model.setting(\.motion))
                    Picker("碎裂幅度", selection: model.setting(\.intensity)) {
                        Text("轻柔").tag(1); Text("适中").tag(2); Text("强烈").tag(3)
                    }
                    .disabled(!model.doc.settings.motion)
                } header: { Text("完成反馈") } footer: {
                    Text("系统开启“减弱动态效果”时不播放碎裂。锁屏和小组件由系统绘制，只有划线和半透明，没有碎裂动画。")
                }

                Section {
                    Toggle("每天自动把前一天完成的事移入历史", isOn: model.setting(\.autoArchive))
                } header: { Text("每日整理") }

                Section {
                    Button { prepareExport() } label: { Label("导出备份", systemImage: "square.and.arrow.up") }
                    Button { importing = true } label: { Label("导入备份（也支持网页版导出的文件）", systemImage: "square.and.arrow.down") }
                    Button(role: .destructive) { model.resetExamples() } label: { Label("恢复示例清单", systemImage: "arrow.counterclockwise") }
                } header: { Text("数据与备份") } footer: {
                    Text(model.doc.tasks.isEmpty ? "" : "待办只保存在这台 iPhone 上，没有账号，也不会上传。换手机前请导出备份。")
                }

                Section("关于") {
                    LabeledContent("版本", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "-")
                    LabeledContent("数据位置", value: TodoRepository.usesSharedContainer ? "本机（与小组件共享）" : "本机（小组件不可用）")
                    Text("碎碎清单为测试版，名称暂定。背景照片来自 Unsplash。").font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("设置")
            .fileExporter(isPresented: $exporting, document: exportFile, contentType: .json, defaultFilename: "suisui-backup-\(DayKey.today())") { result in
                if case .success = result { model.show("已导出备份") }
            }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in readImport(result) }
            .confirmationDialog(importSummary, isPresented: Binding(get: { pendingImport != nil }, set: { if !$0 { pendingImport = nil } }), titleVisibility: .visible) {
                Button("合并到当前清单") { finishImport(.merge) }
                Button("替换当前清单", role: .destructive) { finishImport(.replace) }
                Button("合并，并导入外观设置") { importSettings = true; finishImport(.merge) }
                Button("取消", role: .cancel) { pendingImport = nil }
            }
            .alert("无法导入", isPresented: Binding(get: { importError != nil }, set: { if !$0 { importError = nil } })) {
                Button("好", role: .cancel) {}
            } message: { Text(importError ?? "") }
        }
    }

    private var importSummary: String {
        guard let backup = pendingImport else { return "" }
        let ids = Set(model.doc.tasks.map(\.id))
        let fresh = backup.tasks.filter { !ids.contains($0.id) }.count
        return "备份里有 \(backup.tasks.count) 件待办\(backup.archive.isEmpty ? "" : "、\(backup.archive.count) 条历史")。合并会加入其中 \(fresh) 件新的事项；替换会用备份覆盖当前清单。"
    }

    private func prepareExport() {
        do {
            exportFile = BackupFile(data: try model.backupData())
            exporting = true
        } catch {
            model.show("导出失败，请重试")
        }
    }

    private func readImport(_ result: Result<URL, Error>) {
        guard case let .success(url) = result else { return }
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do {
            let data = try Data(contentsOf: url)
            guard data.count <= 2 * 1024 * 1024 else { importError = "备份文件过大（超过 2MB）。"; return }
            let backup = try TodoRepository.decode(data)
            guard !backup.tasks.isEmpty || !backup.archive.isEmpty else { importError = "文件里没有可导入的待办。"; return }
            importSettings = false
            pendingImport = backup
        } catch {
            importError = "这个文件不是有效的碎碎清单备份。"
        }
    }

    private func finishImport(_ mode: TodoLogic.ImportMode) {
        guard let backup = pendingImport else { return }
        model.importBackup(backup, mode: mode, includeSettings: importSettings)
        pendingImport = nil
        importSettings = false
    }
}

struct BackupFile: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var data: Data

    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}
