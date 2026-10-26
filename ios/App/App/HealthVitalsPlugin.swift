import Foundation
import Capacitor
import HealthKit

/**
 * HealthVitals — çəki / qan təzyiqi / qan şəkəri ölçmələrinin Apple Health-ə YAZILMASI.
 * (capacitor-health plugini bunları dəstəkləmir; HealthCyclePlugin ilə eyni məntiq,
 * ayrı, müstəqil native plugin.)
 *
 * QEYD: Bu fayl Xcode-da App target-inə əlavə olunmalıdır
 * (HealthCyclePlugin.swift / PrivacyInfo.xcprivacy ilə eyni qaydada —
 * bax docs/IOS_NATIVE_FEATURES_SETUP.md).
 *
 * JS tərəfi: src/lib/healthVitals.ts
 */
@objc(HealthVitalsPlugin)
public class HealthVitalsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthVitalsPlugin"
    public let jsName = "HealthVitals"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestWritePermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeWeight", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeBloodPressure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeBloodGlucose", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()

    private var weightType: HKQuantityType? { HKObjectType.quantityType(forIdentifier: .bodyMass) }
    private var systolicType: HKQuantityType? { HKObjectType.quantityType(forIdentifier: .bloodPressureSystolic) }
    private var diastolicType: HKQuantityType? { HKObjectType.quantityType(forIdentifier: .bloodPressureDiastolic) }
    private var bpCorrelationType: HKCorrelationType? { HKObjectType.correlationType(forIdentifier: .bloodPressure) }
    private var glucoseType: HKQuantityType? { HKObjectType.quantityType(forIdentifier: .bloodGlucose) }

    /// Bütün 3 ölçünün yazma icazəsi TƏK dəfəyə istənilir (Settings-də tək toggle).
    private var allShareTypes: Set<HKSampleType> {
        var set = Set<HKSampleType>()
        if let w = weightType { set.insert(w) }
        if let s = systolicType { set.insert(s) }
        if let d = diastolicType { set.insert(d) }
        if let g = glucoseType { set.insert(g) }
        return set
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestWritePermission(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false])
            return
        }
        store.requestAuthorization(toShare: allShareTypes, read: []) { _, error in
            if let error = error {
                call.reject("permission_request_failed: \(error.localizedDescription)")
                return
            }
            guard let w = self.weightType else {
                call.resolve(["granted": false])
                return
            }
            // iOS yazma icazəsi status sorğusuna cavab verir (bir tip kifayətdir, hamısı birlikdə istənilib)
            let status = self.store.authorizationStatus(for: w)
            call.resolve(["granted": status == .sharingAuthorized])
        }
    }

    private func parseDate(_ str: String?) -> Date {
        guard let str = str else { return Date() }
        let iso = ISO8601DateFormatter()
        return iso.date(from: str) ?? Date()
    }

    /// writeWeight({ kg: number, date?: 'ISO8601' })
    @objc func writeWeight(_ call: CAPPluginCall) {
        guard let type = weightType else {
            call.reject("healthkit_unavailable")
            return
        }
        guard let kg = call.getDouble("kg") else {
            call.reject("kg_required")
            return
        }
        let date = parseDate(call.getString("date"))
        let quantity = HKQuantity(unit: .gramUnit(with: .kilo), doubleValue: kg)
        let sample = HKQuantitySample(type: type, quantity: quantity, start: date, end: date)

        store.save(sample) { success, error in
            if let error = error {
                call.reject("write_failed: \(error.localizedDescription)")
                return
            }
            call.resolve(["written": success])
        }
    }

    /// writeBloodPressure({ systolic: number, diastolic: number, date?: 'ISO8601' })
    /// Sistolik + diastolik BİR HKCorrelation kimi yazılır — Apple Health-in
    /// "Qan təzyiqi" kartında düzgün cütlük kimi görünməsi üçün vacibdir
    /// (ayrı-ayrı quantity sample-lar kimi yazılsa cütləşmir).
    @objc func writeBloodPressure(_ call: CAPPluginCall) {
        guard let sysType = systolicType, let diaType = diastolicType, let corrType = bpCorrelationType else {
            call.reject("healthkit_unavailable")
            return
        }
        guard let sys = call.getDouble("systolic"), let dia = call.getDouble("diastolic") else {
            call.reject("systolic_diastolic_required")
            return
        }
        let date = parseDate(call.getString("date"))
        let unit = HKUnit.millimeterOfMercury()
        let sysSample = HKQuantitySample(type: sysType, quantity: HKQuantity(unit: unit, doubleValue: sys), start: date, end: date)
        let diaSample = HKQuantitySample(type: diaType, quantity: HKQuantity(unit: unit, doubleValue: dia), start: date, end: date)
        let correlation = HKCorrelation(type: corrType, start: date, end: date, objects: [sysSample, diaSample])

        store.save(correlation) { success, error in
            if let error = error {
                call.reject("write_failed: \(error.localizedDescription)")
                return
            }
            call.resolve(["written": success])
        }
    }

    /// writeBloodGlucose({ mgdl: number, date?: 'ISO8601' })
    @objc func writeBloodGlucose(_ call: CAPPluginCall) {
        guard let type = glucoseType else {
            call.reject("healthkit_unavailable")
            return
        }
        guard let mgdl = call.getDouble("mgdl") else {
            call.reject("mgdl_required")
            return
        }
        let date = parseDate(call.getString("date"))
        // mg/dL = qram(milli) / litr(desi)
        let unit = HKUnit.gramUnit(with: .milli).unitDivided(by: HKUnit.literUnit(with: .deci))
        let quantity = HKQuantity(unit: unit, doubleValue: mgdl)
        let sample = HKQuantitySample(type: type, quantity: quantity, start: date, end: date)

        store.save(sample) { success, error in
            if let error = error {
                call.reject("write_failed: \(error.localizedDescription)")
                return
            }
            call.resolve(["written": success])
        }
    }
}
