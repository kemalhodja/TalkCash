#!/usr/bin/env node
/**
 * Fetch Android production keystore from EAS (uses local eas login session).
 * Writes mobile/android/app/release.keystore + keystore.properties
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const MOBILE = path.join(ROOT, "mobile");
const ANDROID = path.join(MOBILE, "android");
const APP = path.join(ANDROID, "app");
const KEYSTORE = path.join(APP, "release.keystore");
const PROPS = path.join(ANDROID, "keystore.properties");

function findEasCliRoot() {
  if (process.env.EAS_CLI_ROOT && fs.existsSync(process.env.EAS_CLI_ROOT)) {
    return process.env.EAS_CLI_ROOT;
  }
  const npxRoot = path.join(os.homedir(), "AppData", "Local", "npm-cache", "_npx");
  if (fs.existsSync(npxRoot)) {
    for (const dir of fs.readdirSync(npxRoot)) {
      const candidate = path.join(npxRoot, dir, "node_modules", "eas-cli");
      if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
    }
  }
  throw new Error("eas-cli not found. Run: npx eas-cli@latest whoami");
}

function readSessionSecret() {
  const statePath = path.join(os.homedir(), ".expo", "state.json");
  if (!fs.existsSync(statePath)) {
    throw new Error("No eas login session. Run: eas login");
  }
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const secret = state?.auth?.sessionSecret;
  if (!secret) throw new Error("No sessionSecret in ~/.expo/state.json — run: eas login");
  return secret;
}

async function main() {
  const easRoot = findEasCliRoot();
  const { createGraphqlClient } = require(path.join(
    easRoot,
    "build/commandUtils/context/contextUtils/createGraphqlClient"
  ));
  const { getDefaultAndroidAppBuildCredentialsAsync } = require(path.join(
    easRoot,
    "build/credentials/android/api/GraphqlClient"
  ));

  const sessionSecret = readSessionSecret();
  const graphqlClient = createGraphqlClient({ accessToken: null, sessionSecret });

  const appLookupParams = {
    account: { name: "muallim35" },
    projectName: "talkcash",
    androidApplicationIdentifier: "io.talkcash.app",
  };

  const creds = await getDefaultAndroidAppBuildCredentialsAsync(graphqlClient, appLookupParams);
  const keystore = creds?.androidKeystore;
  if (!keystore?.keystore) {
    throw new Error("No production keystore on EAS for io.talkcash.app");
  }

  fs.mkdirSync(APP, { recursive: true });
  fs.writeFileSync(KEYSTORE, Buffer.from(keystore.keystore, "base64"));

  const props = [
    "storeFile=release.keystore",
    `storePassword=${keystore.keystorePassword}`,
    `keyAlias=${keystore.keyAlias}`,
    `keyPassword=${keystore.keyPassword || keystore.keystorePassword}`,
    "",
  ].join("\n");
  fs.writeFileSync(PROPS, props, "utf8");

  console.log("OK: release.keystore + keystore.properties written");
  console.log(`  keystore: ${KEYSTORE}`);
  console.log(`  alias: ${keystore.keyAlias}`);
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
