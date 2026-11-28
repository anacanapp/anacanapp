package com.atlasoon.anacan

// Health Connect reads on channel "anacan/health": the method set of the capacitor-health 8.1.2 `Health` plugin the
// Capacitor app used (node_modules/capacitor-health/android/.../HealthPlugin.kt; same connect-client
// 1.2.0-alpha01). Same permission aliases, the same day buckets (local date-times, "2026-10-31T00:00"), units
// (count, kcal, m), workout fields and exercise-type names. Answers keep the plugin's shapes: {available},
// {permissions: {READ_X: bool}}, {aggregatedData: [{startDate, endDate, value}]}, {workouts: [...]}.
//
// Differences from the plugin: calls made before isHealthAvailable create the client instead of crashing on the
// uninitialised lateinit; heart-rate and route samples are not read (the app always passes includeHeartRate /
// includeRoute false and the manifest declares neither permission); "sourceName" is the device model once (the
// plugin concatenated it twice). Mindfulness is not a Health Connect data type of the plugin, so
// queryAggregated("mindfulness") fails here as it did there (health.ts never asks on Android).

import android.content.Intent
import android.net.Uri
import androidx.fragment.app.FragmentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.aggregate.AggregationResult
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.metadata.DataOrigin
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.Period
import java.time.ZoneId

/** Registers the "anacan/health" channel (MainActivity.configureFlutterEngine). */
class HealthReadsPlugin private constructor(
    private val activity: FragmentActivity,
    messenger: BinaryMessenger,
) : MethodChannel.MethodCallHandler {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val requests = HealthPermissionRequests(activity)
    private val channel = MethodChannel(messenger, CHANNEL)
    private var client: HealthConnectClient? = null

    init {
        channel.setMethodCallHandler(this)
    }

    fun detach() {
        channel.setMethodCallHandler(null)
        scope.cancel()
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "isHealthAvailable" -> {
                if (client == null) client = healthConnectClient(activity)
                result.success(mapOf("available" to (client != null)))
            }
            "checkHealthPermissions" -> checkHealthPermissions(call, result)
            "requestHealthPermissions" -> requestHealthPermissions(call, result)
            "queryAggregated" -> queryAggregated(call, result)
            "queryWorkouts" -> queryWorkouts(call, result)
            "openHealthConnectSettings" -> try {
                activity.startActivity(Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS))
                result.success(null)
            } catch (e: Exception) {
                result.error("open_settings_failed", e.message, null)
            }
            "showHealthConnectInPlayStore" -> try {
                val uri = Uri.parse("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata")
                activity.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                result.success(null)
            } catch (e: Exception) {
                result.error("open_store_failed", e.message, null)
            }
            // openAppleHealthSettings has no Android implementation in the plugin either.
            else -> result.notImplemented()
        }
    }

    private fun readyClient(): HealthConnectClient? {
        if (client == null) client = healthConnectClient(activity)
        return client
    }

    /** Requested aliases the plugin knows (unknown names are dropped, as CapHealthPermission.from did). */
    private fun aliases(call: MethodCall): Set<String>? =
        call.argument<List<String>>("permissions")?.filter { PERMISSIONS.containsKey(it) }?.toSet()

    private fun grantedResult(requested: Set<String>, granted: Set<String>): Map<String, Any> {
        val names = granted.map { it.substringAfterLast('.') }.toSet()
        return mapOf("permissions" to requested.associateWith { names.contains(PERMISSIONS.getValue(it).substringAfterLast('.')) })
    }

    private suspend fun hasPermission(hc: HealthConnectClient, alias: String): Boolean {
        val permission = PERMISSIONS[alias]?.substringAfterLast('.') ?: return false
        return hc.permissionController.getGrantedPermissions().map { it.substringAfterLast('.') }.contains(permission)
    }

    private fun checkHealthPermissions(call: MethodCall, result: MethodChannel.Result) {
        val requested = aliases(call) ?: return result.error("invalid_arguments", "Must provide permissions to check", null)
        val hc = readyClient() ?: return result.error("health_connect_unavailable", "Health Connect is not available", null)
        scope.launch {
            try {
                result.success(grantedResult(requested, hc.permissionController.getGrantedPermissions()))
            } catch (e: Exception) {
                result.error("check_failed", "Checking permissions failed: ${e.message}", null)
            }
        }
    }

    private fun requestHealthPermissions(call: MethodCall, result: MethodChannel.Result) {
        val requested = aliases(call) ?: return result.error("invalid_arguments", "Must provide permissions to request", null)
        if (readyClient() == null) return result.error("health_connect_unavailable", "Health Connect is not available", null)
        val healthConnectPermissions = requested.mapNotNull { PERMISSIONS[it] }.toSet()
        requests.request(healthConnectPermissions) { granted -> result.success(grantedResult(requested, granted)) }
    }

    private class Metric(val name: String, val permission: String, val metric: AggregateMetric<*>, val value: (AggregationResult) -> Double?)

    private fun metric(dataType: String): Metric = when (dataType) {
        "steps" -> Metric("steps", "READ_STEPS", StepsRecord.COUNT_TOTAL) { it[StepsRecord.COUNT_TOTAL]?.toDouble() }
        "active-calories" -> Metric("calories", "READ_ACTIVE_CALORIES", ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL) {
            it[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories
        }
        "total-calories" -> Metric("calories", "READ_TOTAL_CALORIES", TotalCaloriesBurnedRecord.ENERGY_TOTAL) {
            it[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories
        }
        "distance" -> Metric("distance", "READ_DISTANCE", DistanceRecord.DISTANCE_TOTAL) { it[DistanceRecord.DISTANCE_TOTAL]?.inMeters }
        else -> throw IllegalArgumentException("Unsupported dataType: $dataType")
    }

    /** queryAggregated({startDate, endDate, dataType, bucket: 'day', dataOrigins?}): ISO instants read as local date-times. */
    private fun queryAggregated(call: MethodCall, result: MethodChannel.Result) {
        try {
            val startDate = call.argument<String>("startDate")
            val endDate = call.argument<String>("endDate")
            val dataType = call.argument<String>("dataType")
            val bucket = call.argument<String>("bucket")
            if (startDate == null || endDate == null || dataType == null || bucket == null) {
                return result.error("invalid_arguments", "Missing required parameters: startDate, endDate, dataType, or bucket", null)
            }
            val zone = ZoneId.systemDefault()
            val start = Instant.parse(startDate).atZone(zone).toLocalDateTime()
            val end = Instant.parse(endDate).atZone(zone).toLocalDateTime()
            val m = metric(dataType)
            val period = when (bucket) {
                "day" -> Period.ofDays(1)
                else -> throw IllegalArgumentException("Unsupported bucket: $bucket")
            }
            val origins = call.argument<List<String>>("dataOrigins").orEmpty().filter { it.isNotEmpty() }.map { DataOrigin(it) }.toSet()
            val hc = readyClient() ?: return result.error("health_connect_unavailable", "Health Connect is not available", null)
            scope.launch {
                try {
                    if (!hasPermission(hc, m.permission)) {
                        result.success(mapOf("aggregatedData" to emptyList<Any>()))
                        return@launch
                    }
                    val groups = hc.aggregateGroupByPeriod(
                        AggregateGroupByPeriodRequest(
                            metrics = setOf(m.metric),
                            timeRangeFilter = TimeRangeFilter.between(start, end),
                            timeRangeSlicer = period,
                            dataOriginFilter = origins,
                        )
                    )
                    val data = groups.map { g ->
                        // JSObject.put(key, null) dropped the key; the same here.
                        val sample = mutableMapOf<String, Any>("startDate" to g.startTime.toString(), "endDate" to g.endTime.toString())
                        m.value(g.result)?.let { sample["value"] = it }
                        sample
                    }
                    result.success(mapOf("aggregatedData" to data))
                } catch (e: Exception) {
                    result.error("query_failed", "Error querying aggregated data: ${e.message}", null)
                }
            }
        } catch (e: Exception) {
            result.error("query_failed", e.message, null)
        }
    }

    /** queryWorkouts({startDate, endDate, includeHeartRate, includeRoute, includeSteps}): exercise sessions. */
    private fun queryWorkouts(call: MethodCall, result: MethodChannel.Result) {
        val startDate = call.argument<String>("startDate")
        val endDate = call.argument<String>("endDate")
        val includeSteps = call.argument<Boolean>("includeSteps") == true
        if (startDate == null || endDate == null) {
            return result.error("invalid_arguments", "Missing required parameters: startDate or endDate", null)
        }
        val hc = readyClient() ?: return result.error("health_connect_unavailable", "Health Connect is not available", null)
        val zone = ZoneId.systemDefault()
        val range = try {
            TimeRangeFilter.between(Instant.parse(startDate).atZone(zone).toLocalDateTime(), Instant.parse(endDate).atZone(zone).toLocalDateTime())
        } catch (e: Exception) {
            return result.error("invalid_arguments", e.message, null)
        }
        scope.launch {
            try {
                val response = hc.readRecords(
                    ReadRecordsRequest(
                        recordType = ExerciseSessionRecord::class,
                        timeRangeFilter = range,
                        dataOriginFilter = emptySet(),
                        ascendingOrder = true,
                        pageSize = 1000,
                    )
                )
                val workouts = response.records.map { w ->
                    val o = mutableMapOf<String, Any?>(
                        "id" to w.metadata.id,
                        "sourceName" to (w.metadata.device?.model ?: ""),
                        "sourceBundleId" to w.metadata.dataOrigin.packageName,
                        "startDate" to w.startTime.toString(),
                        "endDate" to w.endTime.toString(),
                        "workoutType" to (EXERCISE_TYPES[w.exerciseType] ?: "OTHER"),
                        "title" to w.title,
                        "duration" to if (w.segments.isEmpty()) {
                            w.endTime.epochSecond - w.startTime.epochSecond
                        } else {
                            w.segments.sumOf { it.endTime.epochSecond - it.startTime.epochSecond }
                        },
                    )
                    if (includeSteps) addWorkoutMetric(hc, w, o, metric("steps"))
                    if (!addWorkoutMetric(hc, w, o, metric("total-calories"))) addWorkoutMetric(hc, w, o, metric("active-calories"))
                    addWorkoutMetric(hc, w, o, metric("distance"))
                    o
                }
                result.success(mapOf("workouts" to workouts))
            } catch (e: Exception) {
                result.error("query_failed", "Error querying workouts: ${e.message}", null)
            }
        }
    }

    private suspend fun addWorkoutMetric(hc: HealthConnectClient, w: ExerciseSessionRecord, o: MutableMap<String, Any?>, m: Metric): Boolean {
        if (!hasPermission(hc, m.permission)) return false
        return try {
            val value = m.value(hc.aggregate(AggregateRequest(setOf(m.metric), TimeRangeFilter.between(w.startTime, w.endTime), emptySet())))
            if (value != null) {
                o[m.name] = value
                true
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }

    companion object {
        const val CHANNEL = "anacan/health"

        fun register(activity: FragmentActivity, messenger: BinaryMessenger): HealthReadsPlugin = HealthReadsPlugin(activity, messenger)

        /** capacitor-health CapHealthPermission → Health Connect permission. */
        private val PERMISSIONS = mapOf(
            "READ_WORKOUTS" to "android.permission.health.READ_EXERCISE",
            "READ_ROUTE" to "android.permission.health.READ_EXERCISE_ROUTE",
            "READ_HEART_RATE" to "android.permission.health.READ_HEART_RATE",
            "READ_ACTIVE_CALORIES" to "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
            "READ_TOTAL_CALORIES" to "android.permission.health.READ_TOTAL_CALORIES_BURNED",
            "READ_DISTANCE" to "android.permission.health.READ_DISTANCE",
            "READ_STEPS" to "android.permission.health.READ_STEPS",
        )

        /** The plugin's ExerciseSessionRecord type names. */
        private val EXERCISE_TYPES = mapOf(
            0 to "OTHER", 2 to "BADMINTON", 4 to "BASEBALL", 5 to "BASKETBALL", 8 to "BIKING", 9 to "BIKING_STATIONARY",
            10 to "BOOT_CAMP", 11 to "BOXING", 13 to "CALISTHENICS", 14 to "CRICKET", 16 to "DANCING", 25 to "ELLIPTICAL",
            26 to "EXERCISE_CLASS", 27 to "FENCING", 28 to "FOOTBALL_AMERICAN", 29 to "FOOTBALL_AUSTRALIAN",
            31 to "FRISBEE_DISC", 32 to "GOLF", 33 to "GUIDED_BREATHING", 34 to "GYMNASTICS", 35 to "HANDBALL",
            36 to "HIGH_INTENSITY_INTERVAL_TRAINING", 37 to "HIKING", 38 to "ICE_HOCKEY", 39 to "ICE_SKATING",
            44 to "MARTIAL_ARTS", 46 to "PADDLING", 47 to "PARAGLIDING", 48 to "PILATES", 50 to "RACQUETBALL",
            51 to "ROCK_CLIMBING", 52 to "ROLLER_HOCKEY", 53 to "ROWING", 54 to "ROWING_MACHINE", 55 to "RUGBY",
            56 to "RUNNING", 57 to "RUNNING_TREADMILL", 58 to "SAILING", 59 to "SCUBA_DIVING", 60 to "SKATING",
            61 to "SKIING", 62 to "SNOWBOARDING", 63 to "SNOWSHOEING", 64 to "SOCCER", 65 to "SOFTBALL", 66 to "SQUASH",
            68 to "STAIR_CLIMBING", 69 to "STAIR_CLIMBING_MACHINE", 70 to "STRENGTH_TRAINING", 71 to "STRETCHING",
            72 to "SURFING", 73 to "SWIMMING_OPEN_WATER", 74 to "SWIMMING_POOL", 75 to "TABLE_TENNIS", 76 to "TENNIS",
            78 to "VOLLEYBALL", 79 to "WALKING", 80 to "WATER_POLO", 81 to "WEIGHTLIFTING", 82 to "WHEELCHAIR", 83 to "YOGA",
        )
    }
}
