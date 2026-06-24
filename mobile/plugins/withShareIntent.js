const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SEND_INTENT_MARK = "TalkCashShareIntentRewrite";

function withAndroidSendIntentFilter(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(app);
    activity["intent-filter"] = activity["intent-filter"] || [];
    const exists = activity["intent-filter"].some((filter) =>
      (filter.action || []).some((action) => action.$?.["android:name"] === "android.intent.action.SEND"),
    );
    if (!exists) {
      activity["intent-filter"].push({
        action: [{ $: { "android:name": "android.intent.action.SEND" } }],
        category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
        data: [{ $: { "android:mimeType": "text/plain" } }],
      });
    }
    return cfg;
  });
}

function withMainActivityShareRewrite(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const activityPath = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/java/io/talkcash/app/MainActivity.kt",
      );
      if (!fs.existsSync(activityPath)) return cfg;

      let contents = fs.readFileSync(activityPath, "utf8");
      if (contents.includes(SEND_INTENT_MARK)) return cfg;

      if (!contents.includes("import android.content.Intent")) {
        contents = contents.replace(
          "import android.os.Bundle",
          "import android.content.Intent\nimport android.net.Uri\nimport android.os.Bundle\nimport java.net.URLEncoder",
        );
      }

      const rewriteBlock = `
    // ${SEND_INTENT_MARK}
    intent?.let { incoming ->
      if (Intent.ACTION_SEND == incoming.action && "text/plain" == incoming.type) {
        val shared = incoming.getStringExtra(Intent.EXTRA_TEXT) ?: return@let
        val encoded = URLEncoder.encode(shared, "UTF-8")
        incoming.action = Intent.ACTION_VIEW
        incoming.data = Uri.parse("talkcash://share?text=\$encoded&source=share")
        incoming.removeExtra(Intent.EXTRA_TEXT)
      }
    }`;

      contents = contents.replace(
        "super.onCreate(null)",
        `${rewriteBlock}\n    super.onCreate(null)`,
      );

      if (!contents.includes("override fun onNewIntent")) {
        contents = contents.replace(
          "  /**\n   * Returns the name of the main component",
          `  override fun onNewIntent(intent: Intent?) {
    if (intent != null) {
      if (Intent.ACTION_SEND == intent.action && "text/plain" == intent.type) {
        val shared = intent.getStringExtra(Intent.EXTRA_TEXT)
        if (shared != null) {
          val encoded = URLEncoder.encode(shared, "UTF-8")
          intent.action = Intent.ACTION_VIEW
          intent.data = Uri.parse("talkcash://share?text=\$encoded&source=share")
          intent.removeExtra(Intent.EXTRA_TEXT)
        }
      }
      setIntent(intent)
    }
    super.onNewIntent(intent)
  }

  /**
   * Returns the name of the main component`,
        );
      }

      fs.writeFileSync(activityPath, contents);
      return cfg;
    },
  ]);
}

module.exports = function withShareIntent(config) {
  config = withAndroidSendIntentFilter(config);
  config = withMainActivityShareRewrite(config);
  return config;
};
