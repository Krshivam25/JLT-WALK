/**
 * TrackingService.ts
 *
 * Background walk tracking service for JLT Walk.
 * Default ON — records GPS traces while the user is moving,
 * stores them locally, and batch-uploads to the API.
 *
 * Singleton pattern: import { trackingService } from './TrackingService';
 */

import Geolocation, {
  GeoPosition,
  GeoWatchOptions,
} from 'react-native-geolocation-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { tracesApi } from './api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Coordinate {
  lon: number;
  lat: number;
}

interface TraceSegment {
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lon, lat]
  };
  started_at: string;
  ended_at: string;
  mode: 'walk';
  confidence: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_ENABLED = 'walk_tracking_enabled';
const STORAGE_KEY_PENDING = 'walk_pending_traces';

/** Default GPS poll interval in milliseconds. */
const DEFAULT_INTERVAL_MS = 2_000;

/** Reduced interval when battery is low. */
const LOW_BATTERY_INTERVAL_MS = 5_000;

/** Minimum speed (m/s) to consider the user moving. */
const MIN_SPEED = 0.3;

/** Maximum segment length (metres) before auto-committing. */
const MAX_SEGMENT_DISTANCE_M = 200;

/** Auto-upload interval in milliseconds (5 minutes). */
const AUTO_UPLOAD_INTERVAL_MS = 5 * 60 * 1_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a confidence score from GPS horizontal accuracy.
 */
function confidenceFromAccuracy(accuracy: number): number {
  if (accuracy < 10) return 1.0;
  if (accuracy < 20) return 0.8;
  if (accuracy < 50) return 0.5;
  return 0.3;
}

/**
 * Haversine distance in metres between two WGS-84 points.
 */
function haversineDistance(a: Coordinate, b: Coordinate): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLon * sinDLon;

  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Total length of a coordinate array in metres.
 */
function polylineLength(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineDistance(
      { lon: coords[i - 1][0], lat: coords[i - 1][1] },
      { lon: coords[i][0], lat: coords[i][1] },
    );
  }
  return total;
}

// ---------------------------------------------------------------------------
// TrackingService
// ---------------------------------------------------------------------------

class TrackingService {
  // --- State ---
  private watchId: number | null = null;
  private currentSegment: TraceSegment | null = null;
  private segmentLength = 0; // running length in metres
  private lastCoord: Coordinate | null = null;
  private confidenceSum = 0;
  private confidenceCount = 0;
  private uploadTimer: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private enabled = true; // in-memory cache; authoritative value is in AsyncStorage

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /**
   * Initialise the service: read persisted enabled state and, if enabled,
   * start tracking. Should be called once at app start.
   */
  async init(): Promise<void> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_ENABLED);
    // Default to true when no preference has been stored yet.
    this.enabled = stored === null ? true : stored === 'true';

    if (this.enabled) {
      this.startTracking();
    }
  }

  /**
   * Begin recording GPS traces.
   */
  startTracking(): void {
    if (this.watchId !== null) {
      return; // already tracking
    }

    this.enabled = true;
    AsyncStorage.setItem(STORAGE_KEY_ENABLED, 'true').catch(() => {});

    this.beginNewSegment();
    this.startWatching(DEFAULT_INTERVAL_MS);
    this.startAutoUpload();
    this.listenToAppState();
  }

  /**
   * Stop recording and clear all pending traces.
   */
  async stopTracking(): Promise<void> {
    this.enabled = false;
    await AsyncStorage.setItem(STORAGE_KEY_ENABLED, 'false');

    this.stopWatching();
    this.stopAutoUpload();
    this.removeAppStateListener();
    this.currentSegment = null;
    this.segmentLength = 0;
    this.lastCoord = null;
    this.confidenceSum = 0;
    this.confidenceCount = 0;
    await this.clearPendingTraces();
  }

  /**
   * Whether tracking is currently active.
   */
  isTracking(): boolean {
    return this.watchId !== null;
  }

  /**
   * Retrieve all locally-stored pending traces.
   */
  async getPendingTraces(): Promise<TraceSegment[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_PENDING);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Upload all pending traces to the API in a single batch.
   */
  async uploadPendingTraces(): Promise<void> {
    const traces = await this.getPendingTraces();
    if (traces.length === 0) return;

    try {
      if (traces.length === 1) {
        await tracesApi.submit(traces[0]);
      } else {
        await tracesApi.batch(traces);
      }
      // Only clear after a successful upload.
      await this.clearPendingTraces();
    } catch (err) {
      // Network failure is expected when offline — traces stay queued.
      console.warn('[TrackingService] Upload failed, will retry later:', err);
    }
  }

  /**
   * Remove all locally-stored pending traces.
   */
  async clearPendingTraces(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY_PENDING);
  }

  // ------------------------------------------------------------------
  // Private — GPS watching
  // ------------------------------------------------------------------

  private startWatching(intervalMs: number): void {
    const options: GeoWatchOptions = {
      enableHighAccuracy: true,
      distanceFilter: 0,
      interval: intervalMs,
      fastestInterval: intervalMs,
      showsBackgroundLocationIndicator: true,
    };

    this.watchId = Geolocation.watchPosition(
      (position) => this.onPosition(position),
      (error) => console.warn('[TrackingService] GPS error:', error.message),
      options,
    );
  }

  private stopWatching(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  // ------------------------------------------------------------------
  // Private — position handling
  // ------------------------------------------------------------------

  private onPosition(position: GeoPosition): void {
    const { latitude, longitude, speed, accuracy } = position.coords;

    // Filter out idle readings.
    const effectiveSpeed = speed !== null && speed >= 0 ? speed : 0;
    if (effectiveSpeed < MIN_SPEED) {
      return;
    }

    const coord: Coordinate = { lon: longitude, lat: latitude };
    const confidence = confidenceFromAccuracy(accuracy);

    // Accumulate confidence for averaging.
    this.confidenceSum += confidence;
    this.confidenceCount += 1;

    if (!this.currentSegment) {
      this.beginNewSegment();
    }

    const segment = this.currentSegment!;
    segment.geometry.coordinates.push([coord.lon, coord.lat]);
    segment.ended_at = new Date().toISOString();

    // Update running length.
    if (this.lastCoord) {
      this.segmentLength += haversineDistance(this.lastCoord, coord);
    }
    this.lastCoord = coord;

    // Auto-commit if the segment exceeds the maximum distance.
    if (this.segmentLength >= MAX_SEGMENT_DISTANCE_M) {
      this.commitCurrentSegment();
    }
  }

  // ------------------------------------------------------------------
  // Private — segment management
  // ------------------------------------------------------------------

  private beginNewSegment(): void {
    this.currentSegment = {
      geometry: { type: 'LineString', coordinates: [] },
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      mode: 'walk',
      confidence: 1.0,
    };
    this.segmentLength = 0;
    this.lastCoord = null;
    this.confidenceSum = 0;
    this.confidenceCount = 0;
  }

  /**
   * Finalise the current segment: compute average confidence, persist it
   * to local storage, then start a fresh segment.
   */
  private async commitCurrentSegment(): Promise<void> {
    const segment = this.currentSegment;
    if (!segment || segment.geometry.coordinates.length < 2) {
      // Nothing meaningful to commit.
      this.beginNewSegment();
      return;
    }

    segment.confidence =
      this.confidenceCount > 0
        ? parseFloat((this.confidenceSum / this.confidenceCount).toFixed(2))
        : 1.0;

    try {
      const existing = await this.getPendingTraces();
      existing.push(segment);
      await AsyncStorage.setItem(STORAGE_KEY_PENDING, JSON.stringify(existing));
    } catch (err) {
      console.warn('[TrackingService] Failed to persist segment:', err);
    }

    this.beginNewSegment();
  }

  // ------------------------------------------------------------------
  // Private — auto-upload & app state
  // ------------------------------------------------------------------

  private startAutoUpload(): void {
    if (this.uploadTimer) return;
    this.uploadTimer = setInterval(() => {
      this.uploadPendingTraces();
    }, AUTO_UPLOAD_INTERVAL_MS);
  }

  private stopAutoUpload(): void {
    if (this.uploadTimer) {
      clearInterval(this.uploadTimer);
      this.uploadTimer = null;
    }
  }

  private listenToAppState(): void {
    if (this.appStateSubscription) return;
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          // App foregrounded — flush pending traces.
          this.uploadPendingTraces();
        } else if (nextState === 'background') {
          // Commit the in-progress segment so it is not lost.
          this.commitCurrentSegment();
        }
      },
    );
  }

  private removeAppStateListener(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const trackingService = new TrackingService();
export default trackingService;
