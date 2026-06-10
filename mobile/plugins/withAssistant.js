const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SHORTCUTS_XML = `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut
    android:shortcutId="add_expense"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/app_name"
    android:shortcutLongLabel="TalkCash Harcama Ekle">
    <intent
      android:action="android.intent.action.VIEW"
      android:data="talkcash://command?text=150%20TL%20kahve%20banka&amp;source=google" />
    <categories android:name="android.shortcut.conversation" />
  </shortcut>
  <shortcut
    android:shortcutId="add_shopping"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/app_name"
    android:shortcutLongLabel="TalkCash Listeye Ekle">
    <intent
      android:action="android.intent.action.VIEW"
      android:data="talkcash://command?text=listeye%20s%C3%BCt%20ekle&amp;source=google" />
    <categories android:name="android.shortcut.conversation" />
  </shortcut>
  <shortcut
    android:shortcutId="mark_paid"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/app_name"
    android:shortcutLongLabel="TalkCash Fatura Ödedim">
    <intent
      android:action="android.intent.action.VIEW"
      android:data="talkcash://command?text=elektrik%20faturas%C4%B1n%C4%B1%20%C3%B6dedim&amp;source=google" />
    <categories android:name="android.shortcut.conversation" />
  </shortcut>
</shortcuts>
`;

function withAndroidShortcutsXml(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const xmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/res/xml",
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, "shortcuts.xml"), SHORTCUTS_XML);
      return cfg;
    },
  ]);
}

function withAndroidShortcutsMeta(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      app,
      "android.app.shortcuts",
      "@xml/shortcuts",
      "resource",
    );
    return cfg;
  });
}

function withIosAssistantActivities(config) {
  return {
    ...config,
    ios: {
      ...config.ios,
      infoPlist: {
        ...(config.ios?.infoPlist || {}),
        NSUserActivityTypes: [
          "io.talkcash.app.add-expense",
          "io.talkcash.app.add-income",
          "io.talkcash.app.add-shopping",
          "io.talkcash.app.mark-paid",
        ],
      },
    },
  };
}

module.exports = function withAssistant(config) {
  config = withIosAssistantActivities(config);
  config = withAndroidShortcutsXml(config);
  config = withAndroidShortcutsMeta(config);
  return config;
};
