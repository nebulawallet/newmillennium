/**
 * Real-time driver for the simulation: speeds 1-5, pause. Uses setTimeout (not rAF) so the game
 * keeps time even when the tab is in the background. Several days may be processed per tick at
 * high speed; `onAdvance` fires once per batch for UI updates.
 */
import type { Simulation } from "./simulation.ts";

/** Milliseconds of real time per game day at each speed. */
export const MS_PER_DAY = [0, 1200, 600, 300, 120, 30];

export class Clock {
  speed = 2;
  paused = true;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private last = 0;
  private carry = 0;

  constructor(
    private sim: Simulation,
    private onAdvance: () => void,
  ) {}

  setSpeed(speed: number): void {
    this.speed = Math.max(1, Math.min(5, Math.round(speed)));
  }

  setPaused(p: boolean): void {
    this.paused = p;
    if (!p) {
      this.last = performance.now();
      this.carry = 0;
      this.schedule();
    } else if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  toggle(): void {
    this.setPaused(!this.paused);
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(this.tick, Math.min(50, MS_PER_DAY[this.speed]!));
  }

  private tick = (): void => {
    this.timer = null;
    if (this.paused) return;
    const now = performance.now();
    this.carry += now - this.last;
    this.last = now;
    const per = MS_PER_DAY[this.speed]!;
    let days = Math.floor(this.carry / per);
    this.carry -= days * per;
    days = Math.min(days, 10); // never stall the UI catching up
    if (days > 0) {
      for (let i = 0; i < days; i++) this.sim.step();
      this.onAdvance();
    }
    this.schedule();
  };

  dispose(): void {
    this.setPaused(true);
  }
}
