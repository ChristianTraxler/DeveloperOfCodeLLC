// DOC Admin: native macOS app around the Developer of Code admin hub.
// A sidebar lists each tool (Hub, Tracker, Outlay, Marketing, Mail, Demos). Each tool
// keeps its own WebKit view so state survives switching. Logins persist between launches.
// Set DOC_ADMIN_BASE (e.g. http://localhost:5173) to point the app at a dev server.

import AppKit
import WebKit
import UniformTypeIdentifiers

let baseURL = URL(string: ProcessInfo.processInfo.environment["DOC_ADMIN_BASE"] ?? "https://developerofcode.com")!

struct Tool { let name: String; let path: String; let symbol: String }
let tools = [
    Tool(name: "Hub", path: "/admin/", symbol: "square.grid.2x2"),
    Tool(name: "Tracker", path: "/admin/tracker/", symbol: "checklist"),
    Tool(name: "Outlay", path: "/admin/outlay/", symbol: "creditcard"),
    Tool(name: "Marketing", path: "/admin/marketing/", symbol: "megaphone"),
    Tool(name: "Mail", path: "/admin/mail/", symbol: "envelope"),
    Tool(name: "Demos", path: "/admin/demos/", symbol: "play.rectangle"),
]

final class Controller: NSObject, NSTableViewDataSource, NSTableViewDelegate,
                        WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    let window: NSWindow
    let table = NSTableView()
    let container = NSView()
    let spinner = NSProgressIndicator()
    let config = WKWebViewConfiguration()
    var views: [Int: WKWebView] = [:]
    var current = 0
    var downloadTargets: [ObjectIdentifier: URL] = [:]

    override init() {
        config.websiteDataStore = .default()
        config.preferences.isElementFullscreenEnabled = true
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
                          backing: .buffered, defer: false)
        super.init()
        window.title = "DOC Admin"
        window.minSize = NSSize(width: 760, height: 520)
        window.isReleasedWhenClosed = false
        window.titlebarAppearsTransparent = true
        window.backgroundColor = NSColor(red: 0.024, green: 0.039, blue: 0.075, alpha: 1)
        window.appearance = NSAppearance(named: .darkAqua)

        let col = NSTableColumn(identifier: .init("tool"))
        table.addTableColumn(col)
        table.headerView = nil
        table.style = .sourceList
        table.rowHeight = 32
        table.dataSource = self
        table.delegate = self
        let scroll = NSScrollView()
        scroll.documentView = table
        scroll.drawsBackground = false
        scroll.hasVerticalScroller = false

        let side = NSVisualEffectView()
        side.material = .sidebar
        side.blendingMode = .behindWindow
        scroll.translatesAutoresizingMaskIntoConstraints = false
        side.addSubview(scroll)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: side.topAnchor, constant: 44),
            scroll.bottomAnchor.constraint(equalTo: side.bottomAnchor),
            scroll.leadingAnchor.constraint(equalTo: side.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: side.trailingAnchor),
        ])

        spinner.style = .spinning
        spinner.controlSize = .small
        spinner.isDisplayedWhenStopped = false
        spinner.translatesAutoresizingMaskIntoConstraints = false
        side.addSubview(spinner)
        NSLayoutConstraint.activate([
            spinner.leadingAnchor.constraint(equalTo: side.leadingAnchor, constant: 16),
            spinner.bottomAnchor.constraint(equalTo: side.bottomAnchor, constant: -14),
        ])

        let sideVC = NSViewController(); sideVC.view = side
        let mainVC = NSViewController(); mainVC.view = container
        let split = NSSplitViewController()
        let sideItem = NSSplitViewItem(sidebarWithViewController: sideVC)
        sideItem.minimumThickness = 160
        sideItem.maximumThickness = 220
        split.addSplitViewItem(sideItem)
        split.addSplitViewItem(NSSplitViewItem(viewController: mainVC))
        window.contentViewController = split
        window.setFrameAutosaveName("DOCAdminMain")
        if !window.setFrameUsingName("DOCAdminMain") { window.center() }

        table.reloadData()
        select(0)
    }

    // MARK: sidebar
    func numberOfRows(in tableView: NSTableView) -> Int { tools.count }
    func tableView(_ tv: NSTableView, viewFor col: NSTableColumn?, row: Int) -> NSView? {
        let t = tools[row]
        let cell = NSTableCellView()
        let icon = NSImageView(image: NSImage(systemSymbolName: t.symbol, accessibilityDescription: t.name) ?? NSImage())
        let label = NSTextField(labelWithString: t.name)
        label.font = .systemFont(ofSize: 13, weight: .medium)
        for v in [icon, label] { v.translatesAutoresizingMaskIntoConstraints = false; cell.addSubview(v) }
        NSLayoutConstraint.activate([
            icon.leadingAnchor.constraint(equalTo: cell.leadingAnchor, constant: 6),
            icon.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 18),
            label.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 8),
            label.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
        ])
        return cell
    }
    func tableViewSelectionDidChange(_ n: Notification) {
        let r = table.selectedRow
        if r >= 0 && r != current || views[r] == nil && r >= 0 { show(r) }
    }

    func select(_ i: Int) {
        table.selectRowIndexes(IndexSet(integer: i), byExtendingSelection: false)
        show(i)
    }

    func show(_ i: Int) {
        current = i
        container.subviews.forEach { $0.isHidden = true }
        let web = views[i] ?? makeView(i)
        web.isHidden = false
        window.title = "DOC Admin: \(tools[i].name)"
        window.makeFirstResponder(web)
    }

    func makeView(_ i: Int) -> WKWebView {
        let web = WKWebView(frame: container.bounds, configuration: config)
        web.autoresizingMask = [.width, .height]
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.allowsMagnification = true
        web.setValue(false, forKey: "drawsBackground")
        container.addSubview(web)
        views[i] = web
        web.load(URLRequest(url: URL(string: tools[i].path, relativeTo: baseURL)!.absoluteURL))
        return web
    }

    var web: WKWebView? { views[current] }

    // MARK: actions
    @objc func goTool(_ s: NSMenuItem) { select(s.tag) }
    @objc func reload() { web?.reloadFromOrigin() }
    @objc func back() { web?.goBack() }
    @objc func forward() { web?.goForward() }
    @objc func home() {
        web?.load(URLRequest(url: URL(string: tools[current].path, relativeTo: baseURL)!.absoluteURL))
    }
    @objc func zoomIn() { web?.pageZoom += 0.1 }
    @objc func zoomOut() { web?.pageZoom = max(0.5, (web?.pageZoom ?? 1) - 0.1) }
    @objc func zoomReset() { web?.pageZoom = 1 }
    @objc func openInBrowser() { if let u = web?.url { NSWorkspace.shared.open(u) } }
    @objc func signOut() {
        let store = config.websiteDataStore
        store.fetchDataRecords(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes()) { recs in
            store.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), for: recs) {
                DispatchQueue.main.async {
                    self.views.values.forEach { $0.reload() }
                }
            }
        }
    }

    // MARK: navigation
    func isInternal(_ url: URL?) -> Bool {
        guard let u = url else { return true }
        if u.scheme == "about" || u.scheme == "blob" || u.scheme == "data" { return true }
        return u.host == baseURL.host
    }
    func webView(_ w: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.shouldPerformDownload { decisionHandler(.download); return }
        if !isInternal(action.request.url), action.navigationType == .linkActivated || action.targetFrame == nil,
           let u = action.request.url {
            NSWorkspace.shared.open(u)   // mailto:, tel:, other sites
            decisionHandler(.cancel); return
        }
        decisionHandler(.allow)
    }
    func webView(_ w: WKWebView, decidePolicyFor resp: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(resp.canShowMIMEType ? .allow : .download)
    }
    func webView(_ w: WKWebView, didStartProvisionalNavigation n: WKNavigation!) { spinner.startAnimation(nil) }
    func webView(_ w: WKWebView, didFinish n: WKNavigation!) { spinner.stopAnimation(nil) }
    func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { spinner.stopAnimation(nil) }
    func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) {
        spinner.stopAnimation(nil)
        if (e as NSError).code == NSURLErrorCancelled { return }
        let msg = e.localizedDescription.replacingOccurrences(of: "<", with: "&lt;")
        w.loadHTMLString("""
        <body style="background:#060a13;color:#e8ecf4;font:15px -apple-system;display:grid;place-items:center;height:90vh;text-align:center">
        <div><h2>Can't reach the admin hub</h2><p style="opacity:.7">\(msg)</p>
        <p style="opacity:.7">Check your connection, then press Cmd+R.</p></div></body>
        """, baseURL: nil)
    }
    func webViewWebContentProcessDidTerminate(_ w: WKWebView) { w.reload() }

    // target=_blank and window.open: keep admin pages in this view, send the rest out
    func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction,
                 windowFeatures f: WKWindowFeatures) -> WKWebView? {
        guard let u = a.request.url else { return nil }
        if isInternal(u) { w.load(a.request) } else { NSWorkspace.shared.open(u) }
        return nil
    }

    // MARK: JS dialogs, file pickers, permissions
    func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo,
                 completionHandler ch: @escaping () -> Void) {
        let a = NSAlert(); a.messageText = m; a.runModal(); ch()
    }
    func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo,
                 completionHandler ch: @escaping (Bool) -> Void) {
        let a = NSAlert(); a.messageText = m
        a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
        ch(a.runModal() == .alertFirstButtonReturn)
    }
    func webView(_ w: WKWebView, runJavaScriptTextInputPanelWithPrompt p: String, defaultText d: String?,
                 initiatedByFrame f: WKFrameInfo, completionHandler ch: @escaping (String?) -> Void) {
        let a = NSAlert(); a.messageText = p
        a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24))
        field.stringValue = d ?? ""
        a.accessoryView = field
        ch(a.runModal() == .alertFirstButtonReturn ? field.stringValue : nil)
    }
    func webView(_ w: WKWebView, runOpenPanelWith p: WKOpenPanelParameters, initiatedByFrame f: WKFrameInfo,
                 completionHandler ch: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = p.allowsMultipleSelection
        panel.canChooseDirectories = p.allowsDirectories
        panel.begin { ch($0 == .OK ? panel.urls : nil) }
    }
    func webView(_ w: WKWebView, requestMediaCapturePermissionFor o: WKSecurityOrigin, initiatedByFrame f: WKFrameInfo,
                 type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(o.host == baseURL.host ? .prompt : .deny)
    }

    // MARK: downloads
    func webView(_ w: WKWebView, navigationAction a: WKNavigationAction, didBecome d: WKDownload) { d.delegate = self }
    func webView(_ w: WKWebView, navigationResponse r: WKNavigationResponse, didBecome d: WKDownload) { d.delegate = self }
    func download(_ d: WKDownload, decideDestinationUsing r: URLResponse, suggestedFilename name: String,
                  completionHandler ch: @escaping (URL?) -> Void) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = name
        panel.directoryURL = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first
        panel.begin { [self] res in
            guard res == .OK, let url = panel.url else { ch(nil); return }
            try? FileManager.default.removeItem(at: url)
            downloadTargets[ObjectIdentifier(d)] = url
            ch(url)
        }
    }
    func downloadDidFinish(_ d: WKDownload) {
        if let url = downloadTargets.removeValue(forKey: ObjectIdentifier(d)) {
            NSWorkspace.shared.activateFileViewerSelecting([url])
        }
    }
    func download(_ d: WKDownload, didFailWithError e: Error, resumeData: Data?) {
        downloadTargets.removeValue(forKey: ObjectIdentifier(d))
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    var ctl: Controller!

    func applicationDidFinishLaunching(_ n: Notification) {
        ctl = Controller()
        buildMenu()
        ctl.window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { true }
    func applicationShouldHandleReopen(_ s: NSApplication, hasVisibleWindows f: Bool) -> Bool {
        ctl.window.makeKeyAndOrderFront(nil); return true
    }

    func item(_ title: String, _ sel: Selector, _ key: String = "", mods: NSEvent.ModifierFlags = .command,
              target: AnyObject? = nil, tag: Int = 0) -> NSMenuItem {
        let m = NSMenuItem(title: title, action: sel, keyEquivalent: key)
        m.keyEquivalentModifierMask = mods
        m.target = target ?? ctl
        m.tag = tag
        return m
    }
    func submenu(_ title: String, _ items: [NSMenuItem]) -> NSMenuItem {
        let m = NSMenu(title: title); items.forEach(m.addItem)
        let host = NSMenuItem(); host.submenu = m; return host
    }

    func buildMenu() {
        let bar = NSMenu()
        let app = submenu("DOC Admin", [
            item("About DOC Admin", #selector(NSApplication.orderFrontStandardAboutPanel(_:)), target: NSApp),
            .separator(),
            item("Sign Out and Clear Data", #selector(Controller.signOut)),
            .separator(),
            item("Hide DOC Admin", #selector(NSApplication.hide(_:)), "h", target: NSApp),
            item("Quit DOC Admin", #selector(NSApplication.terminate(_:)), "q", target: NSApp),
        ])
        let edit = submenu("Edit", [
            item("Undo", Selector(("undo:")), "z", target: nil),
            item("Redo", Selector(("redo:")), "Z", mods: [.command, .shift], target: nil),
            .separator(),
            item("Cut", #selector(NSText.cut(_:)), "x", target: nil),
            item("Copy", #selector(NSText.copy(_:)), "c", target: nil),
            item("Paste", #selector(NSText.paste(_:)), "v", target: nil),
            item("Select All", #selector(NSText.selectAll(_:)), "a", target: nil),
        ])
        var toolItems = tools.enumerated().map { i, t in
            item(t.name, #selector(Controller.goTool(_:)), "\(i + 1)", tag: i)
        }
        toolItems += [.separator(),
            item("Reload", #selector(Controller.reload), "r"),
            item("Back", #selector(Controller.back), "[") ,
            item("Forward", #selector(Controller.forward), "]"),
            item("Tool Home", #selector(Controller.home), "h", mods: [.command, .shift]),
            .separator(),
            item("Zoom In", #selector(Controller.zoomIn), "="),
            item("Zoom Out", #selector(Controller.zoomOut), "-"),
            item("Actual Size", #selector(Controller.zoomReset), "0"),
            .separator(),
            item("Open in Browser", #selector(Controller.openInBrowser), "o", mods: [.command, .shift]),
        ]
        let go = submenu("Tools", toolItems)
        let win = submenu("Window", [
            item("Minimize", #selector(NSWindow.performMiniaturize(_:)), "m", target: nil),
            item("Zoom", #selector(NSWindow.performZoom(_:)), target: nil),
            item("Enter Full Screen", #selector(NSWindow.toggleFullScreen(_:)), "f", mods: [.command, .control], target: nil),
        ])
        [app, edit, go, win].forEach(bar.addItem)
        NSApp.mainMenu = bar
        NSApp.windowsMenu = win.submenu
    }
}

let nsapp = NSApplication.shared
let delegate = AppDelegate()
nsapp.delegate = delegate
nsapp.setActivationPolicy(.regular)
nsapp.run()
