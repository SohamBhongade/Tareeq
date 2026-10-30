"use client";
import { useEffect, useRef, useState } from "react";
import type { Report } from "@/lib/types";
import { api } from "./imageUtil";

/** Live report feed: initial data from the server, then polls every 3 s. */
export function useReports(initial: Report[], intervalMs = 3000) {
  const [reports, setReports] = useState(initial);
  const [online, setOnline] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const { reports } = await api<{ reports: Report[] }>("/api/reports");
          if (alive) { setReports(reports); setOnline(true); }
        } catch {
          if (alive) setOnline(false);
        }
      }
      if (alive) timer.current = setTimeout(tick, intervalMs);
    };
    timer.current = setTimeout(tick, intervalMs);
    return () => { alive = false; if (timer.current) clearTimeout(timer.current); };
  }, [intervalMs]);

  return { reports, online };
}
