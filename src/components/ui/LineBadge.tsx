'use client';

import { Footprints } from 'lucide-react';
import { getLineVisualStyle } from '@/lib/mvvColors';

interface LineBadgeProps {
  mode: string;
  line?: string;
  color?: string;
  textColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function LineBadge({ mode, line, color, textColor, size = 'sm' }: LineBadgeProps) {
  const style = getLineVisualStyle(mode, line, color, textColor);

  const sizeClass =
    size === 'xs'
      ? 'text-[10px] px-1.5 py-0.5 min-w-[26px]'
      : size === 'lg'
        ? 'text-sm px-3 py-1.5 min-w-[44px]'
        : size === 'md'
          ? 'text-xs px-2.5 py-1 min-w-[38px]'
          : 'text-[11px] px-2 py-1 min-w-[32px]';

  if (style.category === 'walk') {
    return (
      <span
        className={`inline-flex items-center justify-center gap-1 rounded-lg font-bold tracking-tight bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100 ${sizeClass}`}
      >
        <Footprints className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      </span>
    );
  }

  // Authentic Munich transit badge shapes: S-Bahn pill, U-Bahn/Tram/Bus bold rounded rectangles
  const radiusClass = style.category === 'sbahn' ? 'rounded-full' : 'rounded-lg';

  return (
    <span
      style={{ backgroundColor: style.bg, color: style.text }}
      className={`inline-flex items-center justify-center font-extrabold tracking-tight leading-none shadow-sm ring-1 ring-black/10 select-none ${radiusClass} ${sizeClass}`}
    >
      {style.label}
    </span>
  );
}
