import { useEffect, useState } from "react";
import { heartbeatFn } from "./api";

const STORAGE_KEY = "affairs.viewerId";
const PING_MS = 15_000;

function visitorId(): string {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,80}$/.test(existing)) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return `tmp-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function useViewers(): number | null {
  const [online, setOnline] = useState<number | null>(null);
  useEffect(() => {
    const id = visitorId();
    let stopped = false;
    async function ping(leave = false) {
      if (!leave && document.visibilityState === "hidden") return;
      try {
        const res = await heartbeatFn({ data: { visitorId: id, leave } });
        if (!stopped && !leave) setOnline(res.online);
      } catch {}
    }
    void ping();
    const timer = window.setInterval(() => void ping(), PING_MS);
    const onVis = () => { if (document.visibilityState === "visible") void ping(); };
    const onLeave = () => { stopped = true; void ping(true); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onLeave);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onLeave);
      void ping(true);
    };
  }, []);
  return online;
}
