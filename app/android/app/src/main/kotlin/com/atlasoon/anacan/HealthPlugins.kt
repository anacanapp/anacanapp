package com.atlasoon.anacan

// Health Connect channels "anacan/health_cycle" / "anacan/health_vitals". Gradle (app/build.gradle.kts):
//   androidx.health.connect:connect-client:1.2.0-alpha01, org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0
// (same versions as the Capacitor android/app/build.gradle).
//
// Ported from the Capacitor app's HealthCyclePlugin.kt and HealthVitalsPlugin.kt (same validation, same records,
// same error strings). Capacitor's startActivityForResult/@ActivityCallback becomes an ActivityResultRegistry
// registration on the FlutterFragmentActivity (registered and unregistered per request, so it can be called after
// onCreate).

import androidx.activity.result.ActivityResultLauncher
import androidx.fragment.app.FragmentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.MenstruationFlowRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.BloodGlucose
import androidx.health.connect.client.units.Mass
import androidx.health.connect.client.units.Pressure
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import java.util.concurrent.atomic.AtomicInteger

/** Registers the "anacan/health_cycle" and "anacan/health_vitals" channels (MainActivity.configureFlutterEngine). */
class HealthPlugins private constructor(activity: FragmentActivity, messenger: BinaryMessenger) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val requests = HealthPermissionRequests(activity)
    private val cycle = MethodChannel(messenger, HealthCyclePlugin.CHANNEL)
    private val vitals = MethodChannel(messenger, HealthVitalsPlugin.CHANNEL)

    init {
        cycle.setMethodCallHandler(HealthCyclePlugin(activity, scope, requests))
        vitals.setMethodCallHandler(HealthVitalsPlugin(activity, scope, requests))
    }

    fun detach() {
        cycle.setMethodCallHandler(null)
        vitals.setMethodCallHandler(null)
        scope.cancel()
    }

    companion object {
        fun register(activity: FragmentActivity, messenger: BinaryMessenger): HealthPlugins = HealthPlugins(activity, messenger)
    }
}

/** Health Connect permission dialog through the activity's result registry. */
internal class HealthPermissionRequests(private val activity: FragmentActivity) {
    private val contract = PermissionController.createRequestPermissionResultContract()
    private val counter = AtomicInteger()

    fun request(permissions: Set<String>, onResult: (Set<String>) -> Unit) {
        activity.runOnUiThread {
            try {
                var launcher: ActivityResultLauncher<Set<String>>? = null
                launcher = activity.activityResultRegistry.register("anacan_health_permissions_${counter.incrementAndGet()}", contract) { granted ->
                    launcher?.unregister()
                    onResult(granted ?: emptySet())
                }
                launcher.launch(permissions)
            } catch (error: Exception) {
                onResult(emptySet())
            }
        }
    }
}

internal fun healthConnectClient(activity: FragmentActivity): HealthConnectClient? = try {
    if (HealthConnectClient.getSdkStatus(activity) == HealthConnectClient.SDK_AVAILABLE) HealthConnectClient.getOrCreate(activity) else null
} catch (e: Exception) {
    null
}

/**
 * HealthCycle — menstruasiya məlumatının Google Health Connect-ə YAZILMASI.
 * Channel "anacan/health_cycle": isAvailable -> {available, apiVersion: 2}, requestWritePermission -> {granted},
 * writeMenstruation {startDate, endDate, flow, cycleStart} -> {written}.
 */
internal class HealthCyclePlugin(
    private val activity: FragmentActivity,
    private val scope: CoroutineScope,
    private val requests: HealthPermissionRequests,
) : MethodChannel.MethodCallHandler {
    private val writePermission = HealthPermission.getWritePermission(MenstruationFlowRecord::class)

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "isAvailable" -> result.success(mapOf("available" to (healthConnectClient(activity) != null), "apiVersion" to 2))
            "requestWritePermission" -> requestWritePermission(result)
            "writeMenstruation" -> writeMenstruation(call, result)
            else -> result.notImplemented()
        }
    }

    private fun requestWritePermission(result: MethodChannel.Result) {
        val hc = healthConnectClient(activity) ?: return result.success(mapOf("granted" to false))
        scope.launch {
            try {
                if (hc.permissionController.getGrantedPermissions().contains(writePermission)) {
                    result.success(mapOf("granted" to true))
                    return@launch
                }
                requests.request(setOf(writePermission)) { granted ->
                    result.success(mapOf("granted" to granted.contains(writePermission)))
                }
            } catch (e: Exception) {
                result.error("permission_check_failed", e.message, null)
            }
        }
    }

    /** writeMenstruation({ startDate: 'yyyy-MM-dd', endDate: 'yyyy-MM-dd', flow }): one record per day. */
    private fun writeMenstruation(call: MethodCall, result: MethodChannel.Result) {
        val hc = healthConnectClient(activity) ?: return result.error("health_connect_unavailable", null, null)
        val startStr = call.argument<String>("startDate") ?: return result.error("startDate_required", null, null)
        val endStr = call.argument<String>("endDate") ?: startStr
        val flowStr = call.argument<String>("flow") ?: "unspecified"
        if (flowStr !in setOf("unspecified", "light", "medium", "heavy", "none", "clear")) {
            return result.error("invalid_flow", null, null)
        }
        val flowValue = when (flowStr) {
            "light" -> MenstruationFlowRecord.FLOW_LIGHT
            "heavy" -> MenstruationFlowRecord.FLOW_HEAVY
            "medium" -> MenstruationFlowRecord.FLOW_MEDIUM
            else -> MenstruationFlowRecord.FLOW_UNKNOWN
        }
        scope.launch {
            try {
                if (!hc.permissionController.getGrantedPermissions().contains(writePermission)) {
                    result.error("write_permission_missing", null, null)
                    return@launch
                }
                val start = LocalDate.parse(startStr)
                val end = LocalDate.parse(endStr)
                val zone = ZoneId.systemDefault()
                if (start.isAfter(end) || end.isAfter(LocalDate.now(zone)) || ChronoUnit.DAYS.between(start, end) >= 90) {
                    result.error("invalid_dates", null, null)
                    return@launch
                }
                // Health Connect limits deletion to records authored by this app.
                hc.deleteRecords(
                    MenstruationFlowRecord::class,
                    TimeRangeFilter.between(start.atStartOfDay(zone).toInstant(), end.plusDays(1).atStartOfDay(zone).toInstant())
                )
                val records = mutableListOf<MenstruationFlowRecord>()
                var d = start
                while (!d.isAfter(end) && flowStr != "none" && flowStr != "clear") {
                    // Günorta vaxtı — timezone kənarlarından qaçmaq üçün
                    val local = d.atTime(12, 0).atZone(zone)
                    records.add(MenstruationFlowRecord(time = local.toInstant(), zoneOffset = local.offset, flow = flowValue, metadata = Metadata.manualEntry()))
                    d = d.plusDays(1)
                }
                if (records.isNotEmpty()) hc.insertRecords(records)
                result.success(mapOf("written" to records.size))
            } catch (e: Exception) {
                result.error("write_failed: ${e.message}", null, null)
            }
        }
    }

    companion object {
        const val CHANNEL = "anacan/health_cycle"
    }
}

/**
 * HealthVitals — çəki / qan təzyiqi / qan şəkəri ölçmələrinin Google Health Connect-ə YAZILMASI.
 * Channel "anacan/health_vitals": isAvailable -> {available}, requestWritePermission -> {granted},
 * writeWeight {kg, date?}, writeBloodPressure {systolic, diastolic, date?}, writeBloodGlucose {mgdl, date?} -> {written: true}.
 */
internal class HealthVitalsPlugin(
    private val activity: FragmentActivity,
    private val scope: CoroutineScope,
    private val requests: HealthPermissionRequests,
) : MethodChannel.MethodCallHandler {
    // Bütün 3 ölçünün yazma icazəsi TƏK dəfəyə istənilir (Settings-də tək toggle).
    private val writePermissions = setOf(
        HealthPermission.getWritePermission(WeightRecord::class),
        HealthPermission.getWritePermission(BloodPressureRecord::class),
        HealthPermission.getWritePermission(BloodGlucoseRecord::class)
    )

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "isAvailable" -> result.success(mapOf("available" to (healthConnectClient(activity) != null)))
            "requestWritePermission" -> requestWritePermission(result)
            "writeWeight" -> {
                val kg = call.argument<Number>("kg")?.toDouble() ?: return result.error("kg_required", null, null)
                val time = instantFromIso(call.argument<String>("date"))
                write(result, HealthPermission.getWritePermission(WeightRecord::class)) {
                    WeightRecord(time = time, zoneOffset = ZoneId.systemDefault().rules.getOffset(time), weight = Mass.kilograms(kg), metadata = Metadata.manualEntry())
                }
            }
            "writeBloodPressure" -> {
                val sys = call.argument<Number>("systolic")?.toDouble() ?: return result.error("systolic_required", null, null)
                val dia = call.argument<Number>("diastolic")?.toDouble() ?: return result.error("diastolic_required", null, null)
                val time = instantFromIso(call.argument<String>("date"))
                write(result, HealthPermission.getWritePermission(BloodPressureRecord::class)) {
                    BloodPressureRecord(
                        time = time,
                        zoneOffset = ZoneId.systemDefault().rules.getOffset(time),
                        systolic = Pressure.millimetersOfMercury(sys),
                        diastolic = Pressure.millimetersOfMercury(dia),
                        metadata = Metadata.manualEntry()
                    )
                }
            }
            "writeBloodGlucose" -> {
                val mgdl = call.argument<Number>("mgdl")?.toDouble() ?: return result.error("mgdl_required", null, null)
                val time = instantFromIso(call.argument<String>("date"))
                write(result, HealthPermission.getWritePermission(BloodGlucoseRecord::class)) {
                    BloodGlucoseRecord(time = time, zoneOffset = ZoneId.systemDefault().rules.getOffset(time), level = BloodGlucose.milligramsPerDeciliter(mgdl), metadata = Metadata.manualEntry())
                }
            }
            else -> result.notImplemented()
        }
    }

    private fun requestWritePermission(result: MethodChannel.Result) {
        val hc = healthConnectClient(activity) ?: return result.success(mapOf("granted" to false))
        scope.launch {
            try {
                if (hc.permissionController.getGrantedPermissions().containsAll(writePermissions)) {
                    result.success(mapOf("granted" to true))
                    return@launch
                }
                requests.request(writePermissions) { granted ->
                    result.success(mapOf("granted" to granted.containsAll(writePermissions)))
                }
            } catch (e: Exception) {
                result.error("permission_check_failed", e.message, null)
            }
        }
    }

    private fun write(result: MethodChannel.Result, permission: String, record: () -> androidx.health.connect.client.records.Record) {
        val hc = healthConnectClient(activity) ?: return result.error("health_connect_unavailable", null, null)
        scope.launch {
            try {
                if (!hc.permissionController.getGrantedPermissions().contains(permission)) {
                    result.error("write_permission_missing", null, null)
                    return@launch
                }
                hc.insertRecords(listOf(record()))
                result.success(mapOf("written" to true))
            } catch (e: Exception) {
                result.error("write_failed: ${e.message}", null, null)
            }
        }
    }

    private fun instantFromIso(dateStr: String?): Instant = try {
        if (dateStr != null) Instant.parse(dateStr) else Instant.now()
    } catch (e: Exception) {
        Instant.now()
    }

    companion object {
        const val CHANNEL = "anacan/health_vitals"
    }
}
