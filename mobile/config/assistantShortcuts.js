/** Shared assistant shortcut definitions for iOS/Android native config generation. */

const PACKAGE = "io.talkcash.app";

const SHORTCUTS = [
  {
    id: "add_expense",
    shortLabel: "assistant_shortcut_add_expense_short",
    longLabel: "assistant_shortcut_add_expense_long",
    text: "150 TL kahve banka",
    capability: "actions.intent.CREATE_MONEY_TRANSFER",
    action: "add_expense",
    voiceExampleTr: "Hey Google, TalkCash'te 150 lira kahve harcaması ekle",
    voiceExampleEn: "Hey Google, add 150 coffee expense in TalkCash",
  },
  {
    id: "add_income",
    shortLabel: "assistant_shortcut_add_income_short",
    longLabel: "assistant_shortcut_add_income_long",
    text: "maaşım yattı 45000 banka",
    capability: "actions.intent.OPEN_APP_FEATURE",
    action: "add_income",
    feature: "add_income",
    voiceExampleTr: "Hey Google, TalkCash'te gelir ekle",
    voiceExampleEn: "Hey Google, add income in TalkCash",
  },
  {
    id: "add_shopping",
    shortLabel: "assistant_shortcut_add_shopping_short",
    longLabel: "assistant_shortcut_add_shopping_long",
    text: "listeye süt ekmek ekle",
    capability: "actions.intent.CREATE_ITEM_LIST",
    action: "add_shopping",
    voiceExampleTr: "Hey Google, TalkCash listesine süt ekle",
    voiceExampleEn: "Hey Google, add milk to TalkCash list",
  },
  {
    id: "mark_paid",
    shortLabel: "assistant_shortcut_mark_paid_short",
    longLabel: "assistant_shortcut_mark_paid_long",
    text: "elektrik faturasını ödedim",
    capability: "actions.intent.OPEN_APP_FEATURE",
    action: "mark_paid",
    feature: "mark_paid",
    voiceExampleTr: "Hey Google, TalkCash'te elektrik faturasını ödedim de",
    voiceExampleEn: "Hey Google, mark electricity bill paid in TalkCash",
  },
];

function encodeDeepLink(text, source = "google") {
  return `talkcash://command?text=${encodeURIComponent(text)}&source=${source}`;
}

module.exports = {
  PACKAGE,
  SHORTCUTS,
  encodeDeepLink,
};
