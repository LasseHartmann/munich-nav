'use client';

import { Footprints } from 'lucide-react';
import { getLineVisualStyle } from '@/lib/mvvColors';

interface LineBadgeProps {
  mode: string;
  line?: string;
  color?: string;
  textColor?: string;
  size?: 'xs' | 'sm' | 'md';
}

export function LineBadge({ mode, line, color, textColor, size = 'sm' }: LineBadgeProps) {
  const style = getLineVisualStyle(mode, line, color, textColor);

  const sizeClass =
    size === 'xs'
      ? 'text-[10px] px-1.5 py-0.5 min-w-[26px]'
      : size === 'md'
        ? 'text-xs px-2.5 py-1 min-w-[36px]'
        : 'text-[11px] px-2 py-0.5 min-w-[30px]';

  if (style.category === 'walk') {
    return (
      <span
        className={`inline-flex items-center justify-center gap-0.5 rounded-md font-semibold tracking-tight bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 ${sizeClass}`}
      >
        <Footprints className="w-3 h-3" />
      </span>
    );
  }

  // Authentic Munich shape cue: S-Bahn uses pill shape, U-Bahn/Tram/Bus use crisp rounded rectangles
  const radiusClass = style.category === 'sbahn' ? 'rounded-full' : 'rounded-md';

  return (
    <span
      style={{ backgroundColor: style.bg, color: style.text }}
      className={`inline-flex items-center justify-center font-bold tracking-tight leading-none shadow-xs select-none ${radiusClass} ${sizeClass}`}
    >
      {style.label}
    </span>
  );
}
