import { useEffect, useRef, useCallback } from 'react';
import { useJDStore } from './use-jd-store';

export function useAutoSave() {
  const { jdId, jd, setSaving, setLastSavedAt } = useJDStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDataRef = useRef<string>('');

  const save = useCallback(async () => {
    if (!jdId) return;

    const dataStr = JSON.stringify(jd);
    if (dataStr === lastDataRef.current) return;

    setSaving(true);
    try {
      await fetch(`/api/jd/${jdId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: jd,
          jobTitle: jd.jobTitle || '',
          orgUnit: jd.orgUnit || undefined,
          jobCode: jd.jobCode || undefined,
        }),
      });
      lastDataRef.current = dataStr;
      setLastSavedAt(Date.now());
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [jdId, jd, setSaving, setLastSavedAt]);

  useEffect(() => {
    if (!jdId) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, 30000); // 30 second debounce

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [jd, jdId, save]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (jdId && JSON.stringify(jd) !== lastDataRef.current) {
        // Fire-and-forget save on unmount
        fetch(`/api/jd/${jdId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: jd,
            jobTitle: jd.jobTitle || '',
            orgUnit: jd.orgUnit || undefined,
          }),
        }).catch(() => {});
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { save };
}
