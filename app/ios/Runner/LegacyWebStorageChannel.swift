import Flutter
import UIKit
import WebKit

/// Hidden-WebView fallback of the Capacitor -> Flutter migration (docs/flutter/LEGACY_STORAGE.md): reads the
/// localStorage the Capacitor WKWebView kept for origin capacitor://app.anacan.az (capacitor.config.json
/// server.hostname, Capacitor's default iOS scheme "capacitor") for users who skipped the 53.0 bridge export.
///
/// Capacitor used WKWebsiteDataStore.default(); a WKWebView of this same app with the default store and a
/// handler for the "capacitor" scheme gets the same origin and therefore the same localStorage. The handler
/// serves an empty local document (no network); navigations elsewhere are cancelled. The Dart side passes the
/// script (it filters the keys by the 53.0 export rules inside the WebView and never writes localStorage).
///
/// Channel "az.anacan/legacy_web_storage": hasLegacyData -> Bool (checked without creating a WebView),
/// read {script, timeoutMs} -> String (the script's string result).
final class LegacyWebStorageChannel: NSObject {
  static let channelName = "az.anacan/legacy_web_storage"
  static let scheme = "capacitor"
  static let host = "app.anacan.az"
  static let origin = URL(string: "capacitor://app.anacan.az/")!
  private static let page = "<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>"

  private let channel: FlutterMethodChannel
  private var webView: WKWebView?
  private var pending: FlutterResult?
  private var script = ""
  private var generation = 0

  init(messenger: FlutterBinaryMessenger) {
    channel = FlutterMethodChannel(name: LegacyWebStorageChannel.channelName, binaryMessenger: messenger)
    super.init()
    channel.setMethodCallHandler { [weak self] call, result in
      guard let self else {
        result(FlutterError(code: "UNAVAILABLE", message: nil, details: nil))
        return
      }
      self.handle(call, result)
    }
  }

  private func handle(_ call: FlutterMethodCall, _ result: @escaping FlutterResult) {
    switch call.method {
    case "hasLegacyData":
      result(LegacyWebStorageChannel.hasLegacyData())
    case "read":
      guard let args = call.arguments as? [String: Any], let script = args["script"] as? String else {
        result(FlutterError(code: "INVALID", message: "script", details: nil))
        return
      }
      let timeoutMs = (args["timeoutMs"] as? NSNumber)?.intValue ?? 6000
      read(script: script, timeoutMs: timeoutMs, result: result)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  /// True when WebKit website data exists in this app's container (a fresh install has none).
  static func hasLegacyData() -> Bool {
    guard let library = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first else {
      return false
    }
    var isDirectory: ObjCBool = false
    let path = library.appendingPathComponent("WebKit", isDirectory: true).path
    return FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory) && isDirectory.boolValue
  }

  private func read(script: String, timeoutMs: Int, result: @escaping FlutterResult) {
    guard pending == nil else {
      result(FlutterError(code: "BUSY", message: nil, details: nil))
      return
    }
    pending = result
    self.script = script
    generation += 1
    let current = generation
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = WKWebsiteDataStore.default()
    configuration.setURLSchemeHandler(self, forURLScheme: LegacyWebStorageChannel.scheme)
    let view = WKWebView(frame: CGRect(x: 0, y: 0, width: 1, height: 1), configuration: configuration)
    view.alpha = 0
    view.isUserInteractionEnabled = false
    view.navigationDelegate = self
    // Some iOS versions throttle WebViews outside a window; attach invisibly when a window exists.
    LegacyWebStorageChannel.keyWindow()?.addSubview(view)
    webView = view
    view.load(URLRequest(url: LegacyWebStorageChannel.origin))
    DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) { [weak self] in
      guard let self, self.generation == current else { return }
      self.finish(FlutterError(code: "TIMEOUT", message: nil, details: nil))
    }
  }

  private static func keyWindow() -> UIWindow? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
  }

  /// Never passes values or messages in errors: they can contain stored user data.
  private func finish(_ value: Any?) {
    guard let result = pending else { return }
    pending = nil
    generation += 1
    if let view = webView {
      view.navigationDelegate = nil
      view.stopLoading()
      view.removeFromSuperview()
    }
    webView = nil
    result(value)
  }

  func detach() {
    finish(FlutterError(code: "DETACHED", message: nil, details: nil))
    channel.setMethodCallHandler(nil)
  }
}

extension LegacyWebStorageChannel: WKURLSchemeHandler {
  func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
    let url = urlSchemeTask.request.url ?? LegacyWebStorageChannel.origin
    let isDocument = url.host == LegacyWebStorageChannel.host && (url.path.isEmpty || url.path == "/")
    let data = isDocument ? Data(LegacyWebStorageChannel.page.utf8) : Data()
    let headers = ["Content-Type": isDocument ? "text/html; charset=utf-8" : "text/plain", "Content-Length": "\(data.count)"]
    guard let response = HTTPURLResponse(url: url, statusCode: isDocument ? 200 : 404, httpVersion: "HTTP/1.1",
                                         headerFields: headers) else {
      urlSchemeTask.didFailWithError(URLError(.badServerResponse))
      return
    }
    urlSchemeTask.didReceive(response)
    urlSchemeTask.didReceive(data)
    urlSchemeTask.didFinish()
  }

  func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}

extension LegacyWebStorageChannel: WKNavigationDelegate {
  func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
               decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    let url = navigationAction.request.url
    let allowed = url?.scheme == LegacyWebStorageChannel.scheme && url?.host == LegacyWebStorageChannel.host
    decisionHandler(allowed ? .allow : .cancel)
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    guard webView === self.webView, pending != nil else { return }
    webView.evaluateJavaScript(script) { [weak self] value, _ in
      guard let self, webView === self.webView else { return }
      if let text = value as? String {
        self.finish(text)
      } else {
        self.finish(FlutterError(code: "SCRIPT", message: nil, details: nil))
      }
    }
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    if webView === self.webView { finish(FlutterError(code: "LOAD", message: nil, details: nil)) }
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    if webView === self.webView { finish(FlutterError(code: "LOAD", message: nil, details: nil)) }
  }
}
