/* ==========================================================================
   قاعدة الجهابذة — التقييم والمراجعة المتباعدة
   وحدة خالصة: تُستدعى من مسارات الـ API (مصدر الحقيقة) ومن الواجهة للمعاينة.
   لا تعتمد على المتصفح ولا على قاعدة بيانات بعينها.
   ========================================================================== */

import { WORLDS, type World } from './content';

/* ------------------------------------------------------------ الأنواع */
export interface StationResult {
  stars: 0 | 1 | 2 | 3;
  best: number;       // أفضل نسبة مئوية
  attempts: number;
  lastAt: string;     // ISO
}

export interface SrsCard {
  box: number;        // 0..4
  due: string;        // ISO
  seen: number;
  wrong: number;
}

export interface QaidaProgress {
  xp: number;
  streak: { count: number; last: string | null; best: number };
  stats: { answered: number; correct: number; seconds: number; reviews: number; sessions: number };
  badges: string[];
  stations: Record<string, StationResult>;
  mastery: Record<string, number>;   // 0..100
  srs: Record<string, SrsCard>;
}

export interface AnsweredItem {
  key: string;
  correct: boolean;
}

/* ------------------------------------------------------------ الثوابت */
export const FINAL_STATION_ID = 'wqf';
export const GRADUATION_PASS_MARK = 90;

/** صناديق لايتنر بالأيام */
export const BOX_DAYS = [0, 1, 3, 7, 16] as const;
const DAY_MS = 86_400_000;

/** عتبات النجوم */
export const STAR_THRESHOLDS = { three: 0.95, two: 0.85, one: 0.7 } as const;

export function emptyProgress(): QaidaProgress {
  return {
    xp: 0,
    streak: { count: 0, last: null, best: 0 },
    stats: { answered: 0, correct: 0, seconds: 0, reviews: 0, sessions: 0 },
    badges: [],
    stations: {},
    mastery: {},
    srs: {},
  };
}

/* -------------------------------------------------- المراجعة المتباعدة */
export function recordAnswer(p: QaidaProgress, key: string, correct: boolean, now = new Date()): void {
  if (!key) return;
  const card: SrsCard = p.srs[key] ?? { box: 0, due: now.toISOString(), seen: 0, wrong: 0 };
  card.seen += 1;
  if (correct) {
    card.box = Math.min(card.box + 1, BOX_DAYS.length - 1);
  } else {
    card.box = 0;
    card.wrong += 1;
  }
  card.due = new Date(now.getTime() + BOX_DAYS[card.box] * DAY_MS).toISOString();
  p.srs[key] = card;

  const cur = p.mastery[key] ?? 0;
  p.mastery[key] = correct
    ? Math.min(100, Math.round(cur + (100 - cur) * 0.34))
    : Math.max(0, Math.round(cur * 0.55));
}

export function dueItems(p: QaidaProgress, limit = 20, now = new Date()): string[] {
  const t = now.getTime();
  return Object.entries(p.srs)
    .filter(([, s]) => Date.parse(s.due) <= t && s.box < BOX_DAYS.length - 1)
    .sort((a, b) => a[1].box - b[1].box || Date.parse(a[1].due) - Date.parse(b[1].due))
    .slice(0, limit)
    .map(([k]) => k);
}

export function weakItems(p: QaidaProgress, limit = 12): [string, number][] {
  return Object.entries(p.mastery)
    .filter(([, v]) => v < 60)
    .sort((a, b) => a[1] - b[1])
    .slice(0, limit);
}

/* ------------------------------------------------------ تتابع الأيام */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function touchStreak(p: QaidaProgress, now = new Date()): void {
  const today = dayKey(now);
  if (p.streak.last === today) return;
  const yesterday = new Date(now.getTime() - DAY_MS);
  p.streak.count = p.streak.last === dayKey(yesterday) ? p.streak.count + 1 : 1;
  p.streak.last = today;
  p.streak.best = Math.max(p.streak.best, p.streak.count);
}

/* ------------------------------------------------ إنهاء محطة وتسجيلها */
export interface FinishOutcome {
  stars: 0 | 1 | 2 | 3;
  gained: number;
  pct: number;        // 0..100
  newBadges: string[];
}

export function starsFor(pct: number): 0 | 1 | 2 | 3 {
  if (pct >= STAR_THRESHOLDS.three) return 3;
  if (pct >= STAR_THRESHOLDS.two) return 2;
  if (pct >= STAR_THRESHOLDS.one) return 1;
  return 0;
}

export function finishStation(
  p: QaidaProgress,
  stationId: string,
  correct: number,
  total: number,
  seconds: number,
  now = new Date(),
): FinishOutcome {
  const pct = total ? correct / total : 0;
  const stars = starsFor(pct);
  const prev = p.stations[stationId] ?? { stars: 0 as const, best: 0, attempts: 0, lastAt: now.toISOString() };
  const gained = Math.round(correct * 10 + (stars === 3 ? 40 : stars === 2 ? 20 : 0));

  p.stations[stationId] = {
    stars: Math.max(prev.stars, stars) as 0 | 1 | 2 | 3,
    best: Math.max(prev.best, Math.round(pct * 100)),
    attempts: prev.attempts + 1,
    lastAt: now.toISOString(),
  };
  p.xp += gained;
  p.stats.sessions += 1;
  p.stats.seconds += Math.round(seconds);
  touchStreak(p, now);

  return { stars, gained, pct: Math.round(pct * 100), newBadges: awardBadges(p) };
}

/* ------------------------------------------------------------ الأوسمة */
const worldById = (id: string): World | undefined => WORLDS.find(w => w.id === id);

export function worldComplete(p: QaidaProgress, worldId: string): boolean {
  const w = worldById(worldId);
  if (!w) return false;
  return w.stations.every(s => (p.stations[s.id]?.stars ?? 0) > 0);
}

export function graduated(p: QaidaProgress): boolean {
  return (p.stations[FINAL_STATION_ID]?.best ?? 0) >= GRADUATION_PASS_MARK;
}

/** يمنح كل وسام استُحقّ ولم يُمنح بعد، ويُرجع الجديد منها فقط */
export function awardBadges(p: QaidaProgress): string[] {
  const earned: string[] = [];
  const give = (id: string, cond: boolean) => {
    if (cond && !p.badges.includes(id)) { p.badges.push(id); earned.push(id); }
  };

  give('first_steps', Object.keys(p.stations).length >= 1);
  give('letters', worldComplete(p, 'w1'));
  give('muqattaat', worldComplete(p, 'w1b'));
  give('families', worldComplete(p, 'wf'));
  give('tajweed', worldComplete(p, 'w8'));
  give('meem', worldComplete(p, 'w9'));
  give('tafkheem', worldComplete(p, 'w10'));
  give('reciter', worldComplete(p, 'wq'));
  give('perfect', Object.values(p.stations).some(s => s.best === 100));
  give('streak3', p.streak.count >= 3);
  give('streak7', p.streak.count >= 7);
  give('review50', p.stats.reviews >= 50);
  give('graduate', graduated(p));

  return earned;
}

/* ------------------------------------------------------- فتح المحطات */
export function worldUnlocked(p: QaidaProgress, index: number): boolean {
  if (index === 0) return true;
  const prev = WORLDS[index - 1];
  const done = prev.stations.filter(s => (p.stations[s.id]?.stars ?? 0) > 0).length;
  return done >= prev.stations.length - 1;
}

export function stationUnlocked(p: QaidaProgress, world: World, index: number): boolean {
  if (index === 0) return true;
  return (p.stations[world.stations[index - 1].id]?.stars ?? 0) > 0;
}

export function worldStats(p: QaidaProgress, w: World) {
  const total = w.stations.length;
  const done = w.stations.filter(s => (p.stations[s.id]?.stars ?? 0) > 0).length;
  const stars = w.stations.reduce((a, s) => a + (p.stations[s.id]?.stars ?? 0), 0);
  return { total, done, stars, pct: Math.round((done / total) * 100), complete: done === total };
}

/* ------------------------------------------------------------- الرتب */
export const RANK_THRESHOLDS = [0, 300, 900, 2000, 4000, 7000, 12000, 18000] as const;

/** يُرجع فهرس الرتبة؛ الاسم يأتي من ملفات الترجمة لا من الشيفرة */
export function rankIndex(xp: number): number {
  let i = 0;
  RANK_THRESHOLDS.forEach((t, k) => { if (xp >= t) i = k; });
  return i;
}

export function nextRankXp(xp: number): number | null {
  return RANK_THRESHOLDS.find(t => t > xp) ?? null;
}

/* -------------------------------------- تطبيق جلسة كاملة على التقدم
   هذه هي الدالة التي يستدعيها مسار الـ API: العميل يرسل الإجابات فقط،
   والخادم يحسب النجوم والنقاط والأوسمة. فلا يمكن تزوير النتيجة. */
export function applySession(
  p: QaidaProgress,
  input: { stationId: string | null; items: AnsweredItem[]; seconds: number; isReview: boolean },
  now = new Date(),
): FinishOutcome {
  const { stationId, items, seconds, isReview } = input;

  for (const item of items) recordAnswer(p, item.key, item.correct, now);

  const correct = items.filter(i => i.correct).length;
  p.stats.answered += items.length;
  p.stats.correct += correct;

  if (isReview) {
    p.stats.reviews += items.length;
    p.stats.seconds += Math.round(seconds);
    p.xp += correct * 6;
    touchStreak(p, now);
    const pct = items.length ? Math.round((correct / items.length) * 100) : 0;
    return { stars: 0, gained: correct * 6, pct, newBadges: awardBadges(p) };
  }

  return finishStation(p, stationId as string, correct, items.length, seconds, now);
}
