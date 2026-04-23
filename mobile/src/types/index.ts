export interface User {
  id: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  prefs: UserPreferences;
  trust_score: number;
  points: number;
  created_at?: string;
}

export interface UserPreferences {
  avoid_stairs?: boolean;
  prefer_shade?: boolean;
  background_tracking?: boolean;
  trace_sharing?: 'none' | 'anonymous' | 'full';
  walk_speed_mps?: number;
  run_speed_mps?: number;
  units?: 'metric' | 'imperial';
  language?: string;
}

export interface Edge {
  edge_id: number;
  geometry: GeoJSONLineString;
  length_m: number;
  elevation_gain: number;
  stairs_flag: boolean;
  shade_score: number;
  avg_time_walk: number | null;
  avg_time_run: number | null;
  sample_count: number;
  is_closed: boolean;
  closure_reason: string | null;
}

export interface Observation {
  travel_time_s: number;
  speed_mps: number;
  mode: string;
  accuracy: number;
  observed_at: string;
}

export interface Trace {
  id: number;
  user_id?: number;
  geometry: GeoJSONLineString;
  started_at: string;
  ended_at: string;
  mode: 'walk' | 'run';
  distance_m: number;
  flagged: boolean;
  created_at: string;
}

export interface Pin {
  id: number;
  user_id: number;
  lat: number;
  lon: number;
  type: 'hazard' | 'closure' | 'construction' | 'tip' | 'photo';
  title: string;
  description?: string;
  photo_url?: string;
  verified_count: number;
  expires_at?: string;
  created_at: string;
}

export interface Route {
  id: string;
  type: 'fastest' | 'easiest' | 'scenic';
  estimated_time_s: number;
  distance_m: number;
  energy_kcal: number;
  verification_score: number;
  percent_unverified: number;
  elevation_gain_m: number;
  shade_percentage: number;
  polyline: string;
  geometry: GeoJSONLineString;
  steps: RouteStep[];
  source?: 'community' | 'standard';
}

export interface RouteStep {
  instruction: string;
  distance_m: number;
  edge_id: string;
  verified: boolean;
}

export interface HeatmapCell {
  lat: number;
  lon: number;
  sample_count: number;
  intensity: number;
}

export interface Shortcut {
  id: number;
  user_id: number;
  geometry: GeoJSONLineString;
  name: string;
  description?: string;
  time_saved_s: number;
  validated: boolean;
  validation_count: number;
  created_at: string;
}

export interface DiscoveredRoute {
  id: number;
  geometry: GeoJSONLineString;
  origin_lat: number;
  origin_lon: number;
  dest_lat: number;
  dest_lon: number;
  distance_m: number;
  estimated_time_s: number;
  endorsement_count: number;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  display_name: string;
  points: number;
}

export interface Badge {
  id: number;
  name: string;
  description: string;
  icon_url?: string;
  earned_at: string;
}

export interface PointsEntry {
  id: number;
  points: number;
  reason: string;
  created_at: string;
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface LatLng {
  latitude: number;
  longitude: number;
}
