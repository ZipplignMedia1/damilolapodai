import { useSyncExternalStore, useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

// ── Module-level counter store ─────────────────────────────
let count = 0;
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}

export const loadingBar = {
  start() {
    count++;
    emit();
  },
  end() {
    count = Math.max(0, count - 1);
    emit();
  },
  reset() {
    count = 0;
    emit();
  },
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() {
  return count;
}
function getServerSnapshot() {
  return 0;
}

/** Hook: wrap any async op to drive the global loading bar. */
export function useLoadingTask() {
  return async function withLoading<T>(fn: () => Promise<T>): Promise<T> {
    loadingBar.start();
    try {
      return await fn();
    } finally {
      loadingBar.end();
    }
  };
}

export function LoadingBar() {
  const busy = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const routerBusy = useRouterState({
    select: (s) => s.isLoading || s.isTransitioning,
  });

  // Reset on unmount safety
  useEffect(() => () => loadingBar.reset(), []);

  const active = busy > 0 || routerBusy;

  return (
    <div
      aria-hidden={!active}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
    >
      <div
        className={`h-full bg-primary transition-opacity duration-200 ${
          active ? "opacity-100" : "opacity-0"
        }`}
        style={{
          width: "100%",
          backgroundImage:
            "linear-gradient(90deg, transparent 0%, hsl(var(--primary)) 50%, transparent 100%)",
          animation: active ? "loadingbar-slide 1.1s linear infinite" : "none",
        }}
      />
      <style>{`
        @keyframes loadingbar-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
