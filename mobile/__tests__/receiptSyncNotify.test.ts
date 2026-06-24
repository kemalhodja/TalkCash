jest.mock("../services/api", () => ({ api: { registerPushToken: jest.fn() } }));

import { notifyReceiptsSynced } from "../services/notifications";

jest.mock("expo-notifications", () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue("id"),
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

describe("notifyReceiptsSynced", () => {
  it("schedules local notification with count", async () => {
    const Notifications = require("expo-notifications");
    await notifyReceiptsSynced(2, "tr");
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: expect.stringContaining("Fiş"),
          body: expect.stringContaining("2"),
        }),
        trigger: null,
      }),
    );
  });

  it("skips zero count", async () => {
    const Notifications = require("expo-notifications");
    Notifications.scheduleNotificationAsync.mockClear();
    await notifyReceiptsSynced(0, "en");
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
