import { NextRequest, NextResponse } from 'next/server';
import { diffMinutes } from '@/lib/geo';
import type { StationDeparture } from '@/lib/types';

const USER_AGENT = 'MucNav/0.1 (Munich Multi-Stop Navigation Web App)';

interface RawStopTime {
  mode?: string;
  realTime?: boolean;
  headsign?: string;
  routeShortName?: string;
  routeColor?: string;
  routeTextColor?: string;
  place?: {
    departure?: string;
    scheduledDeparture?: string;
    track?: string;
    scheduledTrack?: string;
    cancelled?: boolean;
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const stopId = searchParams.get('stopId')?.trim();
  const limit = Math.min(30, Math.max(5, Number(searchParams.get('n')) || 16));

  if (!stopId) {
    return NextResponse.json({ error: 'Missing stopId' }, { status: 400 });
  }

  try {
    const url =
      `https://api.transitous.org/api/v5/stoptimes?stopId=${encodeURIComponent(stopId)}` +
      `&n=${limit}&time=${encodeURIComponent(new Date().toISOString())}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Transitous stoptimes HTTP ${res.status}: ${t.slice(0, 120)}`, departures: [] },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { stopTimes?: RawStopTime[] };
    const departures: StationDeparture[] = (data.stopTimes || [])
      .filter((st) => (st.mode || '').toUpperCase() !== 'RIDE_SHARING' && st.place?.departure)
      .map((st, idx) => {
        const realTimeTime = st.place?.departure || '';
        const scheduledTime = st.place?.scheduledDeparture || realTimeTime;
        return {
          id: `${stopId}-${idx}-${st.routeShortName ?? ''}-${realTimeTime}`,
          mode: (st.mode || 'BUS').toUpperCase(),
          line: st.routeShortName || st.mode || '?',
          color: st.routeColor || undefined,
          textColor: st.routeTextColor || undefined,
          headsign: st.headsign || '',
          track: st.place?.track || st.place?.scheduledTrack || undefined,
          scheduledTime,
          realTimeTime,
          delayMinutes: diffMinutes(realTimeTime, scheduledTime),
          isRealTime: Boolean(st.realTime),
          cancelled: Boolean(st.place?.cancelled),
        };
      });

    return NextResponse.json(
      { departures, updatedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch departures';
    return NextResponse.json({ error: message, departures: [] }, { status: 502 });
  }
}
