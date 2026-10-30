"use client";
import { createContext, useCallback, useContext, useState } from "react";

type Tone = "ok" | "warn" | "error";
interface ToastItem { id: number; text: string; tone: Tone }

const Ctx = createContext<(text: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: Tone = "ok") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[1200] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto max-w-md rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
              t.tone === "ok"
                ? "border-olive/40 bg-surface-high/95 text-ink"
                : t.tone === "warn"
                  ? "border-moderate/50 bg-surface-high/95 text-moderate"
                  : "border-critical/50 bg-surface-high/95 text-critical"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
