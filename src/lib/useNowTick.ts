'use client';

import { useSyncExternalStore } from 'react';

let currentNow = Date.now();
const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (typeof window !== 'undefined' && intervalId === null) {
    currentNow = Date.now();
    intervalId = setInterval(() => {
      currentNow = Date.now();
      listeners.forEach((fn) => fn());
    }, 30_000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot(): number {
  return currentNow;
}

function getServerSnapshot(): number {
  return 0;
}

/**
 * Pure, React 19-safe live clock hook updating every 30s for real-time departure countdowns.
 * Returns 0 on SSR and real epoch ms on client.
 */
export function useNowTick(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
