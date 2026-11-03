"use client";

import { useEffect, useState } from "react";

/** Relógio que se atualiza periodicamente (evita chamar Date.now() durante o render). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
