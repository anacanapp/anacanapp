import Flutter
import Foundation
import HealthKit
import UIKit

/// HealthKit reads on channel "anacan/health": the method set of the capacitor-health 8.1.2 `Health` plugin the
/// Capacitor app used (node_modules/capacitor-health/ios/Sources/HealthPluginPlugin/HealthPlugin.swift). Same
/// permission aliases, the same buckets (steps: HKStatisticsCollectionQuery anchored at startDate, epoch-ms bucket
/// starts, count; mindfulness: seconds per local start of day, ISO bucket starts), workout fields and type names.
/// Answers keep the plugin's shapes; Dates are sent as ISO 8601 strings, as Capacitor's bridge serialised them.
/// Needs the HealthKit entitlement and NSHealthShareUsageDescription (both already in the Runner).
///
/// Differences from the plugin: an empty permission set answers all-false instead of raising HealthKit's
/// exception; heart-rate and route samples are not read (the app always passes false); results are delivered on the
/// main thread. checkHealthPermissions rejects "not implemented" as the plugin did (HealthKit hides read grants).
final class HealthReadsChannel {
  private let store = HKHealthStore()
  private let channel: FlutterMethodChannel

  init(messenger: FlutterBinaryMessenger) {
    channel = FlutterMethodChannel(name: "anacan/health", binaryMessenger: messenger)
    channel.setMethodCallHandler { [weak self] call, result in
      guard let self else { result(FlutterMethodNotImplemented); return }
      self.handle(call, result: HealthReadsChannel.onMain(result))
    }
  }

  private static func onMain(_ result: @escaping FlutterResult) -> FlutterResult {
    return { value in
      if Thread.isMainThread { result(value) } else { DispatchQueue.main.async { result(value) } }
    }
  }

  private static func reject(_ message: String, code: String = "health_error") -> FlutterError {
    FlutterError(code: code, message: message, details: nil)
  }

  private func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as? [String: Any] ?? [:]
    switch call.method {
    case "isHealthAvailable":
      result(["available": HKHealthStore.isHealthDataAvailable()])
    case "checkHealthPermissions":
      result(HealthReadsChannel.reject("not implemented", code: "not_implemented"))
    case "requestHealthPermissions":
      requestHealthPermissions(args, result: result)
    case "openAppleHealthSettings":
      guard let url = URL(string: UIApplication.openSettingsURLString) else {
        result(HealthReadsChannel.reject("Unable to open app-specific settings"))
        return
      }
      DispatchQueue.main.async {
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
        result(nil)
      }
    case "queryAggregated":
      queryAggregated(args, result: result)
    case "queryWorkouts":
      queryWorkouts(args, result: result)
    default:
      // openHealthConnectSettings / showHealthConnectInPlayStore are Android-only in the plugin too.
      result(FlutterMethodNotImplemented)
    }
  }

  // MARK: Permissions

  private func readTypes(_ permission: String) -> [HKObjectType] {
    switch permission {
    case "READ_STEPS": return [HKObjectType.quantityType(forIdentifier: .stepCount)].compactMap { $0 }
    case "READ_ACTIVE_CALORIES": return [HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)].compactMap { $0 }
    case "READ_WORKOUTS": return [HKObjectType.workoutType()]
    case "READ_HEART_RATE": return [HKObjectType.quantityType(forIdentifier: .heartRate)].compactMap { $0 }
    case "READ_ROUTE": return [HKSeriesType.workoutRoute()]
    case "READ_DISTANCE":
      return [
        HKObjectType.quantityType(forIdentifier: .distanceCycling),
        HKObjectType.quantityType(forIdentifier: .distanceSwimming),
        HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning),
        HKObjectType.quantityType(forIdentifier: .distanceDownhillSnowSports),
      ].compactMap { $0 }
    case "READ_MINDFULNESS": return [HKObjectType.categoryType(forIdentifier: .mindfulSession)].compactMap { $0 }
    default: return []
    }
  }

  private func shareTypes(_ permission: String) -> [HKSampleType] {
    permission == "WRITE_WORKOUTS" ? [HKObjectType.workoutType()] : []
  }

  private func requestHealthPermissions(_ args: [String: Any], result: @escaping FlutterResult) {
    guard let permissions = args["permissions"] as? [String] else {
      result(HealthReadsChannel.reject("Invalid permissions format"))
      return
    }
    let read = Set(permissions.flatMap { readTypes($0) })
    let share = Set(permissions.flatMap { shareTypes($0) })
    func answer(_ granted: Bool) -> [String: Any] {
      var map: [String: Bool] = [:]
      permissions.forEach { map[$0] = granted }
      return ["permissions": map]
    }
    guard !read.isEmpty || !share.isEmpty else { result(answer(false)); return }
    store.requestAuthorization(toShare: share, read: read) { success, error in
      if success {
        // HealthKit does not say which reads were allowed; like the plugin, assume all.
        result(answer(true))
      } else if let error {
        result(HealthReadsChannel.reject("Authorization failed: \(error.localizedDescription)"))
      } else {
        result(answer(false))
      }
    }
  }

  // MARK: Queries

  /// Dart sends "2026-10-31T20:00:00.000Z" (the plugin's formatter: internet date-time with fractional seconds).
  private func parseDate(_ value: Any?) -> Date? {
    guard let str = value as? String else { return nil }
    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return fractional.date(from: str) ?? ISO8601DateFormatter().date(from: str)
  }

  /// Capacitor's bridge turned Date values into ISO8601DateFormatter() strings.
  private let outputFormatter = ISO8601DateFormatter()

  private func quantityType(_ dataType: String) -> HKQuantityType? {
    switch dataType {
    case "steps": return HKObjectType.quantityType(forIdentifier: .stepCount)
    case "active-calories": return HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)
    default: return nil
    }
  }

  private func interval(_ bucket: String) -> DateComponents? {
    switch bucket {
    case "hour": return DateComponents(hour: 1)
    case "day": return DateComponents(day: 1)
    case "week": return DateComponents(weekOfYear: 1)
    default: return nil
    }
  }

  private func queryAggregated(_ args: [String: Any], result: @escaping FlutterResult) {
    guard let dataTypeString = args["dataType"] as? String,
          let bucket = args["bucket"] as? String,
          let startDate = parseDate(args["startDate"]),
          let endDate = parseDate(args["endDate"]) else {
      result(HealthReadsChannel.reject("Invalid parameters"))
      return
    }
    if dataTypeString == "mindfulness" {
      queryMindfulness(startDate: startDate, endDate: endDate, result: result)
      return
    }
    guard let dataType = quantityType(dataTypeString) else { result(HealthReadsChannel.reject("Invalid data type")); return }
    guard let components = interval(bucket) else { result(HealthReadsChannel.reject("Invalid bucket")); return }
    let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
    let query = HKStatisticsCollectionQuery(
      quantityType: dataType,
      quantitySamplePredicate: predicate,
      options: [.cumulativeSum],
      anchorDate: startDate,
      intervalComponents: components
    )
    query.initialResultsHandler = { _, collection, error in
      if let error {
        result(HealthReadsChannel.reject("Error fetching aggregated data: \(error.localizedDescription)"))
        return
      }
      var samples: [[String: Any]] = []
      collection?.enumerateStatistics(from: startDate, to: endDate) { statistics, _ in
        guard let sum = statistics.sumQuantity() else { return }
        var value = -1.0
        if dataTypeString == "steps" && dataType.is(compatibleWith: HKUnit.count()) {
          value = sum.doubleValue(for: HKUnit.count())
        } else if dataTypeString == "active-calories" && dataType.is(compatibleWith: HKUnit.kilocalorie()) {
          value = sum.doubleValue(for: HKUnit.kilocalorie())
        }
        samples.append([
          "startDate": statistics.startDate.timeIntervalSince1970 * 1000,
          "endDate": statistics.endDate.timeIntervalSince1970 * 1000,
          "value": value,
        ])
      }
      result(["aggregatedData": samples])
    }
    store.execute(query)
  }

  /// Mindful sessions summed per local start of day (seconds).
  private func queryMindfulness(startDate: Date, endDate: Date, result: @escaping FlutterResult) {
    guard let type = HKObjectType.categoryType(forIdentifier: .mindfulSession) else {
      result(HealthReadsChannel.reject("MindfulSession type unavailable"))
      return
    }
    let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
    let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
      guard error == nil, let categorySamples = samples as? [HKCategorySample] else {
        result(HealthReadsChannel.reject(error?.localizedDescription ?? "Error querying mindfulness"))
        return
      }
      let calendar = Calendar.current
      var daily: [Date: TimeInterval] = [:]
      for sample in categorySamples {
        let day = calendar.startOfDay(for: sample.startDate)
        daily[day, default: 0] += sample.endDate.timeIntervalSince(sample.startDate)
      }
      let data: [[String: Any]] = daily.map { item -> [String: Any] in
        var entry: [String: Any] = ["startDate": self.outputFormatter.string(from: item.key), "value": item.value]
        if let next = calendar.date(byAdding: .day, value: 1, to: item.key) { entry["endDate"] = self.outputFormatter.string(from: next) }
        return entry
      }
      result(["aggregatedData": data])
    }
    store.execute(query)
  }

  private func queryWorkouts(_ args: [String: Any], result: @escaping FlutterResult) {
    guard let startDate = parseDate(args["startDate"]),
          let endDate = parseDate(args["endDate"]),
          args["includeHeartRate"] is Bool,
          args["includeRoute"] is Bool,
          let includeSteps = args["includeSteps"] as? Bool else {
      result(HealthReadsChannel.reject("Invalid parameters"))
      return
    }
    let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
    let query = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
      if let error {
        result(HealthReadsChannel.reject("Error querying workouts: \(error.localizedDescription)"))
        return
      }
      let workouts = samples as? [HKWorkout] ?? []
      var list: [[String: Any]] = workouts.map { workout -> [String: Any] in
        return [
          "startDate": self.outputFormatter.string(from: workout.startDate),
          "endDate": self.outputFormatter.string(from: workout.endDate),
          "workoutType": HealthReadsChannel.workoutTypes[workout.workoutActivityType.rawValue, default: "other"],
          "sourceName": workout.sourceRevision.source.name,
          "sourceBundleId": workout.sourceRevision.source.bundleIdentifier,
          "id": workout.uuid.uuidString,
          "duration": workout.duration,
          "calories": workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0,
          "distance": workout.totalDistance?.doubleValue(for: .meter()) ?? 0,
          "heartRate": [[String: Any]](),
          "route": [[String: Any]](),
        ]
      }
      let group = DispatchGroup()
      if includeSteps, let stepType = HKObjectType.quantityType(forIdentifier: .stepCount) {
        for (index, workout) in workouts.enumerated() {
          group.enter()
          let stepsPredicate = HKQuery.predicateForSamples(withStart: workout.startDate, end: workout.endDate, options: .strictStartDate)
          let stepsQuery = HKStatisticsQuery(quantityType: stepType, quantitySamplePredicate: stepsPredicate, options: .cumulativeSum) { _, stats, _ in
            let steps = stats?.sumQuantity()?.doubleValue(for: HKUnit.count()) ?? 0
            DispatchQueue.main.async {
              list[index]["steps"] = steps
              group.leave()
            }
          }
          self.store.execute(stepsQuery)
        }
      }
      group.notify(queue: .main) {
        result(["workouts": list, "errors": [String: String]()])
      }
    }
    store.execute(query)
  }

  /// The plugin's HKWorkoutActivityType names.
  private static let workoutTypes: [UInt: String] = [
    1: "americanFootball", 2: "archery", 3: "australianFootball", 4: "badminton", 5: "baseball", 6: "basketball",
    7: "bowling", 8: "boxing", 9: "climbing", 10: "cricket", 11: "crossTraining", 12: "curling", 13: "cycling",
    14: "dance", 15: "danceInspiredTraining", 16: "elliptical", 17: "equestrianSports", 18: "fencing", 19: "fishing",
    20: "functionalStrengthTraining", 21: "golf", 22: "gymnastics", 23: "handball", 24: "hiking", 25: "hockey",
    26: "hunting", 27: "lacrosse", 28: "martialArts", 29: "mindAndBody", 30: "mixedMetabolicCardioTraining",
    31: "paddleSports", 32: "play", 33: "preparationAndRecovery", 34: "racquetball", 35: "rowing", 36: "rugby",
    37: "running", 38: "sailing", 39: "skatingSports", 40: "snowSports", 41: "soccer", 42: "softball", 43: "squash",
    44: "stairClimbing", 45: "surfingSports", 46: "swimming", 47: "tableTennis", 48: "tennis", 49: "trackAndField",
    50: "traditionalStrengthTraining", 51: "volleyball", 52: "walking", 53: "waterFitness", 54: "waterPolo",
    55: "waterSports", 56: "wrestling", 57: "yoga", 58: "barre", 59: "coreTraining", 60: "crossCountrySkiing",
    61: "downhillSkiing", 62: "flexibility", 63: "highIntensityIntervalTraining", 64: "jumpRope", 65: "kickboxing",
    66: "pilates", 67: "snowboarding", 68: "stairs", 69: "stepTraining", 70: "wheelchairWalkPace",
    71: "wheelchairRunPace", 72: "taiChi", 73: "mixedCardio", 74: "handCycling", 75: "discSports", 76: "fitnessGaming",
    77: "cardioDance", 78: "socialDance", 79: "pickleball", 80: "cooldown", 82: "swimBikeRun", 83: "transition",
    84: "underwaterDiving", 3000: "other",
  ]
}
