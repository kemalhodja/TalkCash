import tr from "@/i18n/tr";
import en from "@/i18n/en";

describe("i18n", () => {
  it("has matching top-level keys", () => {
    const trKeys = Object.keys(tr).sort();
    const enKeys = Object.keys(en).sort();
    expect(trKeys).toEqual(enKeys);
  });

  it("has required auth strings", () => {
    expect(tr.login.title).toBe("TalkCash");
    expect(en.login.title).toBe("TalkCash");
    expect(tr.lock.enterPin).toBeTruthy();
    expect(en.lock.enterPin).toBeTruthy();
  });

  it("has geofence and notification strings", () => {
    expect(tr.geofence.title).toContain("Market");
    expect(en.geofence.title).toContain("market");
    expect(tr.notifications.tomorrowTitle).toContain("{title}");
  });
});
