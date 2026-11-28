import Flutter
import UIKit

/// Screenshot guard, ported from the Capacitor app's ScreenshotGuardPlugin.swift.
///
/// iOS cannot refuse a screenshot. The Capacitor plugin moved the WKWebView into the capture-excluding canvas of a
/// secure UITextField; a FlutterView cannot be re-parented that way (its touches travel the responder chain to the
/// FlutterViewController, and a UITextField in between swallows them). The Flutter port therefore uses the
/// layer-level variant (the window's layer is hosted inside the secure field's canvas layer; the view hierarchy
/// and touches stay untouched) and toggles `isSecureTextEntry`. That technique depends on UIKit internals, so it is
/// behind [secureSurfaceEnabled] (off) until a device build confirms rendering, keyboard and touches; with it off
/// screenshots are not blanked on iOS (Android FLAG_SECURE is unaffected) and `setEnabled` answers
/// `secureSurface: false`.
///
/// Always on, as in Capacitor: the branded curtain (cream background + Splash art) while the app is inactive / in the
/// background (app switcher) and while the screen is recorded or mirrored and protection is on, the
/// `screenshotTaken` event, and `captureChanged {captured, protected}`.
///
/// Channel "anacan/screenshot_guard": setEnabled {enabled} -> {enabled, secureSurface},
/// setCurtainSuspended {suspended} -> {suspended}; native -> Dart: screenshotTaken, captureChanged.
final class ScreenshotGuardChannel {
  static let channelName = "anacan/screenshot_guard"
  /// Turn on after a device check of the layer-level secure surface (see the type comment).
  static let secureSurfaceEnabled = false

  private static let background = UIColor(red: 0.980, green: 0.969, blue: 0.957, alpha: 1) // #FAF7F4, launch screen

  private let channel: FlutterMethodChannel
  private var observers: [NSObjectProtocol] = []
  private var protected = true
  private var inactive = false
  private var curtainSuspended = false
  private var activeToken = 0
  private let curtain = UIView()
  private var secureField: UITextField?

  init(messenger: FlutterBinaryMessenger) {
    channel = FlutterMethodChannel(name: ScreenshotGuardChannel.channelName, binaryMessenger: messenger)
    channel.setMethodCallHandler { [weak self] call, result in
      guard let self else { result(FlutterError(code: "CAPTURE_GUARD_UNAVAILABLE", message: nil, details: nil)); return }
      self.handle(call, result: result)
    }
    let center = NotificationCenter.default
    observers.append(center.addObserver(forName: UIApplication.userDidTakeScreenshotNotification, object: nil, queue: .main) { [weak self] _ in
      guard let self, self.protected else { return }
      self.channel.invokeMethod("screenshotTaken", arguments: nil)
    })
    observers.append(center.addObserver(forName: UIScreen.capturedDidChangeNotification, object: nil, queue: .main) { [weak self] _ in
      self?.refreshCurtain()
    })
    // Face ID / passcode sheets also resign the app; Dart suspends the curtain around those prompts so the lock
    // screen stays visible instead of flashing a cover.
    observers.append(center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
      guard let self else { return }
      self.activeToken += 1
      if !self.curtainSuspended { self.inactive = true; self.refreshCurtain() }
    })
    observers.append(center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
      guard let self else { return }
      self.activeToken += 1; self.inactive = true; self.refreshCurtain()
    })
    // Keep the cover a moment after returning (Capacitor: the web view repainted late; Flutter also needs a frame).
    observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
      guard let self else { return }
      let token = self.activeToken
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.32) { [weak self] in
        guard let self, self.activeToken == token else { return }
        self.inactive = false; self.refreshCurtain()
      }
    })
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.applySecureSurface()
      self.refreshCurtain()
    }
  }

  deinit { observers.forEach { NotificationCenter.default.removeObserver($0) } }

  private func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as? [String: Any]
    switch call.method {
    case "setEnabled":
      let enabled = args?["enabled"] as? Bool ?? true
      DispatchQueue.main.async {
        self.protected = enabled
        let surface = self.applySecureSurface()
        self.refreshCurtain()
        result(["enabled": enabled, "secureSurface": surface])
      }
    case "setCurtainSuspended":
      let suspended = args?["suspended"] as? Bool ?? false
      DispatchQueue.main.async {
        self.curtainSuspended = suspended
        if suspended && UIApplication.shared.applicationState == .active { self.inactive = false; self.refreshCurtain() }
        result(["suspended": suspended])
      }
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private var window: UIWindow? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    for scene in scenes {
      if let key = scene.windows.first(where: { $0.isKeyWindow }) { return key }
    }
    return scenes.first?.windows.first
  }

  /// Returns whether captures of the app are blanked (Capacitor's `secureSurface`).
  @discardableResult
  private func applySecureSurface() -> Bool {
    guard ScreenshotGuardChannel.secureSurfaceEnabled else { return !protected }
    guard let window else { return false }
    if secureField == nil {
      let field = UITextField()
      field.isUserInteractionEnabled = false
      field.isAccessibilityElement = false
      field.translatesAutoresizingMaskIntoConstraints = false
      window.addSubview(field)
      field.centerXAnchor.constraint(equalTo: window.centerXAnchor).isActive = true
      field.centerYAnchor.constraint(equalTo: window.centerYAnchor).isActive = true
      // Host the window's layer inside the field's secure canvas layer (first sublayer before iOS 17, last after).
      window.layer.superlayer?.addSublayer(field.layer)
      let canvas: CALayer?
      if #available(iOS 17.0, *) { canvas = field.layer.sublayers?.last } else { canvas = field.layer.sublayers?.first }
      guard let canvas else { field.removeFromSuperview(); return false }
      canvas.addSublayer(window.layer)
      secureField = field
    }
    secureField?.isSecureTextEntry = protected
    return true
  }

  private func refreshCurtain() {
    guard let host = window else { return }
    if curtain.superview !== host {
      curtain.removeFromSuperview()
      curtain.backgroundColor = ScreenshotGuardChannel.background
      curtain.isOpaque = true
      if curtain.subviews.isEmpty, let art = UIImage(named: "Splash") {
        // Same artwork as the launch screen (light/dark variants come from the asset catalog).
        let image = UIImageView(image: art)
        image.contentMode = .scaleAspectFill
        image.clipsToBounds = true
        image.frame = curtain.bounds
        image.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        curtain.addSubview(image)
      }
      curtain.isUserInteractionEnabled = true
      curtain.accessibilityIdentifier = "anacan-capture-curtain"
      curtain.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      host.addSubview(curtain)
    }
    let captured = host.screen.isCaptured
    curtain.frame = host.bounds
    curtain.isHidden = !(inactive || (protected && captured))
    host.bringSubviewToFront(curtain)
    channel.invokeMethod("captureChanged", arguments: ["captured": captured, "protected": protected])
  }
}
