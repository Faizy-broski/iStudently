import type { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import type { createAudioPlayer } from 'expo-audio';

type Speech = typeof ExpoSpeechRecognitionModule;

let speech: Speech | null | undefined;
let audio: typeof createAudioPlayer | null | undefined;

/**
 * Speech recognition, or null when this build of the app does not include the native module
 * yet (added with Speed Reading; needs a dev-client rebuild). Callers fall back to manual mode.
 */
export function speechModule(): Speech | null {
  if (speech === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      speech = (require('expo-speech-recognition') as { ExpoSpeechRecognitionModule: Speech }).ExpoSpeechRecognitionModule;
    } catch {
      speech = null;
    }
  }
  return speech;
}

/** expo-audio's createAudioPlayer, or null on builds without it. */
export function audioPlayerFactory(): typeof createAudioPlayer | null {
  if (audio === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      audio = (require('expo-audio') as { createAudioPlayer: typeof createAudioPlayer }).createAudioPlayer;
    } catch {
      audio = null;
    }
  }
  return audio;
}
