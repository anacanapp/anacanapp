import Flutter
import Foundation
import HealthKit

/// HealthKit writes, ported from the Capacitor app's HealthCyclePlugin.swift and HealthVitalsPlugin.swift (same
/// records, sync identifiers, validation and error strings). Needs the HealthKit entitlement (Runner.entitlements)
/// and NSHealthShareUsageDescription / NSHealthUpdateUsageDescription (Info.plist), both already present.
///
/// Channels "anacan/health_cycle" (isAvailable -> {available, apiVersion: 2}, requestWritePermission -> {granted},
/// writeMenstruation {startDate, endDate, flow, cycleStart} -> {written, success}) and "anacan/health_vitals"
/// (isAvailable -> {available}, requestWritePermission -> {granted}, writeWeight {kg, date?},
/// writeBloodPressure {systolic, diastolic, date?}, writeBloodGlucose {mgdl, date?} -> {written}).
/// Results are delivered on the main thread (HealthKit completion handlers run on background queues).
final class HealthChannels {
  private let store = HKHealthStore()
  private let cycle: FlutterMethodChannel
  private let vitals: FlutterMethodChannel

  init(messenger: FlutterBinaryMessenger) {
    cycle = FlutterMethodChannel(name: "anacan/health_cycle", binaryMessenger: messenger)
    vitals = FlutterMethodChannel(name: "anacan/health_vitals", binaryMessenger: messenger)
    cycle.setMethodCallHandler { [weak self] call, result in
      guard let self else { result(FlutterMethodNotImplemented); return }
      self.handleCycle(call, result: HealthChannels.onMain(result))
    }
    vitals.setMethodCallHandler { [weak self] call, result in
      guard let self else { result(FlutterMethodNotImplemented); return }
      self.handleVitals(call, result: HealthChannels.onMain(result))
    }
  }

  private static func onMain(_ result: @escaping FlutterResult) -> FlutterResult {
    return { value in
      if Thread.isMainThread { result(value) } else { DispatchQueue.main.async { result(value) } }
    }
  }

  private static func error(_ code: String) -> FlutterError { FlutterError(code: code, message: code, details: nil) }

  private static func double(_ value: Any?) -> Double? { (value as? NSNumber)?.doubleValue }

  // MARK: HealthCycle

  private var menstrualType: HKCategoryType? { HKObjectType.categoryType(forIdentifier: .menstrualFlow) }

  private func handleCycle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as? [String: Any] ?? [:]
    switch call.method {
    case "isAvailable":
      result(["available": HKHealthStore.isHealthDataAvailable(), "apiVersion": 2])
    case "requestWritePermission":
      guard HKHealthStore.isHealthDataAvailable(), let type = menstrualType else { result(["granted": false]); return }
      store.requestAuthorization(toShare: [type], read: []) { _, error in
        if let error {
          result(FlutterError(code: "permission_request_failed", message: error.localizedDescription, details: nil))
          return
        }
        // iOS answers the write-permission status query.
        result(["granted": self.store.authorizationStatus(for: type) == .sharingAuthorized])
      }
    case "writeMenstruation":
      writeMenstruation(args, result: result)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  /// writeMenstruation({ startDate: 'yyyy-MM-dd', endDate: 'yyyy-MM-dd', flow, cycleStart }): one sample per day,
  /// the first day carries cycleStart.
  private func writeMenstruation(_ args: [String: Any], result: @escaping FlutterResult) {
    guard let type = menstrualType else { result(HealthChannels.error("healthkit_unavailable")); return }
    guard let startStr = args["startDate"] as? String else { result(HealthChannels.error("startDate_required")); return }
    let endStr = args["endDate"] as? String ?? startStr
    let flowStr = args["flow"] as? String ?? "unspecified"
    let startsCycle = args["cycleStart"] as? Bool ?? true

    let flowValue: HKCategoryValueMenstrualFlow
    switch flowStr {
    case "light": flowValue = .light
    case "medium": flowValue = .medium
    case "heavy": flowValue = .heavy
    case "none": flowValue = .none
    case "unspecified", "clear": flowValue = .unspecified
    default: result(HealthChannels.error("invalid_flow")); return
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
      result(HealthChannels.error("invalid_dates"))
      return
    }

    var samples: [HKCategorySample] = []
    var day = startDate
    var isFirst = true
    while day <= endDate {
      // Noon: avoids time-zone edges.
      let sampleStart = calendar.date(byAdding: .hour, value: 12, to: day) ?? day
      let sampleEnd = calendar.date(byAdding: .minute, value: 1, to: sampleStart) ?? sampleStart
      let metadata: [String: Any] = [
        HKMetadataKeyMenstrualCycleStart: startsCycle && isFirst && flowStr != "none",
        HKMetadataKeySyncIdentifier: "anacan-menstrual-day-\(formatter.string(from: day))",
        HKMetadataKeySyncVersion: Int(Date().timeIntervalSince1970 * 1000),
      ]
      if flowStr != "clear" {
        samples.append(HKCategorySample(type: type, value: flowValue.rawValue, start: sampleStart, end: sampleEnd, metadata: metadata))
      }
      isFirst = false
      guard let next = calendar.date(byAdding: .day, value: 1, to: day) else { break }
      day = next
    }

    // Delete only this app's records for the selected local day(s), including legacy duplicates. Records written by
    // Apple Health / other apps are retained.
    guard let through = calendar.date(byAdding: .day, value: 1, to: endDate) else { result(HealthChannels.error("invalid_dates")); return }
    let predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
      HKQuery.predicateForSamples(withStart: startDate, end: through, options: .strictStartDate),
      HKQuery.predicateForObjects(from: HKSource.default()),
    ])
    store.deleteObjects(of: type, predicate: predicate) { _, _, deleteError in
      if deleteError != nil { result(HealthChannels.error("delete_failed")); return }
      if samples.isEmpty { result(["written": 0, "success": true]); return }
      self.store.save(samples) { success, error in
        if error != nil { result(HealthChannels.error("write_failed")); return }
        result(["written": samples.count, "success": success])
      }
    }
  }

  // MARK: HealthVitals

  private var weightType: HKQuantityType? { HKObjectType.quantityType(forIdentifier: .bodyMass) }
  private var systolicType: HKQuantityType? { HKObjectType.quantityType(forIdentifier: .bloodPressureSystolic) }
  private var diastolicType: HKQuantityType? { HKObjectType.quantityType(forIdentifier: .bloodPressureDiastolic) }
  private var bpCorrelationType: HKCorrelationType? { HKObjectType.correlationType(forIdentifier: .bloodPressure) }
  private var glucoseType: HKQuantityType? { HKObjectType.quantityType(forIdentifier: .bloodGlucose) }

  /// All three measures are requested at once (one switch in Settings).
  private var allShareTypes: Set<HKSampleType> {
    var set = Set<HKSampleType>()
    if let w = weightType { set.insert(w) }
    if let s = systolicType { set.insert(s) }
    if let d = diastolicType { set.insert(d) }
    if let g = glucoseType { set.insert(g) }
    return set
  }

  private func handleVitals(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as? [String: Any] ?? [:]
    switch call.method {
    case "isAvailable":
      result(["available": HKHealthStore.isHealthDataAvailable()])
    case "requestWritePermission":
      guard HKHealthStore.isHealthDataAvailable() else { result(["granted": false]); return }
      store.requestAuthorization(toShare: allShareTypes, read: []) { _, error in
        if let error {
          result(FlutterError(code: "permission_request_failed", message: error.localizedDescription, details: nil))
          return
        }
        guard let w = self.weightType else { result(["granted": false]); return }
        // One type is enough: all three were requested together.
        result(["granted": self.store.authorizationStatus(for: w) == .sharingAuthorized])
      }
    case "writeWeight":
      guard let type = weightType else { result(HealthChannels.error("healthkit_unavailable")); return }
      guard let kg = HealthChannels.double(args["kg"]) else { result(HealthChannels.error("kg_required")); return }
      let date = parseDate(args["date"] as? String)
      let sample = HKQuantitySample(type: type, quantity: HKQuantity(unit: .gramUnit(with: .kilo), doubleValue: kg), start: date, end: date)
      save(sample, result: result)
    case "writeBloodPressure":
      // Systolic + diastolic as ONE HKCorrelation, so Apple Health pairs them on its blood-pressure card.
      guard let sysType = systolicType, let diaType = diastolicType, let corrType = bpCorrelationType else {
        result(HealthChannels.error("healthkit_unavailable")); return
      }
      guard let sys = HealthChannels.double(args["systolic"]), let dia = HealthChannels.double(args["diastolic"]) else {
        result(HealthChannels.error("systolic_diastolic_required")); return
      }
      let date = parseDate(args["date"] as? String)
      let unit = HKUnit.millimeterOfMercury()
      let sysSample = HKQuantitySample(type: sysType, quantity: HKQuantity(unit: unit, doubleValue: sys), start: date, end: date)
      let diaSample = HKQuantitySample(type: diaType, quantity: HKQuantity(unit: unit, doubleValue: dia), start: date, end: date)
      save(HKCorrelation(type: corrType, start: date, end: date, objects: [sysSample, diaSample]), result: result)
    case "writeBloodGlucose":
      guard let type = glucoseType else { result(HealthChannels.error("healthkit_unavailable")); return }
      guard let mgdl = HealthChannels.double(args["mgdl"]) else { result(HealthChannels.error("mgdl_required")); return }
      let date = parseDate(args["date"] as? String)
      // mg/dL = gram(milli) / liter(deci)
      let unit = HKUnit.gramUnit(with: .milli).unitDivided(by: HKUnit.literUnit(with: .deci))
      save(HKQuantitySample(type: type, quantity: HKQuantity(unit: unit, doubleValue: mgdl), start: date, end: date), result: result)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func save(_ object: HKObject, result: @escaping FlutterResult) {
    store.save(object) { success, error in
      if let error {
        result(FlutterError(code: "write_failed", message: error.localizedDescription, details: nil))
        return
      }
      result(["written": success])
    }
  }

  private func parseDate(_ str: String?) -> Date {
    guard let str else { return Date() }
    // Dart sends "2026-10-31T10:00:00.000Z"; the default formatter rejects fractional seconds.
    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = fractional.date(from: str) { return date }
    return ISO8601DateFormatter().date(from: str) ?? Date()
  }
}
