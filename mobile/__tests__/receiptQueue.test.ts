import { enqueue, getQueue, replaceQueue } from "../services/offlineQueue";

jest.mock("expo-file-system", () => ({
  documentDirectory: "file:///docs/",
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../services/api", () => ({
  api: {
    scanReceipt: jest.fn(),
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

describe("receiptQueue", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await replaceQueue([]);
  });

  it("enqueues receipt scan on offline failure path", async () => {
    const { enqueueReceiptScan } = require("../services/receiptQueue");
    const result = await enqueueReceiptScan("file:///tmp/receipt.jpg");
    expect(result.queued).toBe(true);
    expect(result.queue_id).toBeTruthy();
  });

  it("flushReceiptScans uploads pending scans", async () => {
    const { api } = require("../services/api");
    const { flushReceiptScans } = require("../services/receiptQueue");
    api.scanReceipt.mockResolvedValue({ receipt_id: "r1" });
    await enqueue({ type: "receipt_scan", payload: { local_uri: "file:///docs/offline-receipts/1.jpg" } });
    const result = await flushReceiptScans();
    expect(result.applied).toBe(1);
    expect((await getQueue()).filter((op: any) => op.type === "receipt_scan")).toHaveLength(0);
    await replaceQueue([]);
  });
});
