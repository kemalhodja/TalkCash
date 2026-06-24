const { withAppBuildGradle, withGradleProperties } = require("@expo/config-plugins");

const MISSING_DIMENSION = "missingDimensionStrategy 'store', 'play'";

function withReactNativeIap(config) {
  config = withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const key = "android.kotlinVersion";
    if (!props.find((item) => item.type === "property" && item.key === key)) {
      props.push({ type: "property", key, value: "1.9.25" });
    }
    return cfg;
  });

  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MISSING_DIMENSION)) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /defaultConfig\s*\{/,
        `defaultConfig {
        ${MISSING_DIMENSION}`,
      );
    }
    return cfg;
  });
}

module.exports = withReactNativeIap;
