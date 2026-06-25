const fs = require("fs");
const path = require("path");
const { SHORTCUTS, encodeShortcutLink, PACKAGE } = require("../config/assistantShortcuts");

const STRING_RESOURCES = {
  assistant_shortcut_whisper_short: "Fısıltı",
  assistant_shortcut_whisper_long: "TalkCash Fısıltı ile Harcama",
  assistant_shortcut_quick_short: "Hızlı Fısıltı",
  assistant_shortcut_quick_long: "TalkCash Hızlı Fısıltı",
  assistant_shortcut_add_expense_short: "Harcama",
  assistant_shortcut_add_expense_long: "TalkCash Harcama Ekle",
  assistant_shortcut_add_income_short: "Gelir",
  assistant_shortcut_add_income_long: "TalkCash Gelir Ekle",
  assistant_shortcut_add_shopping_short: "Liste",
  assistant_shortcut_add_shopping_long: "TalkCash Listeye Ekle",
  assistant_shortcut_mark_paid_short: "Fatura",
  assistant_shortcut_mark_paid_long: "TalkCash Fatura Ödedim",
};

function buildCapabilityBinding(shortcut) {
  if (shortcut.capability === "actions.intent.OPEN_APP_FEATURE" && shortcut.feature) {
    return `
    <capability-binding android:key="actions.intent.OPEN_APP_FEATURE">
      <parameter-binding android:key="feature" android:value="${shortcut.feature}" />
    </capability-binding>`;
  }
  if (shortcut.capability === "actions.intent.CREATE_MONEY_TRANSFER") {
    return `\n    <capability-binding android:key="actions.intent.CREATE_MONEY_TRANSFER" />`;
  }
  if (shortcut.capability === "actions.intent.CREATE_ITEM_LIST") {
    return `\n    <capability-binding android:key="actions.intent.CREATE_ITEM_LIST" />`;
  }
  return "";
}

const capabilities = `
  <capability android:name="actions.intent.CREATE_MONEY_TRANSFER">
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${PACKAGE}">
      <url-template android:value="talkcash://command{?amount,currency,description,action,source}" />
      <parameter android:name="moneyTransfer.amount" android:key="amount" />
      <parameter android:name="moneyTransfer.currency" android:key="currency" />
      <parameter android:name="moneyTransfer.description" android:key="description" />
    </intent>
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${PACKAGE}">
      <url-template android:value="talkcash://command?action=add_expense&amp;source=google" />
    </intent>
  </capability>

  <capability android:name="actions.intent.CREATE_ITEM_LIST">
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${PACKAGE}">
      <url-template android:value="talkcash://command{?item,action,source}" />
      <parameter android:name="itemList.itemListElement.name" android:key="item" />
    </intent>
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${PACKAGE}">
      <url-template android:value="talkcash://command?action=add_shopping&amp;source=google" />
    </intent>
  </capability>

  <capability android:name="actions.intent.UPDATE_ITEM_LIST">
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${PACKAGE}">
      <url-template android:value="talkcash://command{?item,action,source}" />
      <parameter android:name="itemList.itemListElement.name" android:key="item" />
    </intent>
  </capability>

  <capability android:name="actions.intent.OPEN_APP_FEATURE">
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${PACKAGE}">
      <url-template android:value="talkcash://command{?feature,description,action,source}" />
      <parameter android:name="feature" android:key="feature" />
    </intent>
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${PACKAGE}">
      <url-template android:value="talkcash://command?action=add_income&amp;source=google" />
    </intent>
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${PACKAGE}">
      <url-template android:value="talkcash://command?action=mark_paid&amp;source=google" />
    </intent>
  </capability>`;

const staticShortcuts = SHORTCUTS.map((shortcut) => {
  const data = encodeShortcutLink(shortcut).replace(/&/g, "&amp;");
  return `
  <shortcut
    android:shortcutId="${shortcut.id}"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/${shortcut.shortLabel}"
    android:shortcutLongLabel="@string/${shortcut.longLabel}">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="${PACKAGE}"
      android:data="${data}" />
    <categories android:name="android.shortcut.conversation" />${buildCapabilityBinding(shortcut)}
  </shortcut>`;
}).join("");

const xml = `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">${capabilities}
${staticShortcuts}
</shortcuts>
`;

const xmlDir = path.join(__dirname, "..", "android/app/src/main/res/xml");
const valuesDir = path.join(__dirname, "..", "android/app/src/main/res/values");
fs.mkdirSync(xmlDir, { recursive: true });
fs.mkdirSync(valuesDir, { recursive: true });
fs.writeFileSync(path.join(xmlDir, "shortcuts.xml"), xml);

const entries = Object.entries(STRING_RESOURCES)
  .map(([name, value]) => `  <string name="${name}">${value}</string>`)
  .join("\n");
fs.writeFileSync(
  path.join(valuesDir, "assistant_shortcuts.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${entries}\n</resources>\n`,
);

console.log(`Generated ${SHORTCUTS.length} shortcuts`);
