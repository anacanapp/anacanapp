package com.atlasoon.anacan

import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.units.BloodGlucose
import androidx.health.connect.client.units.Mass
import androidx.health.connect.client.units.Pressure
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneOffset

/**
 * HealthVitals — çəki / qan təzyiqi / qan şəkəri ölçmələrinin Google Health Connect-ə
 * YAZILMASI. (capacitor-health plugini bunları dəstəkləmir; HealthCyclePlugin ilə
 * eyni məntiq, ayrı, müstəqil plugin.)
 *
 * JS tərəfi: src/lib/healthVitals.ts
 */
@CapacitorPlugin(name = "HealthVitals")
class HealthVitalsPlugin : Plugin() {

    // Bütün 3 ölçünün yazma icazəsi TƏK dəfəyə istənilir (Settings-də tək toggle).
    private val writePermissions = setOf(
        HealthPermission.getWritePermission(WeightRecord::class),
        HealthPermission.getWritePermission(BloodPressureRecord::class),
        HealthPermission.getWritePermission(BloodGlucoseRecord::class)
    )
    private val permissionContract = PermissionController.createRequestPermissionResultContract()
    private val scope = CoroutineScope(Dispatchers.IO)

    private fun client(): HealthConnectClient? {
        return try {
            if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) {
                HealthConnectClient.getOrCreate(context)
            } else null
        } catch (e: Exception) {
            null
        }
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val ret = JSObject()
        ret.put("available", client() != null)
        call.resolve(ret)
    }

    @PluginMethod
    fun requestWritePermission(call: PluginCall) {
        val hc = client()
        if (hc == null) {
            val ret = JSObject()
            ret.put("granted", false)
            call.resolve(ret)
            return
        }
        scope.launch {
            try {
                val granted = hc.permissionController.getGrantedPermissions()
                if (granted.containsAll(writePermissions)) {
                    val ret = JSObject()
                    ret.put("granted", true)
                    call.resolve(ret)
                    return@launch
                }
                activity.runOnUiThread {
                    val intent = permissionContract.createIntent(context, writePermissions)
                    startActivityForResult(call, intent, "permResult")
                }
            } catch (e: Exception) {
                call.reject("permission_check_failed", e)
            }
        }
    }

    @ActivityCallback
    private fun permResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val grantedSet = permissionContract.parseResult(result.resultCode, result.data)
        val ret = JSObject()
        ret.put("granted", grantedSet.containsAll(writePermissions))
        call.resolve(ret)
    }

    private fun instantFromIso(dateStr: String?): Instant {
        return try {
            if (dateStr != null) Instant.parse(dateStr) else Instant.now()
        } catch (e: Exception) {
            Instant.now()
        }
    }

    /** writeWeight({ kg: number, date?: 'ISO8601' }) */
    @PluginMethod
    fun writeWeight(call: PluginCall) {
        val hc = client() ?: run { call.reject("health_connect_unavailable"); return }
        val kg = call.getDouble("kg") ?: run { call.reject("kg_required"); return }
        val time = instantFromIso(call.getString("date"))

        scope.launch {
            try {
                val granted = hc.permissionController.getGrantedPermissions()
                val perm = HealthPermission.getWritePermission(WeightRecord::class)
                if (!granted.contains(perm)) {
                    call.reject("write_permission_missing")
                    return@launch
                }

                hc.insertRecords(
                    listOf(
                        WeightRecord(
                            time = time,
                            zoneOffset = ZoneOffset.UTC,
                            weight = Mass.kilograms(kg),
                            metadata = Metadata.manualEntry()
                        )
                    )
                )
                val ret = JSObject()
                ret.put("written", true)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("write_failed: ${e.message}", e)
            }
        }
    }

    /** writeBloodPressure({ systolic: number, diastolic: number, date?: 'ISO8601' }) */
    @PluginMethod
    fun writeBloodPressure(call: PluginCall) {
        val hc = client() ?: run { call.reject("health_connect_unavailable"); return }
        val sys = call.getDouble("systolic") ?: run { call.reject("systolic_required"); return }
        val dia = call.getDouble("diastolic") ?: run { call.reject("diastolic_required"); return }
        val time = instantFromIso(call.getString("date"))

        scope.launch {
            try {
                val granted = hc.permissionController.getGrantedPermissions()
                val perm = HealthPermission.getWritePermission(BloodPressureRecord::class)
                if (!granted.contains(perm)) {
                    call.reject("write_permission_missing")
                    return@launch
                }

                hc.insertRecords(
                    listOf(
                        BloodPressureRecord(
                            time = time,
                            zoneOffset = ZoneOffset.UTC,
                            systolic = Pressure.millimetersOfMercury(sys),
                            diastolic = Pressure.millimetersOfMercury(dia),
                            metadata = Metadata.manualEntry()
                        )
                    )
                )
                val ret = JSObject()
                ret.put("written", true)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("write_failed: ${e.message}", e)
            }
        }
    }

    /** writeBloodGlucose({ mgdl: number, date?: 'ISO8601' }) */
    @PluginMethod
    fun writeBloodGlucose(call: PluginCall) {
        val hc = client() ?: run { call.reject("health_connect_unavailable"); return }
        val mgdl = call.getDouble("mgdl") ?: run { call.reject("mgdl_required"); return }
        val time = instantFromIso(call.getString("date"))

        scope.launch {
            try {
                val granted = hc.permissionController.getGrantedPermissions()
                val perm = HealthPermission.getWritePermission(BloodGlucoseRecord::class)
                if (!granted.contains(perm)) {
                    call.reject("write_permission_missing")
                    return@launch
                }

                hc.insertRecords(
                    listOf(
                        BloodGlucoseRecord(
                            time = time,
                            zoneOffset = ZoneOffset.UTC,
                            level = BloodGlucose.milligramsPerDeciliter(mgdl),
                            metadata = Metadata.manualEntry()
                        )
                    )
                )
                val ret = JSObject()
                ret.put("written", true)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("write_failed: ${e.message}", e)
            }
        }
    }
}
