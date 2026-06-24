import { extractVoiceAlert, playExpenseFeedback } from "@/utils/voiceAlert";

describe("extractVoiceAlert", () => {
  it("prefers persona_speech over voice_alert", () => {
    const persona = { action: "trigger_voice_alert", speech_text: "Roast" };
    const price = { action: "trigger_voice_alert", speech_text: "Price" };
    expect(extractVoiceAlert({ result: { persona_speech: persona, voice_alert: price } })).toEqual(persona);
  });

  it("reads subscription_alert when persona missing", () => {
    const sub = { action: "trigger_voice_alert", speech_text: "Netflix soon" };
    expect(extractVoiceAlert({ subscription_alert: sub })).toEqual(sub);
  });

  it("reads voice_alert from execute result", () => {
    const alert = {
      action: "trigger_voice_alert",
      speech_text: "Test",
    };
    expect(extractVoiceAlert({ result: { voice_alert: alert } })).toEqual(alert);
  });

  it("reads top-level voice_alert", () => {
    const alert = { action: "trigger_voice_alert", speech_text: "Direct" };
    expect(extractVoiceAlert({ voice_alert: alert })).toEqual(alert);
  });

  it("returns null when missing", () => {
    expect(extractVoiceAlert({})).toBeNull();
    expect(extractVoiceAlert(null)).toBeNull();
  });
});
