export interface LineVisualStyle {
  bg: string;
  text: string;
  border?: string;
  label: string;
  category: 'ubahn' | 'sbahn' | 'tram' | 'bus' | 'regional' | 'walk' | 'other';
}

/** Official MVV / MVG Munich line colors */
const MUNICH_LINE_COLORS: Record<string, { bg: string; text: string }> = {
  // U-Bahn
  U1: { bg: '#4c7c32', text: '#ffffff' },
  U2: { bg: '#c40c37', text: '#ffffff' },
  U3: { bg: '#ec6725', text: '#ffffff' },
  U4: { bg: '#00a984', text: '#ffffff' },
  U5: { bg: '#bc7a00', text: '#ffffff' },
  U6: { bg: '#0065ae', text: '#ffffff' },
  U7: { bg: '#c40c37', text: '#ffffff' },
  U8: { bg: '#ec6725', text: '#ffffff' },
  // S-Bahn
  S1: { bg: '#16bae7', text: '#ffffff' },
  S2: { bg: '#76b82a', text: '#ffffff' },
  S3: { bg: '#951b81', text: '#ffffff' },
  S4: { bg: '#e30613', text: '#ffffff' },
  S5: { bg: '#005e86', text: '#ffffff' },
  S6: { bg: '#008e4e', text: '#ffffff' },
  S7: { bg: '#963833', text: '#ffffff' },
  S8: { bg: '#1d1d1b', text: '#f5b800' },
  S20: { bg: '#ee7599', text: '#ffffff' },
};

function normalizeHex(hex?: string): string | undefined {
  if (!hex) return undefined;
  const cleaned = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toLowerCase()}`;
  }
  return undefined;
}

export function getLineVisualStyle(
  mode: string,
  lineName?: string,
  apiColor?: string,
  apiTextColor?: string
): LineVisualStyle {
  const upperMode = (mode || '').toUpperCase();
  const rawLine = (lineName || '').trim();
  const normalizedLine = rawLine.toUpperCase().replace(/\s+/g, '');

  if (upperMode === 'WALK' || upperMode === 'FOOT') {
    return { bg: '#64748b', text: '#ffffff', label: 'Walk', category: 'walk' };
  }

  // Exact Munich U-Bahn or S-Bahn match first
  if (MUNICH_LINE_COLORS[normalizedLine]) {
    const c = MUNICH_LINE_COLORS[normalizedLine];
    return {
      bg: c.bg,
      text: c.text,
      label: rawLine,
      category: normalizedLine.startsWith('U') ? 'ubahn' : 'sbahn',
    };
  }

  // Infer category from mode or line prefix
  let category: LineVisualStyle['category'] = 'other';
  if (upperMode === 'SUBWAY' || upperMode === 'METRO' || /^U\d+/i.test(normalizedLine)) {
    category = 'ubahn';
  } else if (upperMode === 'SUBURBAN' || /^S\d+/i.test(normalizedLine)) {
    category = 'sbahn';
  } else if (upperMode === 'TRAM') {
    category = 'tram';
  } else if (upperMode === 'BUS' || upperMode === 'COACH') {
    category = 'bus';
  } else if (
    upperMode.includes('RAIL') ||
    upperMode === 'TRAIN' ||
    /^(RE|RB|BRB|ALEX|IC|ICE|EC)\b/i.test(rawLine)
  ) {
    category = 'regional';
  }

  // ExpressBus in Munich (X30, X35, X36, X80, etc.)
  if (category === 'bus' && /^X\d+/i.test(normalizedLine)) {
    return {
      bg: '#4a9d4e',
      text: '#ffffff',
      label: rawLine || 'X-Bus',
      category: 'bus',
    };
  }

  const parsedBg = normalizeHex(apiColor);
  const parsedText = normalizeHex(apiTextColor);

  const defaults: Record<LineVisualStyle['category'], { bg: string; text: string }> = {
    ubahn: { bg: '#0065ae', text: '#ffffff' },
    sbahn: { bg: '#008e4e', text: '#ffffff' },
    tram: { bg: '#e30613', text: '#ffffff' },
    bus: { bg: '#00586a', text: '#ffffff' },
    regional: { bg: '#1e3a8a', text: '#ffffff' },
    walk: { bg: '#64748b', text: '#ffffff' },
    other: { bg: '#475569', text: '#ffffff' },
  };

  return {
    bg: parsedBg ?? defaults[category].bg,
    text: parsedText ?? defaults[category].text,
    label: rawLine || upperMode,
    category,
  };
}

export function getModeColor(mode: 'transit' | 'foot' | 'bike' | 'car'): string {
  switch (mode) {
    case 'transit':
      return '#0065ae';
    case 'foot':
      return '#0d9488';
    case 'bike':
      return '#16a34a';
    case 'car':
      return '#2563eb';
  }
}

export function getStationPrimaryMode(modes: string[]): 'ubahn' | 'sbahn' | 'tram' | 'bus' | 'regional' {
  const set = new Set(modes.map((m) => m.toUpperCase()));
  if (set.has('SUBWAY') || set.has('METRO')) return 'ubahn';
  if (set.has('SUBURBAN')) return 'sbahn';
  if (set.has('TRAM')) return 'tram';
  if (set.has('REGIONAL_RAIL') || set.has('REGIONAL_FAST_RAIL') || set.has('RAIL')) return 'regional';
  return 'bus';
}
