'use client';

/* ==========================================================================
   قاعدة الجهابذة — طبقة الصوت (عميل فقط)
   أولوية: حزمة صوت بشري ← نطق المتصفح ← صامت.
   كلها اختيارية: كل الأنشطة قابلة للحل بصرياً.
   ========================================================================== */

export interface AudioManifest {
  app: string;
  version: number;
  voice?: string;
  files: Record<string, string>;
}

/** تجزئة djb2 — يجب أن تطابق tools/audio_hash.py حرفاً بحرف */
export function textHash(text: string): string {
  const t = String(text).normalize('NFC');
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = (((h << 5) + h) + t.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

let pack: { base: string; files: Record<string, string>; count: number } | null = null;
let packTried = false;
const clipCache = new Map<string, HTMLAudioElement>();

/** المسار الافتراضي يفترض رفع الحزمة إلى public/qaida/audio/ */
export async function loadAudioPack(base = '/qaida/audio/'): Promise<typeof pack> {
  if (packTried) return pack;
  packTried = true;
  try {
    const res = await fetch(`${base}manifest.json`, { cache: 'force-cache' });
    if (!res.ok) return null;
    const data = (await res.json()) as AudioManifest;
    if (!data?.files) return null;
    pack = { base, files: data.files, count: Object.keys(data.files).length };
    return pack;
  } catch {
    return null;                       // لا حزمة — النطق الآلي يكفي
  }
}

export function audioPackInfo() { return pack; }

function playClip(url: string): Promise<boolean> {
  return new Promise(resolve => {
    let el = clipCache.get(url);
    if (!el) { el = new Audio(url); el.preload = 'auto'; clipCache.set(url, el); }
    el.currentTime = 0;
    el.onended = () => resolve(true);
    el.onerror = () => resolve(false);
    el.play()?.catch(() => resolve(false));
    setTimeout(() => resolve(true), 8000);
  });
}

/* ------------------------------------------------------- نطق المتصفح */
let voices: SpeechSynthesisVoice[] = [];

function refreshVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  voices = window.speechSynthesis.getVoices() ?? [];
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

export function arabicVoices(): SpeechSynthesisVoice[] {
  return voices.filter(v => /^ar/i.test(v.lang));
}

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && arabicVoices().length > 0;
}

export interface SpeakOptions { rate?: number; voiceURI?: string | null; enabled?: boolean }

function speak(text: string, opts: SpeakOptions): Promise<boolean> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return resolve(false);
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const ar = arabicVoices();
      const chosen =
        (opts.voiceURI && voices.find(v => v.voiceURI === opts.voiceURI)) ||
        ar.find(v => /ar[-_]SA/i.test(v.lang)) || ar[0] || null;
      if (chosen) { u.voice = chosen; u.lang = chosen.lang; } else { u.lang = 'ar-SA'; }
      u.rate = opts.rate ?? 0.75;
      u.onend = () => resolve(true);
      u.onerror = () => resolve(false);
      window.speechSynthesis.speak(u);
      setTimeout(() => resolve(true), 6000);
    } catch { resolve(false); }
  });
}

export async function say(text: string | undefined, opts: SpeakOptions = {}): Promise<boolean> {
  if (opts.enabled === false || !text) return false;
  if (pack) {
    const file = pack.files[textHash(text)];
    if (file && (await playClip(pack.base + file))) return true;
  }
  return speak(text, opts);
}

export function stopSpeech(): void {
  try { window.speechSynthesis?.cancel(); } catch { /* تجاهل */ }
  clipCache.forEach(a => { try { a.pause(); } catch { /* تجاهل */ } });
}

/* ------------------------------------------- مؤثرات مركّبة بلا ملفات */
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx?.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockAudio(): void { ac(); }

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, on = true) {
  const c = ac();
  if (!c || !on) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

export const sfx = {
  tap: (on = true) => tone(520, 0.06, 'triangle', 0.07, 0, on),
  correct: (on = true) => { tone(660, 0.12, 'sine', 0.14, 0, on); tone(880, 0.16, 'sine', 0.12, 0.09, on); },
  wrong: (on = true) => { tone(220, 0.18, 'sawtooth', 0.07, 0, on); tone(170, 0.22, 'sine', 0.06, 0.08, on); },
  star: (on = true) => [784, 988, 1319].forEach((f, i) => tone(f, 0.18, 'sine', 0.12, i * 0.1, on)),
  levelUp: (on = true) => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.13, i * 0.12, on)),
};
