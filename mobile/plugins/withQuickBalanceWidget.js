const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const DEEP_LINK = "talkcash:///(tabs)/input?source=widget";

function withQuickBalanceWidget(config) {
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
        path.join(javaDir, "QuickBalanceWidgetProvider.kt"),
        `package io.talkcash.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import io.talkcash.app.R

class QuickBalanceWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) {
            val views = RemoteViews(context.packageName, R.layout.quick_balance_widget)
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("${DEEP_LINK}"))
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            val pending = PendingIntent.getActivity(
                context, 1, intent,
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
        path.join(resDir, "layout/quick_balance_widget.xml"),
        `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#121826"
    android:gravity="center"
    android:orientation="vertical"
    android:padding="12dp">
    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="TalkCash"
        android:textColor="#94A3B8"
        android:textSize="11sp"
        android:textStyle="bold" />
    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="4dp"
        android:text="+ Expense"
        android:textColor="#22D3EE"
        android:textSize="18sp"
        android:textStyle="bold" />
</LinearLayout>
`,
      );

      fs.writeFileSync(
        path.join(resDir, "xml/quick_balance_widget_info.xml"),
        `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="110dp"
    android:minHeight="40dp"
    android:updatePeriodMillis="86400000"
    android:initialLayout="@layout/quick_balance_widget"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:description="@string/app_name" />
`,
      );

      return cfg;
    },
  ]);
}

function withBalanceWidgetManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = AndroidConfig.getMainApplicationOrThrow(manifest);
    if (!app.receiver) app.receiver = [];
    const exists = app.receiver.some(
      (r) => r.$?.["android:name"] === ".widget.QuickBalanceWidgetProvider",
    );
    if (!exists) {
      app.receiver.push({
        $: {
          "android:name": ".widget.QuickBalanceWidgetProvider",
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
              "android:resource": "@xml/quick_balance_widget_info",
            },
          },
        ],
      });
    }
    return cfg;
  });
}

module.exports = function withQuickBalanceWidgetPlugin(config) {
  config = withQuickBalanceWidget(config);
  config = withBalanceWidgetManifest(config);
  return config;
};
