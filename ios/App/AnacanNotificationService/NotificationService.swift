import Foundation
import UserNotifications

/// Adds the image sent by FCM (`fcm_options.image`, or a top-level `image` key)
/// to the notification as an attachment. No Firebase dependency: the APNs
/// userInfo is parsed directly. Any failure delivers the original content.
final class NotificationService: UNNotificationServiceExtension {
    private static let downloadTimeout: TimeInterval = 8
    private static let maxImageBytes = 10 * 1024 * 1024

    private let lock = NSLock()
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttemptContent: UNMutableNotificationContent?
    private var downloadTask: URLSessionDownloadTask?
    private var session: URLSession?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        guard let content = request.content.mutableCopy() as? UNMutableNotificationContent else {
            contentHandler(request.content)
            return
        }

        lock.lock()
        self.contentHandler = contentHandler
        self.bestAttemptContent = content
        lock.unlock()

        guard let imageURL = Self.imageURL(from: request.content.userInfo) else {
            deliver()
            return
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = Self.downloadTimeout
        configuration.timeoutIntervalForResource = Self.downloadTimeout
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.waitsForConnectivity = false
        let session = URLSession(configuration: configuration)

        let task = session.downloadTask(with: imageURL) { [weak self] location, response, error in
            guard let self = self else { return }
            if error == nil, let location = location {
                if let attachment = Self.makeAttachment(
                    downloadedFile: location,
                    response: response,
                    sourceURL: imageURL
                ) {
                    self.lock.lock()
                    self.bestAttemptContent?.attachments = [attachment]
                    self.lock.unlock()
                }
            }
            self.deliver()
        }

        lock.lock()
        self.session = session
        self.downloadTask = task
        lock.unlock()

        task.resume()
    }

    override func serviceExtensionTimeWillExpire() {
        lock.lock()
        let task = downloadTask
        lock.unlock()
        task?.cancel()
        deliver()
    }

    /// Calls the content handler exactly once with the best content available.
    private func deliver() {
        lock.lock()
        let handler = contentHandler
        let content = bestAttemptContent
        contentHandler = nil
        bestAttemptContent = nil
        downloadTask = nil
        let session = self.session
        self.session = nil
        lock.unlock()

        session?.finishTasksAndInvalidate()
        if let handler = handler, let content = content {
            handler(content)
        }
    }

    // MARK: - Payload parsing

    private static func imageURL(from userInfo: [AnyHashable: Any]) -> URL? {
        var candidates: [Any?] = []
        if let fcmOptions = userInfo["fcm_options"] as? [AnyHashable: Any] {
            candidates.append(fcmOptions["image"])
        }
        candidates.append(userInfo["image"])

        for candidate in candidates {
            guard let raw = candidate as? String else { continue }
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty,
                  let url = URL(string: trimmed),
                  url.scheme?.lowercased() == "https",
                  let host = url.host, !host.isEmpty
            else { continue }
            return url
        }
        return nil
    }

    // MARK: - Attachment

    private static func makeAttachment(
        downloadedFile: URL,
        response: URLResponse?,
        sourceURL: URL
    ) -> UNNotificationAttachment? {
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            return nil
        }

        let fileManager = FileManager.default
        if let attributes = try? fileManager.attributesOfItem(atPath: downloadedFile.path),
           let size = attributes[.size] as? NSNumber {
            if size.intValue <= 0 || size.intValue > maxImageBytes {
                return nil
            }
        }

        guard let fileExtension = imageExtension(mimeType: response?.mimeType, url: sourceURL) else {
            return nil
        }

        let directory = fileManager.temporaryDirectory
            .appendingPathComponent("anacan-push-\(UUID().uuidString)", isDirectory: true)
        let destination = directory.appendingPathComponent("image.\(fileExtension)")

        do {
            try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
            try fileManager.moveItem(at: downloadedFile, to: destination)
            // The system moves the file into its own store when the attachment is created.
            return try UNNotificationAttachment(identifier: "image", url: destination, options: nil)
        } catch {
            try? fileManager.removeItem(at: directory)
            return nil
        }
    }

    private static func imageExtension(mimeType: String?, url: URL) -> String? {
        switch mimeType?.lowercased() {
        case "image/jpeg", "image/jpg", "image/pjpeg":
            return "jpg"
        case "image/png":
            return "png"
        case "image/gif":
            return "gif"
        default:
            break
        }

        switch url.pathExtension.lowercased() {
        case "jpg", "jpeg":
            return "jpg"
        case "png":
            return "png"
        case "gif":
            return "gif"
        default:
            break
        }

        // Unknown/absent type (e.g. application/octet-stream from a CDN): JPEG is the
        // most common push image; the attachment initializer rejects non-images.
        if mimeType == nil || mimeType?.lowercased() == "application/octet-stream" {
            return "jpg"
        }
        return nil
    }
}
