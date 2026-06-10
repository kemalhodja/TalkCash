const appJson = require("./app.json");

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1",
      eas: {
        projectId: process.env.EAS_PROJECT_ID || "00000000-0000-0000-0000-000000000000",
      },
    },
  },
};
