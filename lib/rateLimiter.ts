/**
 * Client-side sliding-window rate limiter.
 * Stores timestamps in sessionStorage to survive page reloads within a session.
 * Falls back gracefully (allows the action) if sessionStorage is unavailable.
 */
export function createRateLimiter(key: string, maxAttempts: number, windowMs: number) {
  function getTimestamps(): number[] {
    try {
      const raw = sessionStorage.getItem(`rl_${key}`);
      if (!raw) return [];
      return JSON.parse(raw) as number[];
    } catch {
      return [];
    }
  }

  function saveTimestamps(timestamps: number[]) {
    try {
      sessionStorage.setItem(`rl_${key}`, JSON.stringify(timestamps));
    } catch {
      // silently fail — rate limiting is best-effort on client
    }
  }

  return {
    /** Returns true if the action is allowed (under the limit) */
    tryAcquire(): boolean {
      const now = Date.now();
      const cutoff = now - windowMs;
      const timestamps = getTimestamps().filter((t) => t > cutoff);

      if (timestamps.length >= maxAttempts) {
        return false;
      }

      timestamps.push(now);
      saveTimestamps(timestamps);
      return true;
    },

    /** Returns seconds until the oldest attempt in the window expires */
    retryAfterSeconds(): number {
      const now = Date.now();
      const cutoff = now - windowMs;
      const timestamps = getTimestamps().filter((t) => t > cutoff);

      if (timestamps.length === 0) return 0;
      const oldest = timestamps[0];
      return Math.ceil((oldest + windowMs - now) / 1000);
    },

    /** Reset rate limit (e.g., after successful login) */
    reset() {
      try {
        sessionStorage.removeItem(`rl_${key}`);
      } catch {
        // ignore
      }
    },
  };
}
