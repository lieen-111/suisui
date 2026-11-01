import ActivityKit
import Photos
import SwiftUI
import UIKit
import WebKit

/// The iPhone app shows the same interface as the Android app and the web version: the bundled `app/`
/// folder in a WKWebView. The native side keeps the stored file (shared with widgets, the Live Activity and
/// Lock Screen intents) and offers the page the same bridge as Android (`window.SuiSuiIOS`).
struct WebShellView: UIViewRepresentable {
    @EnvironmentObject private var shell: WebShell

    func makeUIView(context: Context) -> WKWebView { shell.makeWebView() }
    func updateUIView(_ view: WKWebView, context: Context) {}
}

/// Serves the bundled page from `suisuiapp://app/…`: a stable origin, so the page's own storage (the
/// wallpaper photo) persists and canvas exports are not blocked as cross-origin.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "suisuiapp"
    static let start = URL(string: "\(scheme)://app/index.html")!
    private let root: URL

    init(root: URL) { self.root = root.standardizedFileURL }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        let path = url.path.isEmpty || url.path == "/" ? "index.html" : String(url.path.dropFirst())
        let file = root.appendingPathComponent(path).standardizedFileURL
        guard file.path.hasPrefix(root.path), let data = try? Data(contentsOf: file) else {
            task.didFailWithError(URLError(.fileDoesNotExist)); return
        }
        let headers = ["Content-Type": Self.mime(file.pathExtension), "Content-Length": String(data.count), "Cache-Control": "no-cache"]
        task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    static func mime(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "webmanifest": return "application/json"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "woff2": return "font/woff2"
        default: return "application/octet-stream"
        }
    }
}

@MainActor
final class WebShell: NSObject, ObservableObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private weak var webView: WKWebView?
    private var observer: NSObjectProtocol?
    private var status: [String: Any] = [:]
    private var lastPushed = ""

    /// The Live Activity is the iPhone lock-screen feature, so it starts switched on (like the Android lock view).
    private var liveWanted: Bool {
        get { UserDefaults.standard.object(forKey: "liveActivity") as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: "liveActivity") }
    }

    override init() {
        super.init()
        observer = NotificationCenter.default.addObserver(forName: TodoRepository.didChange, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.pushData() }
        }
    }

    func makeWebView() -> WKWebView {
        let config = WKWebViewConfiguration()
        let root = Bundle.main.url(forResource: "app", withExtension: nil) ?? Bundle.main.bundleURL
        config.setURLSchemeHandler(BundleSchemeHandler(root: root), forURLScheme: BundleSchemeHandler.scheme)
        config.userContentController.add(WeakHandler(self), name: "suisui")
        config.allowsInlineMediaPlayback = true
        config.websiteDataStore = .default()
        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = false
        view.backgroundColor = .systemBackground
        view.scrollView.backgroundColor = .systemBackground
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.scrollView.bounces = false
        view.allowsBackForwardNavigationGestures = true
        view.navigationDelegate = self
        view.uiDelegate = self
        view.isInspectable = true
        webView = view
        installBridge()
        view.load(URLRequest(url: BundleSchemeHandler.start))
        return view
    }

    // MARK: Bridge (same names and behaviour as SuiSuiAndroid in MainActivity.kt)

    /// Injected before the page's own scripts on every load, carrying the stored record.
    private func installBridge() {
        guard let controller = webView?.configuration.userContentController else { return }
        controller.removeAllUserScripts()
        let data = TodoRepository.rawString()
        lastPushed = data
        let source = """
        (() => {
          let data = \(Self.jsString(data));
          const revOf = s => { try { return Number(JSON.parse(s).rev) || 0; } catch { return 0; } };
          const post = (m, a) => { try { window.webkit.messageHandlers.suisui.postMessage({ m, a }); } catch {} };
          window.SuiSuiIOS = {
            status: \(Self.jsonText(status)),
            load: () => data,
            save(json) {
              const stored = revOf(data);
              if (data && stored > 0 && revOf(json) <= stored) return false;
              data = json; post('save', json); return true;
            },
            setTimer: json => post('setTimer', json || ''),
            haptic: kind => post('haptic', kind || ''),
            saveImage: (base64, name) => post('saveImage', { base64, name }),
            exportBackup: (json, name) => post('exportBackup', { json, name }),
            liveActivity: on => post('liveActivity', !!on),
            requestNotifications: () => post('requestNotifications', true),
            _set(json) { data = json; },
            _status(s) { this.status = s; }
          };
          addEventListener('DOMContentLoaded', () => post('ready', true));
        })();
        """
        controller.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    nonisolated func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let name = body["m"] as? String else { return }
        let arg = body["a"]
        Task { @MainActor in self.handle(name, arg) }
    }

    private func handle(_ name: String, _ arg: Any?) {
        switch name {
        case "save":
            guard let json = arg as? String else { return }
            saveFromPage(json)
        case "setTimer":
            let json = arg as? String ?? ""
            if !json.isEmpty { Task { await Reminders.requestIfNeeded(); await refreshStatus() } }
            Reminders.setTimer(json: json)
        case "haptic":
            if arg as? String == "done" { UINotificationFeedbackGenerator().notificationOccurred(.success) }
            else { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
        case "saveImage":
            guard let o = arg as? [String: Any], let b64 = o["base64"] as? String,
                  let data = Data(base64Encoded: b64), let image = UIImage(data: data) else { callback("suisuiImageSaved", false); return }
            saveImage(image)
        case "exportBackup":
            guard let o = arg as? [String: Any], let json = o["json"] as? String else { return }
            share(json: json, name: (o["name"] as? String) ?? "suisui-backup.json")
        case "liveActivity":
            liveWanted = arg as? Bool ?? false
            Task {
                if liveWanted { try? await LiveActivityController.start(TodoRepository.read()) } else { await LiveActivityController.end() }
                await refreshStatus()
            }
        case "requestNotifications":
            Task {
                if await Reminders.status() == "denied" {
                    if let url = URL(string: UIApplication.openSettingsURLString) { _ = await UIApplication.shared.open(url) }
                } else { await Reminders.requestIfNeeded() }
                await refreshStatus()
            }
        case "ready":
            Task { await refreshStatus() }
        default: break
        }
    }

    private func saveFromPage(_ json: String) {
        let result = TodoRepository.writeFromPage(Data(json.utf8))
        guard result.accepted else { pushData(force: true); return }
        lastPushed = json
        TodoRepository.reloadWidgets()
        if let doc = result.doc { Task { await LiveActivityController.update(doc) } }
        if Reminders.schedule() { Task { await Reminders.requestIfNeeded(); await refreshStatus() } }
    }

    /// Hands the stored record to the page; it takes it unless the user is in the middle of something.
    func pushData(force: Bool = false) {
        let raw = TodoRepository.rawString()
        guard force || raw != lastPushed, !raw.isEmpty else { return }
        lastPushed = raw
        webView?.evaluateJavaScript("window.SuiSuiIOS&&SuiSuiIOS._set(\(Self.jsString(raw)));window.suisuiNativeChanged&&suisuiNativeChanged();")
        installBridge()
    }

    private func refreshStatus() async {
        status = [
            "live": LiveActivityController.isRunning,
            "liveAllowed": LiveActivityController.isAvailable,
            "liveWanted": liveWanted,
            "notifications": await Reminders.status()
        ]
        _ = try? await webView?.evaluateJavaScript("window.SuiSuiIOS&&SuiSuiIOS._status(\(Self.jsonText(status)));window.suisuiIOSStatus&&suisuiIOSStatus();")
    }

    // MARK: Lifecycle

    /// Picks up Lock Screen taps (the page applies the new-day rules itself) and renews the Live Activity (8-hour limit).
    func becameActive() {
        let doc = TodoRepository.read()
        pushData()
        Reminders.schedule()
        TodoRepository.reloadWidgets()
        Task {
            if liveWanted, LiveActivityController.isAvailable, !LiveActivityController.isRunning, !TodoLogic.pending(doc.tasks).isEmpty {
                try? await LiveActivityController.start(doc)
            } else {
                await LiveActivityController.update(doc)
            }
            await refreshStatus()
        }
    }

    // MARK: Files and images

    private func saveImage(_ image: UIImage) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { state in
            guard state == .authorized || state == .limited else {
                Task { @MainActor in self.callback("suisuiImageSaved", false) }
                return
            }
            PHPhotoLibrary.shared().performChanges({ PHAssetChangeRequest.creationRequestForAsset(from: image) }) { ok, _ in
                Task { @MainActor in self.callback("suisuiImageSaved", ok) }
            }
        }
    }

    private func share(json: String, name: String) {
        let safe = name.replacingOccurrences(of: "/", with: "-")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(safe)
        guard (try? Data(json.utf8).write(to: url, options: .atomic)) != nil else { return }
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = webView
        topController()?.present(sheet, animated: true)
    }

    private func topController() -> UIViewController? {
        var top = webView?.window?.rootViewController
        while let next = top?.presentedViewController { top = next }
        return top
    }

    private func callback(_ function: String, _ value: Bool) {
        webView?.evaluateJavaScript("window.\(function)&&\(function)(\(value));")
    }

    // MARK: Navigation: in-app pages stay here, web links open in Safari

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = action.request.url else { return .cancel }
        if ["suisuiapp", "about", "blob", "data"].contains(url.scheme ?? "") { return .allow }
        _ = await UIApplication.shared.open(url)
        return .cancel
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        installBridge() // a reload or another in-app page gets the current data
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url {
            if url.scheme == BundleSchemeHandler.scheme { webView.load(URLRequest(url: url)) } else { UIApplication.shared.open(url) }
        }
        return nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        installBridge()
        webView.reload()
    }

    // MARK: Helpers

    static func jsString(_ text: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [text]), let array = String(data: data, encoding: .utf8) else { return "''" }
        return String(array.dropFirst().dropLast()) // a JSON string literal is a valid JavaScript string literal
    }

    static func jsonText(_ object: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: object), let text = String(data: data, encoding: .utf8) else { return "{}" }
        return text
    }
}

/// WKUserContentController keeps its handlers strongly; this avoids a retain cycle with the shell.
private final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}
