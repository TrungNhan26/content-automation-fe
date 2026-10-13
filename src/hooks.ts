import { useCallback, useEffect, useState } from "react";

export function usePolling<T>(loader: () => Promise<T>, interval = 2500) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setData(await loader());
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không đọc được dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    void refresh();
    // A hidden tab polls nothing: forgotten tabs must not burn the Cloudflare free-tier budget.
    const tick = () => { if (!document.hidden) void refresh(); };
    const timer = window.setInterval(tick, interval);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [interval, refresh]);

  return { data, error, loading, refresh };
}
