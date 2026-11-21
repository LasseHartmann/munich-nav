'use client';

import { useEffect, useRef } from 'react';

export const WHEEL_ITEM_HEIGHT = 44;

interface ScrollWheelColumnProps {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  ariaLabel: string;
  testId: string;
}

export function ScrollWheelColumn({
  items,
  selectedIndex,
  onChange,
  ariaLabel,
  testId,
}: ScrollWheelColumnProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const isProgrammaticRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedRef = useRef(selectedIndex);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const isInitial = !mountedRef.current;
    mountedRef.current = true;

    if (!isInitial && selectedIndex === lastCommittedRef.current) {
      return;
    }

    lastCommittedRef.current = selectedIndex;
    const targetTop = selectedIndex * WHEEL_ITEM_HEIGHT;
    isProgrammaticRef.current = true;
    el.scrollTop = targetTop;
    const id = setTimeout(() => {
      isProgrammaticRef.current = false;
    }, 100);
    return () => clearTimeout(id);
  }, [selectedIndex]);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || isProgrammaticRef.current) return;

    const rawIdx = Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT);
    const clamped = Math.min(items.length - 1, Math.max(0, rawIdx));

    if (clamped !== lastCommittedRef.current) {
      lastCommittedRef.current = clamped;
      onChange(clamped);
    }

    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      if (!listRef.current) return;
      const snappedIdx = Math.min(
        items.length - 1,
        Math.max(0, Math.round(listRef.current.scrollTop / WHEEL_ITEM_HEIGHT))
      );
      if (snappedIdx !== lastCommittedRef.current) {
        lastCommittedRef.current = snappedIdx;
        onChange(snappedIdx);
      }
    }, 80);
  };

  const handleItemClick = (idx: number) => {
    const el = listRef.current;
    lastCommittedRef.current = idx;
    onChange(idx);
    if (el) {
      isProgrammaticRef.current = true;
      el.scrollTo({ top: idx * WHEEL_ITEM_HEIGHT, behavior: 'smooth' });
      setTimeout(() => {
        isProgrammaticRef.current = false;
      }, 280);
    }
  };

  return (
    <div
      ref={listRef}
      data-testid={testId}
      role="listbox"
      aria-label={ariaLabel}
      onScroll={handleScroll}
      style={{ height: `${WHEEL_ITEM_HEIGHT * 5}px` }}
      className="relative flex-1 overflow-y-auto snap-y snap-mandatory no-scrollbar touch-pan-y overscroll-contain"
    >
      <div style={{ height: `${WHEEL_ITEM_HEIGHT * 2}px` }} aria-hidden="true" />
      {items.map((label, idx) => {
        const dist = Math.abs(idx - selectedIndex);
        const isSelected = dist === 0;
        return (
          <button
            key={label}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => handleItemClick(idx)}
            style={{ height: `${WHEEL_ITEM_HEIGHT}px` }}
            className={`w-full snap-center flex items-center justify-center font-mono tabular-nums transition-colors cursor-pointer select-none ${
              isSelected
                ? 'text-2xl font-bold text-[#111111] dark:text-white'
                : dist === 1
                  ? 'text-lg font-medium text-[#767676] dark:text-[#888888]'
                  : 'text-base font-normal text-[#bdbdbd] dark:text-[#555555]'
            }`}
          >
            {label}
          </button>
        );
      })}
      <div style={{ height: `${WHEEL_ITEM_HEIGHT * 2}px` }} aria-hidden="true" />
    </div>
  );
}
