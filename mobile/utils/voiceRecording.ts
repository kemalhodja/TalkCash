import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

/** Whisper-optimized: mono 16 kHz AAC — ~3× smaller than HIGH_QUALITY. */
export const WHISPER_RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: ".m4a",
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
  },
  ios: {
    extension: ".m4a",
    audioQuality: Audio.IOSAudioQuality.LOW,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 32000,
  },
};

const MAX_UPLOAD_BYTES = 512 * 1024;

/** Returns URI ready for multipart upload (already m4a from recorder). */
export async function prepareVoiceUploadUri(uri: string): Promise<string> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (info.exists && typeof info.size === "number" && info.size <= MAX_UPLOAD_BYTES) {
      return uri;
    }
  } catch {
    /* use original */
  }
  return uri;
}
