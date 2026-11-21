export type TravelMode = 'transit' | 'foot' | 'bike' | 'car';
export type MapStyleMode = 'standard' | 'hybrid';
export type ThemeMode = 'light' | 'dark';
export type Language = 'en' | 'de';

export type TransitFilterKey = 'SUBWAY' | 'SUBURBAN' | 'TRAM' | 'BUS' | 'REGIONAL';

export type TransitTimeMode = 'now' | 'departAt' | 'arriveBy';

export type WalkIntensity = 'balanced' | 'strong';

export interface WalkOptions {
  preferGreen: boolean;
  preferQuiet: boolean;
  avoidSteps: boolean;
  intensity: WalkIntensity;
}

export interface WalkMetrics {
  greenPercent: number;
  quietPercent: number;
}

export interface PlaceResult {
  id: string;
  name: string;
  subtitle?: string;
  lat: number;
  lon: number;
  category: 'station' | 'address' | 'poi' | 'pin' | 'gps';
  stopId?: string;
  transitModes?: string[];
}

export interface Waypoint {
  uid: string;
  place: PlaceResult | null;
  /** Stay duration in minutes at intermediate stops (used for public transport chaining). */
  dwellMinutes: number;
}

export interface RoadManeuver {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  type: number | string;
  beginShapeIndex?: number;
  endShapeIndex?: number;
  location?: [number, number]; // [lon, lat]
  streetNames?: string[];
}

export interface RoadRouteLeg {
  fromIndex: number;
  toIndex: number;
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][]; // [lon, lat][]
  maneuvers: RoadManeuver[];
}

export interface RoadRouteResult {
  mode: Exclude<TravelMode, 'transit'>;
  provider: 'ors' | 'valhalla';
  calculatedAt?: string;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  walkMetrics?: WalkMetrics;
  legs: RoadRouteLeg[];
  coordinates: [number, number][]; // full combined [lon, lat][]
}

export interface TransitIntermediateStop {
  name: string;
  stopId?: string;
  lat: number;
  lon: number;
  arrival?: string;
  departure?: string;
  track?: string;
}

export interface TransitSegment {
  id: string;
  mode: string; // WALK, SUBWAY, SUBURBAN, TRAM, BUS, REGIONAL_RAIL, etc.
  fromName: string;
  fromStopId?: string;
  fromLat: number;
  fromLon: number;
  fromTrack?: string;
  toName: string;
  toStopId?: string;
  toLat: number;
  toLon: number;
  toTrack?: string;
  startTime: string;
  scheduledStartTime?: string;
  endTime: string;
  scheduledEndTime?: string;
  startDelayMinutes: number;
  endDelayMinutes: number;
  durationSeconds: number;
  distanceMeters?: number;
  routeShortName?: string;
  routeLongName?: string;
  routeColor?: string;
  routeTextColor?: string;
  headsign?: string;
  realTime: boolean;
  cancelled: boolean;
  intermediateStops: TransitIntermediateStop[];
  coordinates: [number, number][]; // [lon, lat][]
  walkMetrics?: WalkMetrics;
}

export interface TransitItinerary {
  id: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  transfers: number;
  walkDistanceMeters: number;
  segments: TransitSegment[];
}

export interface TransitMultiStopLeg {
  legIndex: number;
  fromLabel: string;
  toLabel: string;
  fromCoord: [number, number]; // [lon, lat]
  toCoord: [number, number];
  requestedDepartureTime: string;
  /** Dwell duration AFTER arriving at `toLabel` (for intermediate stops). */
  dwellAfterMinutes: number;
  alternatives: TransitItinerary[];
  selectedIndex: number;
  error?: string;
}

export interface TransitPlanResult {
  departureTime: string;
  arriveBy?: boolean;
  targetTime?: string;
  totalDurationSeconds: number;
  totalTravelSeconds: number;
  totalDwellSeconds: number;
  walkMetrics?: WalkMetrics;
  legs: TransitMultiStopLeg[];
}

export interface MapStation {
  stopId: string;
  parentId?: string;
  name: string;
  lat: number;
  lon: number;
  modes: string[];
  importance: number;
}

export interface StationDeparture {
  id: string;
  mode: string;
  line: string;
  color?: string;
  textColor?: string;
  headsign: string;
  track?: string;
  scheduledTime: string;
  realTimeTime: string;
  delayMinutes: number;
  isRealTime: boolean;
  cancelled: boolean;
}

export interface SavedPlace extends PlaceResult {
  savedAt: number;
  label?: string;
}

export interface HighlightSelection {
  type: 'transit-segment' | 'road-maneuver' | 'leg';
  coordinates: [number, number][];
  label?: string;
}
