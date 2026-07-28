import { create } from 'zustand';

type RestState = {
  active: boolean;
  paused: boolean;
  remaining: number;
  total: number;
  /** Absolute epoch ms when the timer ends; null while paused/inactive. */
  endsAt: number | null;
  soundEnabled: boolean;
  justCompleted: boolean;
  /** What the next set is, shown on the rest overlay, e.g. "Squats · set 3". */
  label: string | null;
  start: (total: number, soundEnabled: boolean, label?: string | null) => void;
  extend: (sec: number) => void;
  togglePause: () => void;
  skip: () => void;
  /** Recompute `remaining` from the wall clock; completes when it hits 0. */
  sync: () => void;
  clearCompleted: () => void;
};

/**
 * Between-sets rest timer. Time-based (not tick-counted) so it stays correct
 * after the app is backgrounded / the screen turns off: `remaining` is derived
 * from `endsAt - now`, and `sync()` is called both on a 1s interval and when the
 * app returns to the foreground.
 */
export const useRestStore = create<RestState>((set) => ({
  active: false,
  paused: false,
  remaining: 0,
  total: 0,
  endsAt: null,
  soundEnabled: true,
  justCompleted: false,
  label: null,
  start: (total, soundEnabled, label = null) =>
    set({
      active: true,
      paused: false,
      remaining: total,
      total,
      endsAt: Date.now() + total * 1000,
      soundEnabled,
      justCompleted: false,
      label,
    }),
  extend: (sec) =>
    set((s) => {
      const remaining = s.remaining + sec;
      return {
        active: true,
        paused: false,
        remaining,
        total: Math.max(s.total, remaining),
        endsAt: (s.paused || s.endsAt == null ? Date.now() : s.endsAt) + sec * 1000,
      };
    }),
  togglePause: () =>
    set((s) => {
      if (s.paused) {
        // resume: re-anchor the end time to now + whatever's left
        return { paused: false, endsAt: Date.now() + s.remaining * 1000 };
      }
      // pause: freeze remaining, drop the anchor
      return { paused: true, endsAt: null };
    }),
  skip: () => set({ active: false, paused: false, remaining: 0, endsAt: null, justCompleted: false }),
  sync: () =>
    set((s) => {
      if (!s.active || s.paused || s.endsAt == null) return s;
      const remaining = Math.max(0, Math.ceil((s.endsAt - Date.now()) / 1000));
      if (remaining <= 0) {
        return { remaining: 0, active: false, paused: false, endsAt: null, justCompleted: true };
      }
      return { remaining };
    }),
  clearCompleted: () => set({ justCompleted: false }),
}));
