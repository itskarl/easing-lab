import { useEffect, useState, useSyncExternalStore } from "react";

/** Milliseconds since the latest play started, or null when idle. */
export function usePlayhead(playId: number, total: number) {
  const [elapsed, setElapsed] = useState<number | null>(null);
  useEffect(() => {
    if (!playId) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const e = now - start;
      if (e <= total + 200) {
        setElapsed(Math.min(e, total));
        raf = requestAnimationFrame(tick);
      } else {
        setElapsed(null);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setElapsed(null);
    };
    // Only a new play restarts the playhead; the total is read when it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playId]);
  return elapsed;
}

const query = "(prefers-reduced-motion: reduce)";
export function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}
