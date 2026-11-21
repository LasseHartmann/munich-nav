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
      ? 'text-[10px] px-1.5 py-[2px] min-w-[24px]'
      : size === 'lg'
        ? 'text-xs px-2.5 py-1 min-w-[40px]'
        : size === 'md'
          ? 'text-[11px] px-2 py-[3px] min-w-[34px]'
          : 'text-[11px] px-1.5 py-[2px] min-w-[28px]';

  if (style.category === 'walk') {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-[3px] font-medium bg-[#ececec] text-[#333333] dark:bg-[#333333] dark:text-[#e5e5e5] ${sizeClass}`}
      >
        <Footprints className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      </span>
    );
  }

  // Swiss/Munich signage precision: S-Bahn pill, U-Bahn/Tram/Bus crisp 3px rectangles, flat color
  const radiusClass = style.category === 'sbahn' ? 'rounded-full' : 'rounded-[3px]';

  return (
    <span
      style={{ backgroundColor: style.bg, color: style.text }}
      className={`inline-flex items-center justify-center font-bold tracking-tight leading-none select-none ${radiusClass} ${sizeClass}`}
    >
      {style.label}
    </span>
  );
}
