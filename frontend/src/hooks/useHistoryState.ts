import { useCallback, useEffect, useRef, useState } from 'react';
import type { HistoryEntry } from '../types';
import { normalizeHistoryEntries } from '../lib/skuValueNormalization';
import { getQaSeedEntries, shouldAllowQaSeed } from '../lib/qaHistorySeeds';

const STORAGE_KEY = 'trial_production_history';
const DEBOUNCE_MS = 200;

export function useHistoryState() {
  const [history, setHistoryState] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [createNewPrompt, setCreateNewPrompt] = useState(false);
  const writeTimerRef = useRef<number | null>(null);
  const lastWrittenRef = useRef<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined' && shouldAllowQaSeed(window.location.hostname)) {
      const seeded = getQaSeedEntries(window.location.search);
      if (seeded) {
        const normalized = normalizeHistoryEntries(seeded);
        setHistoryState(normalized.entries);
        lastWrittenRef.current = JSON.stringify(normalized.entries);
        setShowHistory(true);
        return;
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as HistoryEntry[];
      const compatible = parsed.filter((e) =>
        e.skuData.every((sku) =>
          sku.supplies.every((sup) => typeof (sup as any).supplyKey === 'string')
        )
      );
      const normalized = normalizeHistoryEntries(compatible);
      setHistoryState(normalized.entries);
      lastWrittenRef.current = JSON.stringify(normalized.entries);
    } catch {
      // ignore parse error
    }
  }, []);

  const writeHistory = useCallback((next: HistoryEntry[]) => {
    if (writeTimerRef.current !== null) {
      window.clearTimeout(writeTimerRef.current);
    }
    writeTimerRef.current = window.setTimeout(() => {
      const serialized = JSON.stringify(next);
      if (serialized === lastWrittenRef.current) return;
      localStorage.setItem(STORAGE_KEY, serialized);
      lastWrittenRef.current = serialized;
      writeTimerRef.current = null;
    }, DEBOUNCE_MS);
  }, []);

  const setHistory = useCallback(
    (updater: HistoryEntry[] | ((prev: HistoryEntry[]) => HistoryEntry[])) => {
      setHistoryState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        writeHistory(next);
        return next;
      });
    },
    [writeHistory],
  );

  return {
    history,
    setHistory,
    showHistory,
    setShowHistory,
    createNewPrompt,
    setCreateNewPrompt,
  };
}
