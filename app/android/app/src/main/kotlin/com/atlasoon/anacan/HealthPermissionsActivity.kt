package com.atlasoon.anacan

import android.app.Activity
import android.os.Bundle
import android.text.method.LinkMovementMethod
import android.text.util.Linkify
import android.widget.ScrollView
import android.widget.TextView

/**
 * Offline Health Connect permission rationale with a link to the same public policy used by the app.
 * Ported from the Capacitor app's HealthPermissionsActivity.java (same class name: the manifest activity and the
 * ViewPermissionUsageActivity alias point at it; Play's Health Connect declaration requires it).
 */
class HealthPermissionsActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setTitle(R.string.health_permissions_title)

        val text = TextView(this)
        val padding = Math.round(24 * resources.displayMetrics.density)
        text.setPadding(padding, padding, padding, padding)
        text.textSize = 17f
        text.text = getString(R.string.health_permissions_rationale) + "\n\n" + getString(R.string.privacy_policy_url)
        Linkify.addLinks(text, Linkify.WEB_URLS)
        text.movementMethod = LinkMovementMethod.getInstance()
        val scroll = ScrollView(this)
        scroll.addView(text)
        setContentView(scroll)
    }
}
