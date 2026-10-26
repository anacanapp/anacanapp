package com.atlasoon.anacan;

import android.app.Activity;
import android.os.Bundle;
import android.text.util.Linkify;
import android.text.method.LinkMovementMethod;
import android.widget.ScrollView;
import android.widget.TextView;

/** Offline rationale with a link to the same public policy used by the app. */
public class HealthPermissionsActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setTitle(R.string.health_permissions_title);

        TextView text = new TextView(this);
        int padding = Math.round(24 * getResources().getDisplayMetrics().density);
        text.setPadding(padding, padding, padding, padding);
        text.setTextSize(17);
        text.setText(getString(R.string.health_permissions_rationale) + "\n\n" + getString(R.string.privacy_policy_url));
        Linkify.addLinks(text, Linkify.WEB_URLS);
        text.setMovementMethod(LinkMovementMethod.getInstance());
        ScrollView scroll = new ScrollView(this);
        scroll.addView(text);
        setContentView(scroll);
    }
}
