import Capacitor
import CioDataPipelines
import CryptoKit
import Foundation

/// The app owns identity, consent and navigation; only the official Data Pipelines
/// product is linked. Nothing is initialized when Capacitor registers this plugin.
@objc(CustomerIoDataInPlugin)
public class CustomerIoDataInPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CustomerIoDataInPlugin"
    public let jsName = "CustomerIoDataIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "identify", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "track", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "screen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reset", returnType: CAPPluginReturnPromise)
    ]
    private static let lock = NSLock()
    private static var configuration: String?
    private static var identified = false

    @objc public func initialize(_ call: CAPPluginCall) {
        // Credentials never cross the JS bridge (Capacitor can log call options).
        let config = getConfig()
        guard let key = config.getString("cdpApiKey"), config.getBoolean("enabled", false),
              call.getString("region") == "EU", config.getString("region") == "EU",
              let environment = config.getString("environment"), call.getString("environment") == environment else {
            call.reject("CUSTOMERIO_INVALID_CONFIGURATION"); return
        }
        do { try Self.configureDataIn(cdpApiKey: key, environment: environment); call.resolve() }
        catch { call.reject("CUSTOMERIO_INITIALIZATION_FAILED") }
    }

    /// Shared production initialization path, also exercised by native SDK tests.
    public static func configureDataIn(cdpApiKey key: String, environment: String) throws {
        Self.lock.lock()
        defer { Self.lock.unlock() }
        guard !key.isEmpty, key.count <= 512, !key.contains(where: { $0.isWhitespace }),
              ["sandbox", "production"].contains(environment) else {
            throw NSError(domain: "CUSTOMERIO_INVALID_CONFIGURATION", code: 1)
        }
        let fingerprint = SHA256.hash(data: Data("\(environment):\(key)".utf8)).map { String(format: "%02x", $0) }.joined()
        if let existing = Self.configuration {
            guard existing == fingerprint else { throw NSError(domain: "CUSTOMERIO_RESTART_REQUIRED", code: 1) }
            return
        }
        let config = SDKConfigBuilder(cdpApiKey: key)
            .region(.EU)
            .logLevel(.none)
            .trackApplicationLifecycleEvents(false)
            .autoTrackDeviceAttributes(false)
        CustomerIO.initialize(withConfig: config.build())
        // A restored SDK identity must never outlive the app's authenticated owner.
        CustomerIO.shared.clearIdentify()
        Self.configuration = fingerprint
        Self.identified = false
    }

    @objc public func identify(_ call: CAPPluginCall) {
        Self.lock.lock()
        defer { Self.lock.unlock() }
        guard Self.configuration != nil, let userId = call.getString("userId"),
              !userId.isEmpty, userId.count <= 200 else { call.reject("CUSTOMERIO_IDENTITY_REQUIRED"); return }
        CustomerIO.shared.identify(userId: userId, traits: call.getObject("traits") ?? [:])
        Self.identified = true
        call.resolve()
    }

    @objc public func track(_ call: CAPPluginCall) {
        Self.lock.lock()
        defer { Self.lock.unlock() }
        guard Self.configuration != nil, Self.identified,
              call.getString("name") == "community_post_created" else { call.reject("CUSTOMERIO_EVENT_REJECTED"); return }
        CustomerIO.shared.track(name: "community_post_created", properties: call.getObject("properties") ?? [:])
        call.resolve()
    }

    @objc public func screen(_ call: CAPPluginCall) {
        Self.lock.lock()
        defer { Self.lock.unlock() }
        guard Self.configuration != nil, Self.identified, let title = call.getString("title"),
              title.range(of: "^[A-Za-z][A-Za-z0-9 _-]{0,79}$", options: .regularExpression) != nil else {
            call.reject("CUSTOMERIO_SCREEN_REJECTED"); return
        }
        CustomerIO.shared.screen(title: title, properties: call.getObject("properties") ?? [:])
        call.resolve()
    }

    @objc public func reset(_ call: CAPPluginCall) {
        Self.lock.lock()
        defer { Self.lock.unlock() }
        if Self.configuration != nil { CustomerIO.shared.clearIdentify() }
        Self.identified = false
        call.resolve()
    }
}
