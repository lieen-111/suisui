import AppIntents
import SwiftUI

extension Color {
    init(hex: String, opacity: Double = 1) {
        let (r, g, b) = HexColor.rgb(hex)
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}

/// Colors derived from the card style, mirroring the web CSS variables (--card-ink, --card-muted, ...).
struct CardPalette {
    let background: Color
    let ink: Color
    let muted: Color
    let rule: Color
    let check: Color
    let light: Bool

    init(_ style: CardStyle) {
        light = HexColor.prefersLightInk(style.cardColor, mode: style.textMode)
        background = Color(hex: style.cardColor, opacity: 1 - style.transparency / 100)
        ink = light ? Color(hex: "#f4fbf7") : Color(hex: "#182b22")
        muted = light ? Color(hex: "#e0eae4") : Color(hex: "#30483b")
        rule = light ? Color(hex: "#d4eddf", opacity: 0.25) : Color(hex: "#183b2b", opacity: 0.19)
        check = light ? Color(hex: "#c6eed2") : Color(hex: "#275d42")
    }
}

/// The lock-screen card: heading, a fixed number of rows, footer with paging.
/// Used by the Live Activity, the home-screen widget and the in-app preview.
/// Rows and page buttons run App Intents, so they work without opening the app
/// (on a locked iPhone the system first asks for Face ID / Touch ID / passcode).
struct TodayCardView: View {
    let state: TodayActivityAttributes.ContentState
    /// In the app the preview mutates the in-memory model directly instead of going through intents.
    var onToggle: ((String) -> Void)?
    var onPage: ((Bool) -> Void)?
    var showsPaging = true

    private var palette: CardPalette { CardPalette(state.style) }
    private var rowHeight: CGFloat { state.style.rows == 4 ? 24 : 30 }
    private var fontSize: CGFloat { state.style.rows == 4 ? 12 : 13 }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 5) {
                Image(systemName: "checkmark.square").foregroundStyle(palette.check)
                Text("今天的待办").fontWeight(.semibold)
                Spacer(minLength: 4)
                Text("\(state.doneCount)/\(state.pendingCount + state.doneCount)").foregroundStyle(palette.muted).monospacedDigit()
            }
            .font(.system(size: 12))
            .frame(height: 22)

            if state.style.privacy {
                HStack(spacing: 8) {
                    Image(systemName: "lock").foregroundStyle(palette.check)
                    Text(state.pendingCount > 0 ? "今天还有 \(state.pendingCount) 件待办 · 解锁查看" : "今天的事都完成了")
                }
                .font(.system(size: 13))
                .frame(maxWidth: .infinity, minHeight: rowHeight * CGFloat(state.style.rows))
            } else if state.items.isEmpty {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle").foregroundStyle(palette.check)
                    Text("今天，留一点空白。")
                }
                .font(.system(size: 13))
                .frame(maxWidth: .infinity, minHeight: rowHeight * CGFloat(state.style.rows))
            } else {
                VStack(spacing: 0) {
                    ForEach(state.items) { item in row(item) }
                    // Keep the card height constant on a short last page.
                    ForEach(0..<max(0, state.style.rows - state.items.count), id: \.self) { _ in
                        Color.clear.frame(height: rowHeight)
                    }
                }
            }

            Rectangle().fill(palette.rule).frame(height: 1)
            HStack(spacing: 10) {
                Text(footerCopy).lineLimit(1)
                Spacer(minLength: 4)
                if showsPaging && state.pageCount > 1 { pager }
            }
            .font(.system(size: 10))
            .foregroundStyle(palette.muted)
            .frame(height: 30)
        }
        .foregroundStyle(palette.ink)
        .padding(.horizontal, 14)
        .padding(.top, 8)
    }

    private var footerCopy: String {
        if state.pendingCount > 0 { return "剩余 \(state.pendingCount) 项 · 已完成 \(state.doneCount) 项" }
        return state.doneCount > 0 ? "全部完成 · \(state.doneCount) 项" : "暂无待办"
    }

    @ViewBuilder private func row(_ item: CardItem) -> some View {
        let label = HStack(spacing: 8) {
            ZStack {
                Circle().strokeBorder(palette.check, lineWidth: 1.4)
                if item.done {
                    Circle().fill(palette.check)
                    Image(systemName: "checkmark").font(.system(size: 8, weight: .bold)).foregroundStyle(palette.background.opacity(1))
                }
            }
            .frame(width: 16, height: 16)
            Text(item.title)
                .font(.system(size: fontSize))
                .strikethrough(item.done)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .opacity(item.done ? 0.5 : 1)
        .frame(height: rowHeight)
        .contentShape(Rectangle())

        Group {
            if let onToggle {
                Button { onToggle(item.id) } label: { label }
            } else {
                Button(intent: ToggleTaskIntent(taskID: item.id)) { label }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.done ? "恢复：\(item.title)" : "完成：\(item.title)")
    }

    private var pager: some View {
        HStack(spacing: 6) {
            pageButton(forward: false, systemImage: "chevron.up").disabled(state.page == 0)
            Text("\(state.page + 1)/\(state.pageCount)").monospacedDigit()
            pageButton(forward: true, systemImage: "chevron.down").disabled(state.page >= state.pageCount - 1)
        }
    }

    @ViewBuilder private func pageButton(forward: Bool, systemImage: String) -> some View {
        let icon = Image(systemName: systemImage).font(.system(size: 11, weight: .semibold)).frame(width: 26, height: 26).contentShape(Rectangle())
        Group {
            if let onPage {
                Button { onPage(forward) } label: { icon }
            } else {
                Button(intent: PageCardIntent(forward: forward)) { icon }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(forward ? "下一页" : "上一页")
    }
}
