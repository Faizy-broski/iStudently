import type { JtAlertKey, JtLang, JtVoice } from '@studently/shared-utils';
import { Directory, File, Paths } from 'expo-file-system';

import { audioPlayerFactory } from '@/features/speed-reading/native';

// Device side of the exam timer: spoken alerts (expo-speech), the school's recorded clips (stored in
// the app's documents), keep-awake. Native modules are loaded lazily: builds made before they were
// added fall back to a beep (or silence) instead of crashing.

type SpeechModule = { speak: (text: string, opts?: { language?: string; rate?: number }) => void; stop: () => void };
type KeepAwake = { activateKeepAwakeAsync: (tag?: string) => Promise<void>; deactivateKeepAwake: (tag?: string) => Promise<void> };

let speech: SpeechModule | null | undefined;
let keepAwake: KeepAwake | null | undefined;

function speechModule(): SpeechModule | null {
  if (speech === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      speech = require('expo-speech') as SpeechModule;
    } catch {
      speech = null;
    }
  }
  return speech;
}

function keepAwakeModule(): KeepAwake | null {
  if (keepAwake === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      keepAwake = require('expo-keep-awake') as KeepAwake;
    } catch {
      keepAwake = null;
    }
  }
  return keepAwake;
}

const TAG = 'jahbadh-exam-timer';
export function setKeepAwake(on: boolean) {
  const m = keepAwakeModule();
  if (!m) return;
  if (on) void m.activateKeepAwakeAsync(TAG).catch(() => undefined);
  else void m.deactivateKeepAwake(TAG).catch(() => undefined);
}

export const JT_CLIP_KEYS: JtAlertKey[] = ['start', 'left_30', 'left_15', 'left_5', 'left_1', 'exit', 'end'];

const clipDir = () => new Directory(Paths.document, 'exam-timer-clips');

export function clipFile(k: JtAlertKey): File | null {
  try {
    const dir = clipDir();
    if (!dir.exists) return null;
    const f = dir.list().find((x) => x instanceof File && x.name.startsWith(`${k}.`));
    return (f as File | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Copies a picked audio file in as the clip of one alert; null removes it. */
export function saveClip(k: JtAlertKey, picked: { uri: string; name: string } | null) {
  const old = clipFile(k);
  if (old) old.delete();
  if (!picked) return;
  const dir = clipDir();
  if (!dir.exists) dir.create();
  const ext = picked.name.includes('.') ? picked.name.split('.').pop() : 'm4a';
  new File(picked.uri).copy(new File(dir, `${k}.${ext}`));
}

function play(uri: string): boolean {
  const create = audioPlayerFactory();
  if (!create) return false;
  try {
    const p = create({ uri });
    p.play();
    setTimeout(() => p.remove(), 60_000);
    return true;
  } catch {
    return false;
  }
}

/** A short 880 Hz tone as an 8-bit WAV data URI (no asset file). */
function makeBeep(ms = 180, hz = 880, rate = 8000): string {
  const n = Math.round((rate * ms) / 1000)
  const bytes = new Uint8Array(44 + n)
  const view = new DataView(bytes.buffer)
  const str = (o: number, x: string) => [...x].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); view.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true)
  str(36, 'data'); view.setUint32(40, n, true)
  for (let i = 0; i < n; i++) bytes[44 + i] = 128 + Math.round(60 * Math.sin((2 * Math.PI * hz * i) / rate))
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]]
    const t = (a << 16) | (b << 8) | c
    out += abc[(t >> 18) & 63] + abc[(t >> 12) & 63] + (i + 1 < bytes.length ? abc[(t >> 6) & 63] : '=') + (i + 2 < bytes.length ? abc[t & 63] : '=')
  }
  return `data:audio/wav;base64,${out}`
}
let beepUri: string | null = null
export function beep() {
  beepUri ??= makeBeep()
  play(beepUri)
}

export function speak(text: string, lang: JtLang) {
  const m = speechModule();
  if (!m) return beep();
  m.speak(text, { language: lang === 'ar' ? 'ar-SA' : 'en-US', rate: 0.95 });
}

/** Plays one alert with the chosen voice (clips fall back to speech when none is recorded). */
export function playAlert(voice: JtVoice, key: JtAlertKey, text: string, lang: JtLang) {
  if (voice === 'off') return;
  if (voice === 'clips') {
    const f = clipFile(key);
    if (f && play(f.uri)) return;
  }
  if (voice === 'beep') return beep();
  speak(text, lang);
}
