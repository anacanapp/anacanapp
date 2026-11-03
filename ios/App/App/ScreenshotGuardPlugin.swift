import Foundation
import Capacitor
import UIKit
import WebKit

// Public UIKit secure text rendering is used as a capture-excluding surface.
// iOS offers no general screenshot-prevention API; availability is reported to
// JS, and recording/app-switcher concealment uses a native branded curtain (app background + splash art),
// so the app switcher shows Anacan instead of a black card.
// iOS cannot refuse a screenshot; the secure surface makes every protected
// capture show only the branded backdrop (cream + coral mark), never content.
private let anacanBackground = UIColor(red: 0.980, green: 0.969, blue: 0.957, alpha: 1) // #FAF7F4, same as the launch screen

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
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise),
                                                   CAPPluginMethod(name: "setCurtainSuspended", returnType: CAPPluginReturnPromise)]
    private var observers: [NSObjectProtocol] = []
    private var protected = true
    private var inactive = false
    private var curtainSuspended = false
    private var activeToken = 0
    private let backdrop = UIImageView()
    private var secureField: CaptureSecureField?
    private weak var originalParent: UIView?
    private var originalIndex = 0
    private var originalConstraints: [NSLayoutConstraint] = []
    private var originalTranslates = true
    private let curtain = UIView()

    override public func load() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: UIApplication.userDidTakeScreenshotNotification, object: nil, queue: .main) { [weak self] _ in
            // The capture already happened (and showed only the backdrop); never black out the live screen.
            guard let self, self.protected else { return }
            self.notifyListeners("screenshotTaken", data: [:])
        })
        observers.append(center.addObserver(forName: UIScreen.capturedDidChangeNotification, object: nil, queue: .main) { [weak self] _ in self?.refreshCurtain() })
        // Face ID / passcode sheets also resign the app; JS suspends the curtain around those prompts so
        // the lock screen stays visible instead of flashing a cover.
        observers.append(center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self else { return }
            self.activeToken += 1
            if !self.curtainSuspended { self.inactive = true; self.refreshCurtain() }
        })
        observers.append(center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self else { return }
            self.activeToken += 1; self.inactive = true; self.refreshCurtain()
        })
        // Keep the branded cover a moment after returning: WKWebView repaints its layers after
        // activation, and revealing it earlier showed a black frame.
        observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self else { return }
            let token = self.activeToken
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.32) { [weak self] in
                guard let self, self.activeToken == token else { return }
                self.inactive = false; self.refreshCurtain()
            }
        })
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
        field.backgroundColor = .clear
        field.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        field.isAccessibilityElement = false
        // What a protected screenshot / recording shows instead of the secure layer.
        backdrop.image = UIImage(named: "Splash")
        backdrop.backgroundColor = anacanBackground
        backdrop.contentMode = .scaleAspectFill
        backdrop.clipsToBounds = true
        backdrop.frame = web.frame
        backdrop.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        parent.insertSubview(backdrop, at: parent.subviews.firstIndex(of: web) ?? 0)
        parent.insertSubview(field, aboveSubview: backdrop)
        field.layoutIfNeeded()
        guard let surface = field.subviews.first else { field.removeFromSuperview(); return false }
        originalParent = parent
        originalIndex = parent.subviews.firstIndex(of: web) ?? 0
        originalTranslates = web.translatesAutoresizingMaskIntoConstraints
        originalConstraints = parent.constraints.filter { ($0.firstItem as? UIView) === web || ($0.secondItem as? UIView) === web }
        NSLayoutConstraint.deactivate(originalConstraints)
        surface.isUserInteractionEnabled = true
        surface.backgroundColor = anacanBackground
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
        backdrop.removeFromSuperview()
        secureField = nil
        originalConstraints = []
    }

    private func refreshCurtain() {
        guard let host = bridge?.viewController?.view else { return }
        if curtain.superview !== host {
            curtain.removeFromSuperview()
            curtain.backgroundColor = anacanBackground
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
        let captured = host.window?.screen.isCaptured ?? UIScreen.main.isCaptured
        curtain.frame = host.bounds
        curtain.isHidden = !(inactive || (protected && captured))
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
            else { self.removeSecureSurface(); surface = true }
            self.refreshCurtain()
            call.resolve(["enabled": enabled, "secureSurface": surface])
        }
    }

    @objc func setCurtainSuspended(_ call: CAPPluginCall) {
        let suspended = call.getBool("suspended") ?? false
        DispatchQueue.main.async { [weak self] in
            guard let self else { call.resolve(); return }
            self.curtainSuspended = suspended
            if suspended && UIApplication.shared.applicationState == .active { self.inactive = false; self.refreshCurtain() }
            call.resolve(["suspended": suspended])
        }
    }

    deinit { observers.forEach { NotificationCenter.default.removeObserver($0) } }
}
