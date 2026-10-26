import Foundation
import Capacitor
import HealthKit

/**
 * HealthCycle — menstruasiya məlumatının Apple Health-ə YAZILMASI.
 * (capacitor-health plugini yalnız oxuyur; yazma üçün bu lokal plugin.)
 *
 * QEYD: Bu fayl Xcode-da App target-inə əlavə olunmalıdır
 * (PrivacyInfo.xcprivacy ilə eyni qaydada).
 *
 * JS tərəfi: src/lib/healthCycle.ts
 */
@objc(HealthCyclePlugin)
public class HealthCyclePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthCyclePlugin"
    public let jsName = "HealthCycle"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestWritePermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeMenstruation", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()

    private var menstrualType: HKCategoryType? {
        return HKObjectType.categoryType(forIdentifier: .menstrualFlow)
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable(), "apiVersion": 2])
    }

    @objc func requestWritePermission(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(), let type = menstrualType else {
            call.resolve(["granted": false])
            return
        }
        store.requestAuthorization(toShare: [type], read: []) { _, error in
            if let error = error {
                call.reject("permission_request_failed: \(error.localizedDescription)")
                return
            }
            // iOS yazma icazəsi status sorğusuna cavab verir
            let status = self.store.authorizationStatus(for: type)
            call.resolve(["granted": status == .sharingAuthorized])
        }
    }

    /// writeMenstruation({ startDate: 'yyyy-MM-dd', endDate: 'yyyy-MM-dd', flow: 'light'|'medium'|'heavy' })
    /// Hər gün üçün ayrıca nümunə; ilk gün cycleStart = true.
    @objc func writeMenstruation(_ call: CAPPluginCall) {
        guard let type = menstrualType else {
            call.reject("healthkit_unavailable")
            return
        }
        guard let startStr = call.getString("startDate") else {
            call.reject("startDate_required")
            return
        }
        let endStr = call.getString("endDate") ?? startStr
        let flowStr = call.getString("flow") ?? "unspecified"
        let startsCycle = call.getBool("cycleStart") ?? true

        let flowValue: HKCategoryValueMenstrualFlow
        switch flowStr {
        case "light": flowValue = .light
        case "medium": flowValue = .medium
        case "heavy": flowValue = .heavy
        case "none": flowValue = .none
        case "unspecified", "clear": flowValue = .unspecified
        default: call.reject("invalid_flow"); return
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.isLenient = false
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        guard let startDate = formatter.date(from: startStr),
               let endDate = formatter.date(from: endStr),
               formatter.string(from: startDate) == startStr,
               formatter.string(from: endDate) == endStr,
               startDate <= endDate,
               endDate <= calendar.startOfDay(for: Date()),
               (calendar.dateComponents([.day], from: startDate, to: endDate).day ?? 91) < 90 else {
            call.reject("invalid_dates")
            return
        }

        var samples: [HKCategorySample] = []
        var day = startDate
        var isFirst = true

        while day <= endDate {
            // Günorta — timezone kənar hallarından qaçmaq üçün
            let sampleStart = calendar.date(byAdding: .hour, value: 12, to: day) ?? day
            let sampleEnd = calendar.date(byAdding: .minute, value: 1, to: sampleStart) ?? sampleStart
            let metadata: [String: Any] = [
                HKMetadataKeyMenstrualCycleStart: startsCycle && isFirst && flowStr != "none",
                HKMetadataKeySyncIdentifier: "anacan-menstrual-day-\(formatter.string(from: day))",
                HKMetadataKeySyncVersion: Int(Date().timeIntervalSince1970 * 1000)
            ]
            if flowStr != "clear" { samples.append(HKCategorySample(
                type: type,
                value: flowValue.rawValue,
                start: sampleStart,
                end: sampleEnd,
                metadata: metadata
            )) }
            isFirst = false
            guard let next = calendar.date(byAdding: .day, value: 1, to: day) else { break }
            day = next
        }

        // Delete only this app's records for the selected local day(s), including
        // legacy duplicates. Records written by Apple Health/other apps are retained.
        let through = calendar.date(byAdding: .day, value: 1, to: endDate)!
        let predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
            HKQuery.predicateForSamples(withStart: startDate, end: through, options: .strictStartDate),
            HKQuery.predicateForObjects(from: HKSource.default())
        ])
        store.deleteObjects(of: type, predicate: predicate) { _, _, deleteError in
            if deleteError != nil { call.reject("delete_failed"); return }
            if samples.isEmpty { call.resolve(["written": 0, "success": true]); return }
            self.store.save(samples) { success, error in
            if error != nil {
                call.reject("write_failed")
                return
            }
            call.resolve(["written": samples.count, "success": success])
            }
        }
    }
}
