export interface QaidaState {
  srs: Record<string, { box: number; lastSeen: number }>;
  stationAttempts: Record<string, number>;
  badgesUnlocked: string[];
}

export interface SessionSubmission {
  worldId: string;
  stationId: string;
  isReview: boolean;
  seconds: number;
  items: { key: string; correct: boolean }[];
  overallAccuracyBeforeSession: number;
}

export interface ApplySessionResult {
  newState: QaidaState;
  stars: number;
  xpAwarded: number;
  badgesUnlocked: string[];
  graduated: boolean;
  accuracy: number;
}

const REQUIRED_STATIONS_COUNT = 95;

export function calculateAccuracy(items: { correct: boolean }[]): number {
  if (!items || items.length === 0) return 0;
  const correctCount = items.filter(i => i.correct).length;
  // Use Math.round for precise 2 decimal places to match numeric(5,2)
  return Math.round((correctCount / items.length) * 10000) / 100;
}

export function calculateStars(accuracy: number): number {
  if (accuracy >= 95) return 3;
  if (accuracy >= 80) return 2;
  if (accuracy >= 60) return 1;
  return 0;
}

export function evaluateBadges(state: QaidaState, submission: SessionSubmission, accuracy: number, stars: number): string[] {
  const newBadges: string[] = [];
  const existing = new Set(state.badgesUnlocked || []);
  
  if (accuracy === 100 && !existing.has('perfect_station')) {
    newBadges.push('perfect_station');
  }
  
  if (submission.seconds < 30 && submission.items.length >= 10 && accuracy >= 80 && !existing.has('speed_demon')) {
    newBadges.push('speed_demon');
  }
  
  return newBadges;
}

export function applySession(currentState: QaidaState, submission: SessionSubmission): ApplySessionResult {
  const state: QaidaState = {
    srs: { ...(currentState.srs || {}) },
    stationAttempts: { ...(currentState.stationAttempts || {}) },
    badgesUnlocked: [...(currentState.badgesUnlocked || [])]
  };
  
  const now = Math.floor(Date.now() / 1000);
  
  const accuracy = calculateAccuracy(submission.items);
  const stars = calculateStars(accuracy);
  
  for (const item of (submission.items || [])) {
    const currentBox = state.srs[item.key]?.box || 0;
    let newBox = 1;
    if (item.correct) {
      newBox = Math.min(currentBox + 1, 5);
    }
    state.srs[item.key] = { box: newBox, lastSeen: now };
  }
  
  const attemptCount = (state.stationAttempts[submission.stationId] || 0) + 1;
  state.stationAttempts[submission.stationId] = attemptCount;
  
  let xpAwarded = 0;
  if (stars > 0) {
    xpAwarded += 10;
    xpAwarded += stars * 5;
    if (submission.isReview) xpAwarded += 5;
  }
  
  const newBadges = evaluateBadges(state, submission, accuracy, stars);
  state.badgesUnlocked.push(...newBadges);
  
  let graduated = false;
  // Using W13_S8 as the final graduation gate based on the brief (13 worlds, culminating in surahs)
  if (submission.worldId === '13' && accuracy >= 90) {
    const newOverall = (submission.overallAccuracyBeforeSession * (REQUIRED_STATIONS_COUNT - 1) + accuracy) / REQUIRED_STATIONS_COUNT;
    if (newOverall >= 90) {
      graduated = true;
    }
  }

  return {
    newState: state,
    stars,
    xpAwarded,
    badgesUnlocked: newBadges,
    graduated,
    accuracy
  };
}
