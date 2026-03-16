import { useEffect, useRef, useState } from 'react';

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number = 5 * 60 * 1000
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;

    async function doFetch() {
      try {
        const result = await fetcherRef.current();
        if (!cancelled) setData(result);
      } catch {
        // Keep existing data on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    doFetch();
    const id = setInterval(doFetch, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  const refetch = async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
    } catch {
      // Keep existing data
    }
  };

  return { data, loading, refetch };
}
