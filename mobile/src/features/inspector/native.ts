import type { ComponentType } from 'react';

type Recorder = ComponentType<{ onDone: (file: { uri: string; name: string; type: string }) => void; disabled?: boolean }>;
let recorder: Recorder | null | undefined;

/** The voice recorder, or null on builds without expo-audio (dev-client rebuild needed); callers fall back to picking a file. */
export function voiceRecorder(): Recorder | null {
  if (recorder === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('expo-audio');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      recorder = (require('./voice-recorder') as { default: Recorder }).default;
    } catch {
      recorder = null;
    }
  }
  return recorder;
}
