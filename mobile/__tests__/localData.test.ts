jest.mock("@react-native-async-storage/async-storage", () => ({
  multiRemove: jest.fn(() => Promise.resolve()),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearLocalUserData } from "@/services/localData";

describe("localData", () => {
  it("clears offline queue and snapshot on logout", async () => {
    await clearLocalUserData();
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      "talkcash_offline_queue",
      "talkcash_cloud_snapshot",
    ]);
  });
});
