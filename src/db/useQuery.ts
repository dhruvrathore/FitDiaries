import { useCallback, useEffect, useState } from 'react';
import { addDatabaseChangeListener } from 'expo-sqlite';

/**
 * Runs an async DB query and re-runs it whenever the SQLite database changes,
 * so screens stay in sync after any insert/update/delete.
 */
export function useQuery<T>(
  fn: () => Promise<T>,
  deps: unknown[] = []
): { data: T | undefined; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const load = useCallback(() => {
    let active = true;
    run()
      .then((r) => active && (setData(r), setLoading(false)))
      .catch((e) => {
        console.warn('[useQuery]', e);
        active && setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [run]);

  useEffect(() => {
    const cancel = load();
    const sub = addDatabaseChangeListener(() => load());
    return () => {
      cancel();
      sub.remove();
    };
  }, [load]);

  return { data, loading, refresh: load };
}
