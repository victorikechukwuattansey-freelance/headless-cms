/**
 * Deterministic clock control.
 *
 * The engine's Code nodes call `Date.now()` and `new Date()` directly, so time
 * travel has to happen at the global level. `withClock` installs a Date subclass
 * pinned to a fixed instant and always restores the real one, even on failure.
 *
 * The clock is injectable for tests and the offline replay only. It never
 * touches the workflow JSON.
 */

const RealDate = globalThis.Date;

/**
 * Run `fn` with `Date.now()` and `new Date()` pinned to `iso`.
 * @template T
 * @param {string|number} iso
 * @param {() => T} fn
 * @returns {T}
 */
export function withClock(iso, fn) {
  const fixed = typeof iso === 'number' ? iso : new RealDate(iso).getTime();

  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fixed);
      else super(...args);
    }
    static now() {
      return fixed;
    }
  }

  globalThis.Date = FakeDate;
  try {
    return fn(fixed);
  } finally {
    globalThis.Date = RealDate;
  }
}

/** Advance helper: returns an ISO string `hours` after `iso`. */
export function hoursAfter(iso, hours) {
  return new RealDate(new RealDate(iso).getTime() + hours * 3600 * 1000).toISOString();
}

export function daysAfter(iso, days) {
  return hoursAfter(iso, days * 24);
}
