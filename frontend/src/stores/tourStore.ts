import { create } from "zustand";

interface TourState {
  active: boolean;
  stepIndex: number;
  start: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
}

export const useTourStore = create<TourState>((set) => ({
  active: false,
  stepIndex: 0,
  start: () => set({ active: true, stepIndex: 0 }),
  stop: () => set({ active: false, stepIndex: 0 }),
  next: () => set((s) => ({ stepIndex: s.stepIndex + 1 })),
  prev: () => set((s) => ({ stepIndex: Math.max(0, s.stepIndex - 1) })),
}));

export function tourSeenKey(userId: string): string {
  return `tour_seen_${userId}`;
}

export function hasSeenTour(userId: string): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(tourSeenKey(userId)) === "1";
}

export function markTourSeen(userId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(tourSeenKey(userId), "1");
}
