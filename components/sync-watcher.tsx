"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type StatusEntry = { provider: string; status: string; lastSyncedAt: string | null };
type StatusResponse = { data: StatusEntry[] };

// Two background jobs:
// 1. Checks lastSyncedAt every 10s — triggers a dashboard refresh when a webhook sync lands.
// 2. Auto-syncs the connected provider every 30s — keeps data current without manual intervention.
export function SyncWatcher() {
  const router = useRouter();
  const lastSyncedAtRef = useRef<string | null>(undefined);
  const connectedProviderRef = useRef<string | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch("/api/integrations/status", {
          credentials: "include",
        });
        if (!res.ok) return;
        const payload = (await res.json()) as StatusResponse;
        const connected = payload.data.find((d) => d.status === "connected");
        connectedProviderRef.current = connected?.provider ?? null;
        const latest = connected?.lastSyncedAt ?? null;

        if (lastSyncedAtRef.current !== undefined && latest !== lastSyncedAtRef.current) {
          router.refresh();
        }
        lastSyncedAtRef.current = latest;
      } catch {}
    }

    async function autoSync() {
      const provider = connectedProviderRef.current;
      if (!provider) return;
      try {
        await fetch(`/api/integrations/sync/${provider}`, {
          method: "POST",
          credentials: "include",
        });
        await checkStatus();
      } catch {}
    }

    checkStatus();
    const statusInterval = setInterval(checkStatus, 10_000);
    const syncInterval = setInterval(autoSync, 30_000);
    return () => {
      clearInterval(statusInterval);
      clearInterval(syncInterval);
    };
  }, [router]);

  return null;
}
