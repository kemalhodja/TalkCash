import { healthUrlFromApiBase, usesLocalhostApi } from "@/services/config";

describe("config", () => {
  it("builds health URL from API base", () => {
    expect(healthUrlFromApiBase("http://192.168.1.5:8000/api/v1")).toBe(
      "http://192.168.1.5:8000/health",
    );
  });

  it("detects localhost in URL helper", () => {
    expect(usesLocalhostApi()).toBe(true);
  });
});
