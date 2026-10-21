import { jtRestore, type JtEvent, type JtState } from '@studently/shared-utils';
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

// Exam timer state (brief Part D), shared by the board and its settings screen and saved on every
// change, so closing or crashing the app resumes exactly where the room was.

const KEY = 'jahbadh-exam-timer';
const SCHOOL = 'jahbadh-exam-timer-school';

function read(): JtState {
  try {
    return jtRestore(Storage.getItemSync(KEY));
  } catch {
    return jtRestore(null);
  }
}

let state: JtState = read();
const listeners = new Set<() => void>();

export function getTimer(): JtState {
  return state;
}

export function setTimer(next: JtState) {
  if (next === state) return;
  state = next;
  try {
    Storage.setItemSync(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: the timer keeps running in memory
  }
  listeners.forEach((l) => l());
}

/** Applies a change, optionally logging an event (the minutes). */
export function updateTimer(fn: (s: JtState) => JtState, event?: Omit<JtEvent, 'at'>) {
  const next = fn(state);
  setTimer(event ? { ...next, events: [...next.events, { ...event, at: Date.now() }] } : next);
}

export function useTimer(): JtState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getTimer,
    getTimer,
  );
}

export function readSchool(): { name: string; logo: string } {
  try {
    return JSON.parse(Storage.getItemSync(SCHOOL) ?? '') as { name: string; logo: string };
  } catch {
    return { name: '', logo: '' };
  }
}

export function saveSchool(v: { name: string; logo: string }) {
  try {
    Storage.setItemSync(SCHOOL, JSON.stringify(v));
  } catch {
    // optional
  }
}
