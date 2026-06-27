const { withInfoPlist } = require("@expo/config-plugins");

/** iOS home-screen quick actions (WidgetKit extension scaffold — deep link to whisper). */
function withIosWidgetScaffold(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationShortcutItems = [
      {
        UIApplicationShortcutItemType: "io.talkcash.app.quick-whisper",
        UIApplicationShortcutItemTitle: "Quick expense",
        UIApplicationShortcutItemIconType: "UIApplicationShortcutIconTypeAdd",
        UIApplicationShortcutItemUserInfo: {
          url: "talkcash://quick-voice?hold=1&source=ios-shortcut",
        },
      },
      {
        UIApplicationShortcutItemType: "io.talkcash.app.paste-sms",
        UIApplicationShortcutItemTitle: "Paste bank SMS",
        UIApplicationShortcutItemIconType: "UIApplicationShortcutIconTypeCompose",
        UIApplicationShortcutItemUserInfo: {
          url: "talkcash://input?sms=1&source=ios-shortcut",
        },
      },
    ];
    return cfg;
  });
}

module.exports = function withIosWidgetScaffoldPlugin(config) {
  return withIosWidgetScaffold(config);
};
