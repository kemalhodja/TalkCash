const appJson = require("./app.json");

const isProduction = process.env.EXPO_PUBLIC_APP_ENV === "production";
const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const allowCleartext = apiUrl.startsWith("http://");

const plugins = (appJson.expo.plugins || [])
  .filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    if (isProduction && (name === "expo-dev-client" || name === "@sentry/react-native/expo")) {
      return false;
    }
    return true;
  })
  .concat(["expo-updates"]);

module.exports = {
  expo: {
    ...appJson.expo,
    plugins,
    updates: {
      url: "https://u.expo.dev/d7cfbb2e-a657-49a6-bfc9-bcfc4e120230",
    },
    extra: {
      apiUrl,
      appEnv: process.env.EXPO_PUBLIC_APP_ENV || "development",
      eas: {
        projectId: process.env.EAS_PROJECT_ID || "d7cfbb2e-a657-49a6-bfc9-bcfc4e120230",
      },
    },
    android: {
      ...appJson.expo.android,
      runtimeVersion: appJson.expo.version || "1.2.0",
      usesCleartextTraffic: allowCleartext,
    },
    ios: {
      ...appJson.expo.ios,
      runtimeVersion: { policy: "appVersion" },
    },
  },
};
