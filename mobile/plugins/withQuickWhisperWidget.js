const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PACKAGE = "io.talkcash.app";
const DEEP_LINK = "talkcash://quick-voice?hold=1&source=widget";

function withQuickWhisperWidget(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const root = cfg.modRequest.platformProjectRoot;
      const javaDir = path.join(root, "app/src/main/java/io/talkcash/app/widget");
      const resDir = path.join(root, "app/src/main/res");
      fs.mkdirSync(javaDir, { recursive: true });
      fs.mkdirSync(path.join(resDir, "layout"), { recursive: true });
      fs.mkdirSync(path.join(resDir, "xml"), { recursive: true });

      fs.writeFileSync(
        path.join(javaDir, "QuickWhisperWidgetProvider.kt"),
        `package io.talkcash.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import io.talkcash.app.R

class QuickWhisperWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) {
            val views = RemoteViews(context.packageName, R.layout.quick_whisper_widget)
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("${DEEP_LINK}"))
            intent.setPackage(context.packageName)
            val pending = PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.widget_root, pending)
            manager.updateAppWidget(id, views)
        }
    }
}
`,
      );

      fs.writeFileSync(
        path.join(resDir, "layout/quick_whisper_widget.xml"),
        `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#1A1A2E"
    android:gravity="center"
    android:orientation="vertical"
    android:padding="12dp">
    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="🎙️"
        android:textSize="28sp" />
    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Hızlı Fısıltı"
        android:textColor="#FFFFFF"
        android:textSize="14sp"
        android:textStyle="bold" />
</LinearLayout>
`,
      );

      fs.writeFileSync(
        path.join(resDir, "xml/quick_whisper_widget_info.xml"),
        `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="110dp"
    android:minHeight="40dp"
    android:updatePeriodMillis="0"
    android:initialLayout="@layout/quick_whisper_widget"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:description="@string/assistant_shortcut_quick_long" />
`,
      );
      return cfg;
    },
  ]);
}

function withQuickWhisperManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.receiver = app.receiver || [];
    const exists = app.receiver.some(
      (r) => r.$?.["android:name"] === ".widget.QuickWhisperWidgetProvider",
    );
    if (!exists) {
      app.receiver.push({
        $: {
          "android:name": ".widget.QuickWhisperWidgetProvider",
          "android:exported": "true",
        },
        "intent-filter": [
          {
            action: [{ $: { "android:name": "android.appwidget.action.APPWIDGET_UPDATE" } }],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.appwidget.provider",
              "android:resource": "@xml/quick_whisper_widget_info",
            },
          },
        ],
      });
    }
    app.service = app.service || [];
    const tileExists = app.service.some(
      (s) => s.$?.["android:name"] === ".tile.QuickWhisperTileService",
    );
    if (!tileExists) {
      app.service.push({
        $: {
          "android:name": ".tile.QuickWhisperTileService",
          "android:exported": "true",
          "android:icon": "@mipmap/ic_launcher",
          "android:label": "@string/assistant_shortcut_quick_short",
          "android:permission": "android.permission.BIND_QUICK_SETTINGS_TILE",
        },
        "intent-filter": [
          {
            action: [{ $: { "android:name": "android.service.quicksettings.action.QS_TILE" } }],
          },
        ],
      });
    }
    return cfg;
  });
}

module.exports = function withQuickWhisperWidgetPlugin(config) {
  config = withQuickWhisperWidget(config);
  config = withQuickWhisperManifest(config);
  return config;
};
