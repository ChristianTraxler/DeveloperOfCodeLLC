// DOC Admin: native macOS app around the Developer of Code admin hub.
// A sidebar lists each tool (Hub, Tracker, Outlay, Marketing, Mail, SEO Review, Demos, Content Queue,
// Pricing Desk, Relay Solo). Each tool
// keeps its own WebKit view so state survives switching. Logins persist between launches.
// Set DOC_ADMIN_BASE (e.g. http://localhost:5173) to point the app at a dev server.

import AppKit
import WebKit
import UniformTypeIdentifiers
import Security
import LocalAuthentication

let baseURL = URL(string: ProcessInfo.processInfo.environment["DOC_ADMIN_BASE"] ?? "https://developerofcode.com")!

// `path` is relative to baseURL, or a full URL for a tool hosted elsewhere. `sso` names the app in
// api/admin-sso.mjs when the tool signs in with a ticket from the hub session.
struct Tool {
    let name: String; let path: String; let symbol: String; var sso: String? = nil
    var url: URL { URL(string: path, relativeTo: baseURL)!.absoluteURL }
}
// Hub stays first; the rest are listed A to Z.
let tools = [Tool(name: "Hub", path: "/admin/", symbol: "square.grid.2x2")] + [
    Tool(name: "Tracker", path: "/admin/tracker/", symbol: "checklist"),
    Tool(name: "Outlay", path: "/admin/outlay/", symbol: "creditcard"),
    Tool(name: "Marketing", path: "/admin/marketing/", symbol: "megaphone"),
    Tool(name: "Mail", path: "/admin/mail/", symbol: "envelope"),
    Tool(name: "SEO Review", path: "/admin/seo/", symbol: "magnifyingglass"),
    Tool(name: "Demos", path: "/admin/demos/", symbol: "play.rectangle"),
    Tool(name: "Content Queue", path: "/admin/content-queue/", symbol: "calendar.badge.clock"),
    Tool(name: "Pricing Desk", path: "/admin/pricing-desk/", symbol: "tag", sso: "pricing-desk"),
    Tool(name: "Relay Solo", path: "https://relay-solo.vercel.app/", symbol: "paperplane"),
].sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }


// MARK: saved logins (macOS Keychain, readable only by this app)
enum Vault {
    static let server = baseURL.host ?? "developerofcode.com"
    static func base() -> [String: Any] {
        [kSecClass as String: kSecClassInternetPassword, kSecAttrServer as String: server]
    }
    static func users() -> [String] {
        var q = base()
        q[kSecReturnAttributes as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitAll
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess,
              let rows = out as? [[String: Any]] else { return [] }
        return rows.compactMap { $0[kSecAttrAccount as String] as? String }.sorted()
    }
    static func password(for user: String) -> String? {
        var q = base()
        q[kSecAttrAccount as String] = user
        q[kSecReturnData as String] = true
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }
    static func save(user: String, password: String) {
        var q = base()
        q[kSecAttrAccount as String] = user
        let data = Data(password.utf8)
        if SecItemUpdate(q as CFDictionary, [kSecValueData as String: data] as CFDictionary) == errSecItemNotFound {
            q[kSecValueData as String] = data
            SecItemAdd(q as CFDictionary, nil)
        }
    }
    static func forget(_ user: String) {
        var q = base(); q[kSecAttrAccount as String] = user
        SecItemDelete(q as CFDictionary)
    }
}

let keepAliveJS = #"""
if (location.pathname.startsWith('/admin/mail')) {
  for (const k of ['hidden', 'webkitHidden']) Object.defineProperty(document, k, { get: () => false, configurable: true });
  for (const k of ['visibilityState', 'webkitVisibilityState']) Object.defineProperty(document, k, { get: () => 'visible', configurable: true });
}
"""#

// Injected into every page. Reports focus on login fields and form submits; fills on request.
let autofillJS = #"""
(function () {
  if (window.__docAF) return; window.__docAF = true;
  const post = m => { try { window.webkit.messageHandlers.docLogin.postMessage(m); } catch (e) {} };
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const pwField = () => [...document.querySelectorAll('input[type=password]')].find(vis);
  const userField = pw => {
    const all = [...document.querySelectorAll('input')].filter(e => vis(e) && /^(text|email|)$/.test(e.type || ''));
    if (!pw) return all.find(e => /user|email|login/i.test((e.name||'')+(e.id||'')+(e.getAttribute('autocomplete')||'')));
    const before = all.filter(e => e.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING);
    return before[before.length - 1];
  };
  const isLogin = t => t && t.tagName === 'INPUT' &&
    (t.type === 'password' || (pwField() && t === userField(pwField())) ||
     (/^(text|email|)$/.test(t.type || '') && /user|email|login/i.test((t.name||'')+(t.id||'')+(t.getAttribute('autocomplete')||''))));
  document.addEventListener('focusin', e => {
    if (!isLogin(e.target)) return;
    const r = e.target.getBoundingClientRect();
    post({ type: 'focus', x: r.left, y: r.bottom, w: r.width });
  }, true);
  let last = 0;
  const report = () => {
    const pw = pwField(); if (!pw || !pw.value || Date.now() - last < 1500) return;
    const u = userField(pw); last = Date.now();
    post({ type: 'submit', user: u ? u.value : '', pass: pw.value });
  };
  document.addEventListener('submit', report, true);
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button, input[type=submit]');
    if (b && pwField() && pwField().value) report();
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') report(); }, true);
  const setVal = (el, v) => {
    const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    d.set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  window.__docFill = (u, p) => {
    const pw = pwField(), us = userField(pw);
    if (us) setVal(us, u);
    if (pw) setVal(pw, p);
  };
})();
"""#

final class Controller: NSObject, NSTableViewDataSource, NSTableViewDelegate,
                        WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler {
    let window: NSWindow
    let table = NSTableView()
    let container = NSView()
    let spinner = NSProgressIndicator()
    let config = WKWebViewConfiguration()
    var views: [Int: WKWebView] = [:]
    var current = 0
    var downloadTargets: [ObjectIdentifier: URL] = [:]
    var titleObservers: [NSKeyValueObservation] = []
    let mailIndex = tools.firstIndex { $0.name == "Mail" } ?? 4
    var mailUnread = 0 { didSet { badgeChanged() } }

    override init() {
        config.websiteDataStore = .default()
        config.preferences.isElementFullscreenEnabled = true
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
                          backing: .buffered, defer: false)
        super.init()
        window.title = "DOC Admin"
        window.titleVisibility = .hidden
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

        config.userContentController.addUserScript(
            WKUserScript(source: autofillJS, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        config.userContentController.add(self, name: "docLogin")
        // Keep the Mail page polling when the window is minimized or the app is hidden.
        config.userContentController.addUserScript(WKUserScript(source: keepAliveJS, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        container.wantsLayer = true
        container.layer?.backgroundColor = NSColor(red: 0.024, green: 0.039, blue: 0.075, alpha: 1).cgColor

        table.reloadData()
        select(0)
        // Load Mail in the background so the unread badge works from launch.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [self] in
            if views[mailIndex] == nil { _ = makeView(mailIndex, background: true) }
        }
    }

    // MARK: unread badge
    // The Mail page puts its inbox unread count in its title as "(3) Mail".
    func titleChanged(_ title: String?) {
        var n = 0
        if let t = title, t.hasPrefix("("), let close = t.firstIndex(of: ")") {
            n = Int(t[t.index(after: t.startIndex)..<close]) ?? 0
        }
        if n != mailUnread { mailUnread = n }
    }
    func badgeChanged() {
        NSApp.dockTile.badgeLabel = mailUnread > 0 ? String(mailUnread) : nil
        table.reloadData(forRowIndexes: IndexSet(integer: mailIndex), columnIndexes: IndexSet(integer: 0))
        table.selectRowIndexes(IndexSet(integer: current), byExtendingSelection: false)
    }

    // MARK: saved-login picker
    var pickerWeb: WKWebView?
    func userContentController(_ uc: WKUserContentController, didReceive m: WKScriptMessage) {
        guard m.frameInfo.isMainFrame, isTrusted(m.frameInfo.securityOrigin),
              let web = m.webView, let body = m.body as? [String: Any],
              let type = body["type"] as? String else { return }
        if type == "focus" {
            let z = web.pageZoom
            let x = (body["x"] as? Double ?? 0) * z, y = (body["y"] as? Double ?? 0) * z
            showPicker(in: web, at: NSPoint(x: x, y: y + 4))
        } else if type == "submit" {
            offerToSave(user: (body["user"] as? String) ?? "", pass: (body["pass"] as? String) ?? "")
        }
    }

    func showPicker(in web: WKWebView, at p: NSPoint) {
        let users = Vault.users()
        pickerWeb = web
        let menu = NSMenu()
        let head = NSMenuItem(title: "Saved logins for \(Vault.server)", action: nil, keyEquivalent: "")
        head.isEnabled = false
        menu.addItem(head)
        for u in users {
            let it = NSMenuItem(title: u, action: #selector(pickLogin(_:)), keyEquivalent: "")
            it.target = self; it.representedObject = u
            it.image = NSImage(systemSymbolName: "key.fill", accessibilityDescription: nil)
            menu.addItem(it)
        }
        if users.isEmpty { head.title = "No saved logins yet" }
        menu.addItem(.separator())
        let add = NSMenuItem(title: "Add a Login\u{2026}", action: #selector(addLogin), keyEquivalent: "")
        add.target = self
        add.image = NSImage(systemSymbolName: "plus.circle", accessibilityDescription: nil)
        menu.addItem(add)
        if !users.isEmpty {
            let forget = NSMenuItem(title: "Forget a Login", action: nil, keyEquivalent: "")
            let sub = NSMenu()
            for u in users {
                let it = NSMenuItem(title: u, action: #selector(forgetLogin(_:)), keyEquivalent: "")
                it.target = self; it.representedObject = u
                sub.addItem(it)
            }
            forget.submenu = sub
            menu.addItem(forget)
        }
        // Pop up after the focus event finishes so the field keeps focus afterward.
        DispatchQueue.main.async { menu.popUp(positioning: nil, at: p, in: web) }
    }

    @objc func pickLogin(_ s: NSMenuItem) {
        guard let user = s.representedObject as? String, let web = pickerWeb else { return }
        let ctx = LAContext()
        ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Fill the saved login for \(user)") { ok, _ in
            guard ok, let pass = Vault.password(for: user) else { return }
            func lit(_ v: String) -> String {
                (try? String(data: JSONEncoder().encode([v]), encoding: .utf8)).flatMap { $0 }
                    .map { String($0.dropFirst().dropLast()) } ?? "\"\""
            }
            DispatchQueue.main.async {
                web.evaluateJavaScript("window.__docFill(\(lit(user)), \(lit(pass)))", completionHandler: nil)
            }
        }
    }
    @objc func addLogin() {
        let a = NSAlert()
        a.messageText = "Add a login for \(Vault.server)"
        a.informativeText = "Saved in your macOS Keychain. Only DOC Admin can use it."
        let user = NSTextField(frame: NSRect(x: 0, y: 32, width: 280, height: 24))
        user.placeholderString = "Email"
        let pass = NSSecureTextField(frame: NSRect(x: 0, y: 0, width: 280, height: 24))
        pass.placeholderString = "Password"
        let box = NSView(frame: NSRect(x: 0, y: 0, width: 280, height: 58))
        box.addSubview(user); box.addSubview(pass)
        a.accessoryView = box
        a.addButton(withTitle: "Save"); a.addButton(withTitle: "Cancel")
        a.window.initialFirstResponder = user
        if a.runModal() == .alertFirstButtonReturn, !user.stringValue.isEmpty, !pass.stringValue.isEmpty {
            Vault.save(user: user.stringValue, password: pass.stringValue)
        }
    }
    @objc func forgetLogin(_ s: NSMenuItem) {
        guard let user = s.representedObject as? String else { return }
        let a = NSAlert()
        a.messageText = "Forget the saved login for \(user)?"
        a.addButton(withTitle: "Forget"); a.addButton(withTitle: "Cancel")
        if a.runModal() == .alertFirstButtonReturn { Vault.forget(user) }
    }
    func offerToSave(user: String, pass: String) {
        guard !user.isEmpty, !pass.isEmpty, Vault.password(for: user) != pass else { return }
        let a = NSAlert()
        a.messageText = Vault.users().contains(user) ? "Update the saved password for \(user)?" : "Save this login for \(Vault.server)?"
        a.informativeText = "It is stored in your macOS Keychain and is only used by DOC Admin."
        a.addButton(withTitle: "Save"); a.addButton(withTitle: "Not Now")
        if a.runModal() == .alertFirstButtonReturn { Vault.save(user: user, password: pass) }
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
        if row == mailIndex && mailUnread > 0 {
            let pill = NSView()
            pill.wantsLayer = true
            pill.layer?.backgroundColor = NSColor.systemRed.cgColor
            pill.layer?.cornerRadius = 9
            let num = NSTextField(labelWithString: mailUnread > 99 ? "99+" : String(mailUnread))
            num.font = .systemFont(ofSize: 11, weight: .semibold)
            num.textColor = .white
            for v in [pill, num] { v.translatesAutoresizingMaskIntoConstraints = false }
            pill.addSubview(num)
            cell.addSubview(pill)
            NSLayoutConstraint.activate([
                num.centerXAnchor.constraint(equalTo: pill.centerXAnchor),
                num.centerYAnchor.constraint(equalTo: pill.centerYAnchor),
                pill.trailingAnchor.constraint(equalTo: cell.trailingAnchor, constant: -8),
                pill.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
                pill.heightAnchor.constraint(equalToConstant: 18),
                pill.widthAnchor.constraint(greaterThanOrEqualToConstant: 18),
                pill.widthAnchor.constraint(greaterThanOrEqualTo: num.widthAnchor, constant: 10),
            ])
        }
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
        let web = views[i] ?? makeView(i)
        // Views stay "visible" to WebKit (so Mail keeps polling); the chosen one is stacked on top.
        container.addSubview(web, positioned: .above, relativeTo: nil)
        window.title = "DOC Admin: \(tools[i].name)"
        window.makeFirstResponder(web)
    }

    func makeView(_ i: Int, background: Bool = false, url: URL? = nil) -> WKWebView {
        let web = WKWebView(frame: container.bounds, configuration: config)
        web.autoresizingMask = [.width, .height]
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.allowsMagnification = true
        web.setValue(false, forKey: "drawsBackground")
        container.addSubview(web, positioned: background ? .below : .above, relativeTo: nil)
        views[i] = web
        if i == mailIndex {
            titleObservers.append(web.observe(\.title, options: [.new]) { [weak self] w, _ in
                DispatchQueue.main.async { self?.titleChanged(w.title) }
            })
        }
        if let url = url { web.load(URLRequest(url: url)) }
        else if let app = tools[i].sso { signIn(web, i, app: app) }
        else { web.load(URLRequest(url: tools[i].url)) }
        return web
    }

    // Same as the hub card: trade the hub's Supabase session for a short-lived ticket
    // (api/admin-sso.mjs). Runs in the Hub view, which shares storage with the admin pages.
    // Falls back to the tool's plain address, where it can sign in by itself.
    func signIn(_ web: WKWebView, _ i: Int, app: String) {
        let js = """
            const k = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
            const t = k && JSON.parse(localStorage.getItem(k) || 'null')?.access_token;
            if (!t) return null;
            const r = await fetch('/api/admin-sso?app=' + encodeURIComponent(app), { headers: { Authorization: 'Bearer ' + t } });
            return r.ok ? (await r.json()).url : null;
            """
        guard let hub = views[0], web !== hub, isInternal(hub.url) else { web.load(URLRequest(url: tools[i].url)); return }
        hub.callAsyncJavaScript(js, arguments: ["app": app], in: nil, in: .page) { res in
            var dest = tools[i].url
            if case .success(let v) = res, let s = v as? String,
               let u = URL(string: s, relativeTo: baseURL)?.absoluteURL, self.isInternal(u) { dest = u }
            web.load(URLRequest(url: dest))
        }
    }

    // Switch the sidebar to tool t, showing `u` in its view when it's not just the tool's start page.
    func open(_ t: Int, at u: URL) {
        let atHome = u.absoluteString == tools[t].url.absoluteString
        if views[t] == nil { _ = makeView(t, url: atHome ? nil : u) }
        else if !atHome { views[t]!.load(URLRequest(url: u)) }
        select(t)
    }

    var web: WKWebView? { views[current] }

    // MARK: actions
    @objc func goTool(_ s: NSMenuItem) { select(s.tag) }
    @objc func reload() { web?.reloadFromOrigin() }
    @objc func back() { web?.goBack() }
    @objc func forward() { web?.goForward() }
    @objc func home() {
        web?.load(URLRequest(url: tools[current].url))
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
    func port(_ scheme: String?, _ p: Int?) -> Int { p ?? (scheme == "http" ? 80 : 443) }
    // Full origin match (scheme, host, port). Nothing else counts as the admin hub.
    func isInternal(_ url: URL?) -> Bool {
        guard let u = url, let host = u.host else { return false }
        return u.scheme == baseURL.scheme && host == baseURL.host
            && port(u.scheme, u.port) == port(baseURL.scheme, baseURL.port)
    }
    func isTrusted(_ o: WKSecurityOrigin) -> Bool {
        o.protocol == baseURL.scheme && o.host == baseURL.host
            && port(o.protocol, o.port == 0 ? nil : o.port) == port(baseURL.scheme, baseURL.port)
    }
    // Only these schemes may be handed to the system, and only from a user click.
    func openExternally(_ u: URL) {
        guard let s = u.scheme?.lowercased(), ["http", "https", "mailto", "tel"].contains(s) else { return }
        NSWorkspace.shared.open(u)
    }
    func webView(_ w: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.shouldPerformDownload { decisionHandler(.download); return }
        let u = action.request.url
        let isMain = action.targetFrame?.isMainFrame ?? true
        let from = views.first(where: { $0.value === w })?.key
        // A link or script navigation to another tool (e.g. a Hub card) switches the sidebar to that
        // tool's own view. Back/forward and reloads stay where they are. A page from another site
        // (Relay Solo) may only do this with a real link click, never by script or form.
        let trusted: [WKNavigationType] = isInternal(w.url) ? [.linkActivated, .other, .formSubmitted] : [.linkActivated]
        if isMain, let u = u, let from = from, let t = toolIndex(for: u), t != from,
           trusted.contains(action.navigationType) {
            decisionHandler(.cancel)
            open(t, at: u)
            return
        }
        // A tool hosted elsewhere may move around its own site inside its view.
        let ownSite = from.map { u?.host != nil && u?.host == tools[$0].url.host } ?? false
        if isMain, u?.scheme != "about", !isInternal(u), !ownSite {
            // The window never leaves the admin hub. Off-site links open in the browser on a click.
            if action.navigationType == .linkActivated, let u = u { openExternally(u) }
            decisionHandler(.cancel); return
        }
        decisionHandler(.allow)
    }
    // The tool a URL belongs to. Tools hosted elsewhere match by host; admin tools by the longest
    // path prefix, except Hub, which only matches itself.
    func toolIndex(for u: URL) -> Int? {
        let p = u.path.hasSuffix("/") ? u.path : u.path + "/"
        var best: Int?
        for (i, t) in tools.enumerated() {
            let home = t.url
            let match: Bool
            if home.host != baseURL.host { match = u.scheme == "https" && u.host == home.host }
            else if !isInternal(u) { match = false }
            else if i == 0 { match = p == t.path || u.path == "/admin/index.html" }
            else { match = p.hasPrefix(t.path) }
            if match, best == nil || t.path.count > tools[best!].path.count { best = i }
        }
        return best
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
        if isInternal(u) { w.load(a.request) }
        else if a.navigationType == .linkActivated { openExternally(u) }
        return nil
    }

    // MARK: JS dialogs, file pickers, permissions
    func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo,
                 completionHandler ch: @escaping () -> Void) {
        guard isTrusted(f.securityOrigin) else { ch(); return }
        let a = NSAlert(); a.messageText = m; a.runModal(); ch()
    }
    func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo,
                 completionHandler ch: @escaping (Bool) -> Void) {
        guard isTrusted(f.securityOrigin) else { ch(false); return }
        let a = NSAlert(); a.messageText = m
        a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
        ch(a.runModal() == .alertFirstButtonReturn)
    }
    func webView(_ w: WKWebView, runJavaScriptTextInputPanelWithPrompt p: String, defaultText d: String?,
                 initiatedByFrame f: WKFrameInfo, completionHandler ch: @escaping (String?) -> Void) {
        guard isTrusted(f.securityOrigin) else { ch(nil); return }
        let a = NSAlert(); a.messageText = p
        a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24))
        field.stringValue = d ?? ""
        a.accessoryView = field
        ch(a.runModal() == .alertFirstButtonReturn ? field.stringValue : nil)
    }
    func webView(_ w: WKWebView, runOpenPanelWith p: WKOpenPanelParameters, initiatedByFrame f: WKFrameInfo,
                 completionHandler ch: @escaping ([URL]?) -> Void) {
        guard isTrusted(f.securityOrigin) else { ch(nil); return }
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = p.allowsMultipleSelection
        panel.canChooseDirectories = p.allowsDirectories
        panel.begin { ch($0 == .OK ? panel.urls : nil) }
    }
    func webView(_ w: WKWebView, requestMediaCapturePermissionFor o: WKSecurityOrigin, initiatedByFrame f: WKFrameInfo,
                 type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(isTrusted(o) ? .prompt : .deny)
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
