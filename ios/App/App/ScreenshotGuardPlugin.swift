import Foundation
import Capacitor
import UIKit
import WebKit

// Public UIKit secure text rendering is used as a capture-excluding surface.
// iOS offers no general screenshot-prevention API; availability is reported to
// JS, and recording/app-switcher concealment also uses a native black curtain.
private final class CaptureSecureField: UITextField {
    weak var captureSurface: UIView?
    override var canBecomeFirstResponder: Bool { false }
    override func layoutSubviews() {
        super.layoutSubviews()
        captureSurface?.frame = bounds
    }
}

@objc(ScreenshotGuardPlugin)
public class ScreenshotGuardPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScreenshotGuardPlugin"
    public let jsName = "ScreenshotGuard"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise)]
    private var observers: [NSObjectProtocol] = []
    private var protected = true
    private var inactive = false
    private var flashUntil: Date?
    private var secureField: CaptureSecureField?
    private weak var originalParent: UIView?
    private var originalIndex = 0
    private var originalConstraints: [NSLayoutConstraint] = []
    private var originalTranslates = true
    private let curtain = UIView()

    override public func load() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: UIApplication.userDidTakeScreenshotNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self, self.protected else { return }
            self.flashUntil = Date().addingTimeInterval(1.4)
            self.refreshCurtain()
            self.notifyListeners("screenshotTaken", data: [:])
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in self?.refreshCurtain() }
        })
        observers.append(center.addObserver(forName: UIScreen.capturedDidChangeNotification, object: nil, queue: .main) { [weak self] _ in self?.refreshCurtain() })
        observers.append(center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.inactive = true; self?.refreshCurtain() })
        observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.inactive = false; self?.refreshCurtain() })
        DispatchQueue.main.async { [weak self] in _ = self?.installSecureSurface(); self?.refreshCurtain() }
    }

    private func installSecureSurface() -> Bool {
        if secureField != nil { return true }
        guard let web = bridge?.webView, let parent = web.superview else { return false }
        let field = CaptureSecureField(frame: web.frame)
        field.isSecureTextEntry = true
        field.text = " "
        field.textColor = .clear
        field.tintColor = .clear
        field.backgroundColor = .black
        field.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        field.isAccessibilityElement = false
        parent.insertSubview(field, at: parent.subviews.firstIndex(of: web) ?? 0)
        field.layoutIfNeeded()
        guard let surface = field.subviews.first else { field.removeFromSuperview(); return false }
        originalParent = parent
        originalIndex = parent.subviews.firstIndex(of: web) ?? 0
        originalTranslates = web.translatesAutoresizingMaskIntoConstraints
        originalConstraints = parent.constraints.filter { ($0.firstItem as? UIView) === web || ($0.secondItem as? UIView) === web }
        NSLayoutConstraint.deactivate(originalConstraints)
        surface.isUserInteractionEnabled = true
        surface.backgroundColor = .black
        surface.frame = field.bounds
        surface.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        field.captureSurface = surface
        web.removeFromSuperview()
        web.translatesAutoresizingMaskIntoConstraints = true
        web.frame = surface.bounds
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        surface.addSubview(web)
        secureField = field
        return true
    }

    private func removeSecureSurface() {
        guard let field = secureField, let web = bridge?.webView, let parent = originalParent else { return }
        web.removeFromSuperview()
        parent.insertSubview(web, at: min(originalIndex, parent.subviews.count))
        web.frame = field.frame
        web.translatesAutoresizingMaskIntoConstraints = originalTranslates
        NSLayoutConstraint.activate(originalConstraints)
        field.removeFromSuperview()
        secureField = nil
        originalConstraints = []
    }

    private func refreshCurtain() {
        guard let host = bridge?.viewController?.view else { return }
        if curtain.superview !== host {
            curtain.removeFromSuperview()
            curtain.backgroundColor = .black
            curtain.isOpaque = true
            curtain.isUserInteractionEnabled = true
            curtain.accessibilityIdentifier = "anacan-capture-curtain"
            curtain.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            host.addSubview(curtain)
        }
        let captured = host.window?.screen.isCaptured ?? UIScreen.main.isCaptured
        curtain.frame = host.bounds
        curtain.isHidden = !(inactive || (protected && (captured || (flashUntil ?? .distantPast) > Date())))
        host.bringSubviewToFront(curtain)
        notifyListeners("captureChanged", data: ["captured": captured, "protected": protected])
    }

    @objc func setEnabled(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? true
        DispatchQueue.main.async { [weak self] in
            guard let self else { call.reject("CAPTURE_GUARD_UNAVAILABLE"); return }
            self.protected = enabled
            let surface: Bool
            if enabled { surface = self.installSecureSurface() }
            else { self.removeSecureSurface(); self.flashUntil = nil; surface = true }
            self.refreshCurtain()
            call.resolve(["enabled": enabled, "secureSurface": surface])
        }
    }

    deinit { observers.forEach { NotificationCenter.default.removeObserver($0) } }
}
