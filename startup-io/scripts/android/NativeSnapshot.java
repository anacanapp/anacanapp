package com.atlasoon.startupio.acceptance;

import android.app.UiAutomation;
import android.graphics.Rect;
import android.os.HandlerThread;
import android.os.Looper;
import android.view.accessibility.AccessibilityNodeInfo;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/** Snapshot the native hierarchy without waiting for a continuously animated arena to idle. */
public final class NativeSnapshot {
    private String escape(CharSequence text) {
        return text == null ? "" : text.toString().replace("&", "&amp;").replace("\"", "&quot;")
            .replace("<", "&lt;").replace(">", "&gt;");
    }

    private void attribute(StringBuilder xml, String name, CharSequence value) {
        xml.append(' ').append(name).append("=\"").append(escape(value)).append('"');
    }

    private void node(StringBuilder xml, AccessibilityNodeInfo info) {
        if (info == null) return;
        try {
            Rect bounds = new Rect(); info.getBoundsInScreen(bounds);
            xml.append("<node");
            attribute(xml, "text", info.getText());
            attribute(xml, "content-desc", info.getContentDescription());
            attribute(xml, "resource-id", info.getViewIdResourceName());
            attribute(xml, "class", info.getClassName());
            attribute(xml, "package", info.getPackageName());
            attribute(xml, "clickable", Boolean.toString(info.isClickable()));
            attribute(xml, "enabled", Boolean.toString(info.isEnabled()));
            attribute(xml, "bounds", "[" + bounds.left + "," + bounds.top + "][" + bounds.right + "," + bounds.bottom + "]");
            xml.append('>');
            for (int i = 0; i < info.getChildCount(); i++) node(xml, info.getChild(i));
            xml.append("</node>");
        } finally { info.recycle(); }
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 1 || !args[0].startsWith("/sdcard/startupio-window-")) throw new IllegalArgumentException("Dedicated snapshot path required");
        Looper.prepareMainLooper();
        HandlerThread thread = new HandlerThread("startupio-native-snapshot"); thread.start();
        Object connection = Class.forName("android.app.UiAutomationConnection").getDeclaredConstructor().newInstance();
        Class<?> connectionType = Class.forName("android.app.IUiAutomationConnection");
        UiAutomation ui = (UiAutomation) UiAutomation.class.getConstructor(Looper.class, connectionType).newInstance(thread.getLooper(), connection);
        try {
            UiAutomation.class.getMethod("connect").invoke(ui);
            AccessibilityNodeInfo root = null;
            for (int attempt = 0; attempt < 20 && root == null; attempt++) {
                root = ui.getRootInActiveWindow();
                if (root == null) Thread.sleep(200);
            }
            if (root == null) throw new IllegalStateException("Active native window required");
            StringBuilder xml = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?><hierarchy>");
            new NativeSnapshot().node(xml, root); xml.append("</hierarchy>");
            try (FileOutputStream file = new FileOutputStream(args[0])) {
                file.write(xml.toString().getBytes(StandardCharsets.UTF_8));
            }
            System.out.println("Snapshot complete: " + args[0]);
        } finally {
            UiAutomation.class.getMethod("disconnect").invoke(ui);
            thread.quitSafely();
        }
    }
}
