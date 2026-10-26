import XCTest
import Foundation
import Capacitor
import CioDataPipelines
import CustomerIoDataInPlugin
import ObjectiveC.runtime

/// An opt-in native acceptance fixture. It uses the app's native integration and
/// the real SDK's HTTPS ingestion; no management API or handcrafted event POST.
final class SDKIngestionTests: XCTestCase {
    func testIdentifyAndRealEventReachEUIngestion() async throws {
        let configURL = Bundle.module.url(forResource: "RunConfig", withExtension: "json")!
        let config = try JSONSerialization.jsonObject(with: Data(contentsOf: configURL)) as! [String: Any]
        let userId = config["testIdentifier"] as! String
        let workspaceId = config["workspaceId"] as! Int
        let sourceId = config["sourceId"] as! Int
        let started = Date()
        XCTAssertTrue(userId.hasPrefix("anacan-cio-verification-"))
        XCTAssertEqual(workspaceId, 224149)
        XCTAssertEqual(sourceId, 93570)
        IngestionObservation.userId = userId
        let original = class_getInstanceMethod(URLSessionConfiguration.self, #selector(getter: URLSessionConfiguration.protocolClasses))!
        let observed = class_getInstanceMethod(URLSessionConfiguration.self, #selector(URLSessionConfiguration.cioObservationProtocols))!
        method_exchangeImplementations(original, observed)
        URLProtocol.registerClass(IngestionObservation.self)
        defer { URLProtocol.unregisterClass(IngestionObservation.self); method_exchangeImplementations(original, observed) }

        try CustomerIoDataInPlugin.configureDataIn(cdpApiKey: config["cdpApiKey"] as! String, environment: "production")
        let plugin = CustomerIoDataInPlugin()
        func invoke(_ name: String, options: JSObject, _ action: (CAPPluginCall) -> Void) {
            var resolved = false
            let call = CAPPluginCall(callbackId: UUID().uuidString, methodName: name, options: options,
                success: { _, _ in resolved = true }, error: { _ in XCTFail("Native Data In call rejected: \(name)") })!
            action(call)
            XCTAssertTrue(resolved, "Native Data In call did not resolve: \(name)")
        }
        invoke("identify", options: ["userId": userId, "traits": ["environment": "integration-test", "is_test": true] as JSObject], plugin.identify)
        invoke("track", options: ["name": "community_post_created", "properties": ["environment": "integration-test", "is_test": true, "entry_point": "community"] as JSObject], plugin.track)
        invoke("screen", options: ["title": "Community", "properties": ["environment": "integration-test", "is_test": true] as JSObject], plugin.screen)

        let deadline = Date().addingTimeInterval(75)
        while Date() < deadline && !IngestionObservation.accepted {
            CustomerIO.shared.flush()
            // XCTest may run off the main run loop. A real suspension lets the
            // SDK's startup/network queues progress without flooding flush().
            try await Task.sleep(nanoseconds: 1_000_000_000)
        }
        let records = IngestionObservation.snapshot()
        let report: [String: Any] = [
            "at": ISO8601DateFormatter().string(from: Date()), "startedAt": ISO8601DateFormatter().string(from: started),
            "workspaceId": workspaceId, "sourceId": sourceId, "region": "EU", "testIdentifier": userId,
            "ingestionOrigin": "https://cdp-eu.customer.io", "sdk": "customerio-ios/4.9.0",
            "nativeIntegrationExercised": true, "sdkIngestionAccepted": IngestionObservation.accepted,
            "sdkEnabled": CustomerIO.shared.enabled, "sdkIdentifiedThisRun": CustomerIO.shared.userId == userId,
            "hasUnsentEvents": CustomerIO.shared.hasUnsentEvents,
            "sourceEventsVerified": false, "sourceEventsBoundary": "SDK HTTP acceptance; destination verification is recorded separately",
            "requests": records
        ]
        try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
            .write(to: URL(fileURLWithPath: config["reportPath"] as! String), options: .atomic)
        invoke("reset", options: [:], plugin.reset)
        XCTAssertTrue(IngestionObservation.accepted, "SDK identify/track did not receive EU ingestion acceptance; see credential-free receipt")
    }
}

/// Observes the SDK's requests and their actual HTTPS responses. Forwarding keeps
/// the SDK-generated URL, authentication and body, with ordinary TLS validation.
/// Only this run's non-production ID, event type/name/timestamp and status survive.
final class IngestionObservation: URLProtocol {
    static var userId = ""
    private static let lock = NSLock()
    private static var records: [[String: Any]] = []
    private var session: URLSession?
    private var forwardTask: URLSessionDataTask?
    override class func canInit(with request: URLRequest) -> Bool {
        ["cdp-eu.customer.io", "cdp.customer.io"].contains(request.url?.host ?? "") && URLProtocol.property(forKey: "cio-observed", in: request) == nil
    }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    static func snapshot() -> [[String: Any]] { lock.lock(); defer { lock.unlock() }; return records }
    static var accepted: Bool {
        let events = snapshot().filter { $0["host"] as? String == "cdp-eu.customer.io" && (200..<300).contains($0["status"] as? Int ?? 0) }.flatMap { $0["events"] as? [[String: Any]] ?? [] }
        return events.contains { $0["type"] as? String == "identify" && $0["userId"] as? String == userId } &&
            events.contains { $0["type"] as? String == "track" && $0["event"] as? String == "community_post_created" && $0["userId"] as? String == userId } &&
            events.contains { $0["type"] as? String == "screen" && $0["userId"] as? String == userId }
    }
    override func startLoading() {
        let forwarded = (request as NSURLRequest).mutableCopy() as! NSMutableURLRequest
        URLProtocol.setProperty(true, forKey: "cio-observed", in: forwarded)
        var body = request.httpBody
        if body == nil, let stream = request.httpBodyStream {
            stream.open(); defer { stream.close() }
            var data = Data(), buffer = [UInt8](repeating: 0, count: 8192)
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count <= 0 { break }
                data.append(contentsOf: buffer.prefix(count))
                if data.count > 1_048_576 { break }
            }
            body = data
            forwarded.httpBody = data
        }
        let json = body.flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any]
        let events = (json?["batch"] as? [[String: Any]] ?? (json == nil ? [] : [json!])).filter { $0["userId"] as? String == Self.userId }.map { event in
            Dictionary(uniqueKeysWithValues: ["userId", "type", "event", "timestamp", "messageId"].compactMap { key in
                (event[key] as? String).map { (key, $0 as Any) }
            })
        }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = []
        session = URLSession(configuration: configuration)
        forwardTask = session!.dataTask(with: forwarded as URLRequest) { [weak self] data, response, error in
            guard let self else { return }
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            Self.lock.lock()
            Self.records.append(["status": status, "observedAt": ISO8601DateFormatter().string(from: Date()),
                                 "host": self.request.url?.host ?? "", "method": self.request.httpMethod ?? "GET", "events": events, "transportError": error != nil])
            Self.lock.unlock()
            if let error { self.client?.urlProtocol(self, didFailWithError: error) }
            else {
                if let response { self.client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed) }
                if let data { self.client?.urlProtocol(self, didLoad: data) }
                self.client?.urlProtocolDidFinishLoading(self)
            }
            self.session?.finishTasksAndInvalidate()
        }
        forwardTask?.resume()
    }
    override func stopLoading() { forwardTask?.cancel() }
}

private extension URLSessionConfiguration {
    @objc func cioObservationProtocols() -> [AnyClass]? {
        [IngestionObservation.self] + (cioObservationProtocols() ?? []).filter { $0 != IngestionObservation.self }
    }
}
