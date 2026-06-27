import { enqueue, getQueue, replaceQueue } from "../services/offlineQueue";

jest.mock("expo-file-system", () => ({
  documentDirectory: "file:///docs/",
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../services/api", () => ({
  api: {
    parseVoice: jest.fn(),
    processPremiumVoice: jest.fn(),
  },
}));

jest.mock("@react-native-async-storage/async-storage", () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      store = {};
      return Promise.resolve();
    }),
  };
});

describe("voiceQueue", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await replaceQueue([]);
  });

  it("queues voice parse when network fails", async () => {
    const { api } = require("../services/api");
    const { parseVoiceWithOfflineQueue } = require("../services/voiceQueue");
    api.parseVoice.mockRejectedValue(Object.assign(new Error("Network error"), { status: 0 }));
    const result = await parseVoiceWithOfflineQueue("file:///tmp/voice.m4a", false, false);
    expect(result.status).toBe("queued");
    expect((await getQueue()).some((op: any) => op.type === "voice_parse")).toBe(true);
  });

  it("flushVoiceParses uploads pending voice files", async () => {
    const { api } = require("../services/api");
    const { flushVoiceParses, consumePendingVoiceResult } = require("../services/voiceQueue");
    api.parseVoice.mockResolvedValue({ parsed: { raw_text: "50 coffee" } });
    await enqueue({
      type: "voice_parse",
      payload: { local_uri: "file:///docs/offline-voice/1.m4a", whisper_mode: false },
    });
    const result = await flushVoiceParses();
    expect(result.applied).toBe(1);
    const pending = await consumePendingVoiceResult();
    expect(pending).toEqual({ parsed: { raw_text: "50 coffee" } });
  });
});

describe("apiErrors", () => {
  it("classifies timeout and network errors", () => {
    const { classifyApiError, isRetryableApiError } = require("../utils/apiErrors");
    const networkErr = Object.assign(new Error("Network error"), { status: 0 });
    const serverErr = Object.assign(new Error("Server error"), { status: 503, name: "ApiError" });
    Object.setPrototypeOf(serverErr, { constructor: { name: "ApiError" } });
    expect(classifyApiError(networkErr)).toBe("network");
    expect(isRetryableApiError(Object.assign(new Error("x"), { status: 503 }))).toBe(true);
    expect(isRetryableApiError(Object.assign(new Error("x"), { status: 400 }))).toBe(false);
  });
});
