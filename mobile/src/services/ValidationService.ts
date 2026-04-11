/**
 * ValidationService.ts
 *
 * Detects when the user walks along an existing shortcut and triggers
 * a validation prompt. Uses the user's recent GPS path to compute
 * geometric overlap with nearby shortcuts fetched from the API.
 *
 * Singleton pattern: import { validationService } from './ValidationService';
 */

import { tracesApi } from './api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Coordinate {
  lon: number;
  lat: number;
}

interface Shortcut {
  id: string;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lon, lat]
  };
  name?: string;
  [key: string]: any; // allow additional API fields
}

interface ValidationCandidate {
  shortcut: Shortcut;
  overlapRatio: number; // 0.0–1.0
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum overlap ratio to consider a shortcut validated. */
const OVERLAP_THRESHOLD = 0.7;

/** Search radius in metres for nearby shortcuts API call. */
const SEARCH_RADIUS_M = 100;

/**
 * Maximum perpendicular distance (metres) between a user point and a
 * shortcut segment to count as "on" the shortcut.
 */
const SNAP_DISTANCE_M = 15;

// ---------------------------------------------------------------------------
// Haversine helpers
// ---------------------------------------------------------------------------

const R_EARTH = 6_371_000; // metres
const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Haversine distance between two points in metres.
 */
function haversineDistance(a: Coordinate, b: Coordinate): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon;
  return 2 * R_EARTH * Math.asin(Math.sqrt(h));
}

/**
 * Minimum distance from a point to a line segment (A→B) in metres.
 * Uses a flat-earth approximation that is accurate enough at short range.
 */
function pointToSegmentDistance(
  p: Coordinate,
  a: Coordinate,
  b: Coordinate,
): number {
  // Convert to a local Cartesian frame centred on A (metres).
  const cosLat = Math.cos(toRad(a.lat));
  const px = (p.lon - a.lon) * cosLat * (Math.PI / 180) * R_EARTH;
  const py = (p.lat - a.lat) * (Math.PI / 180) * R_EARTH;
  const bx = (b.lon - a.lon) * cosLat * (Math.PI / 180) * R_EARTH;
  const by = (b.lat - a.lat) * (Math.PI / 180) * R_EARTH;

  const segLenSq = bx * bx + by * by;
  if (segLenSq === 0) {
    // Degenerate segment — just return point-to-point distance.
    return Math.sqrt(px * px + py * py);
  }

  // Parameter t clamped to [0,1] gives the closest point on segment.
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / segLenSq));
  const cx = t * bx;
  const cy = t * by;

  return Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
}

/**
 * Total length of a polyline in metres.
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
// ValidationService
// ---------------------------------------------------------------------------

class ValidationService {
  /** Shortcut IDs the user has already been prompted about (in-session). */
  private promptedIds = new Set<string>();

  /** Shortcuts that are currently pending validation prompt. */
  private pendingValidations: ValidationCandidate[] = [];

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /**
   * Query the API for nearby shortcuts and evaluate overlap against the
   * user's recent path. Any shortcut whose overlap exceeds the threshold
   * and has not already been prompted is added to the pending list.
   *
   * @param lat  Current latitude
   * @param lon  Current longitude
   * @param userPath  Array of [lon, lat] coordinates representing the
   *                  user's recent GPS track.
   * @returns Newly discovered validation candidates (if any).
   */
  async checkForNearbyShortcuts(
    lat: number,
    lon: number,
    userPath?: [number, number][],
  ): Promise<ValidationCandidate[]> {
    if (!userPath || userPath.length < 2) {
      return [];
    }

    let shortcuts: Shortcut[];
    try {
      const res = await tracesApi.nearbyShortcuts(lat, lon, SEARCH_RADIUS_M);
      shortcuts = res.data?.shortcuts ?? res.data ?? [];
    } catch (err) {
      console.warn('[ValidationService] Failed to fetch nearby shortcuts:', err);
      return [];
    }

    if (!Array.isArray(shortcuts) || shortcuts.length === 0) {
      return [];
    }

    const newCandidates: ValidationCandidate[] = [];

    for (const shortcut of shortcuts) {
      if (this.promptedIds.has(shortcut.id)) {
        continue; // already prompted this session
      }

      if (
        !shortcut.geometry?.coordinates ||
        shortcut.geometry.coordinates.length < 2
      ) {
        continue;
      }

      const overlap = this.calculateOverlap(
        userPath,
        shortcut.geometry.coordinates,
      );

      if (overlap >= OVERLAP_THRESHOLD) {
        const candidate: ValidationCandidate = {
          shortcut,
          overlapRatio: overlap,
        };
        newCandidates.push(candidate);

        // Avoid duplicates in the pending list.
        if (!this.pendingValidations.some((v) => v.shortcut.id === shortcut.id)) {
          this.pendingValidations.push(candidate);
        }
      }
    }

    return newCandidates;
  }

  /**
   * Calculate what fraction of a shortcut's length is covered by
   * the user's path.
   *
   * Algorithm: for each segment of the shortcut polyline, check whether
   * at least one user-path point is within SNAP_DISTANCE_M. Accumulate
   * the length of matched segments and divide by total shortcut length.
   *
   * @param userPath           Array of [lon, lat] from the user's track.
   * @param shortcutGeometry   Array of [lon, lat] from the shortcut.
   * @returns Overlap ratio (0.0–1.0).
   */
  calculateOverlap(
    userPath: [number, number][],
    shortcutGeometry: [number, number][],
  ): number {
    const totalLength = polylineLength(shortcutGeometry);
    if (totalLength === 0) return 0;

    let matchedLength = 0;

    // Pre-convert user path coordinates for repeated use.
    const userCoords: Coordinate[] = userPath.map(([lon, lat]) => ({
      lon,
      lat,
    }));

    for (let i = 1; i < shortcutGeometry.length; i++) {
      const segA: Coordinate = {
        lon: shortcutGeometry[i - 1][0],
        lat: shortcutGeometry[i - 1][1],
      };
      const segB: Coordinate = {
        lon: shortcutGeometry[i][0],
        lat: shortcutGeometry[i][1],
      };
      const segLen = haversineDistance(segA, segB);

      // Check if any user point is close enough to this shortcut segment.
      const isMatched = userCoords.some(
        (p) => pointToSegmentDistance(p, segA, segB) <= SNAP_DISTANCE_M,
      );

      if (isMatched) {
        matchedLength += segLen;
      }
    }

    return parseFloat((matchedLength / totalLength).toFixed(4));
  }

  /**
   * Return the highest-overlap pending validation candidate, or null.
   */
  getValidationCandidate(): ValidationCandidate | null {
    if (this.pendingValidations.length === 0) return null;
    // Sort descending by overlap and return the best match.
    this.pendingValidations.sort((a, b) => b.overlapRatio - a.overlapRatio);
    return this.pendingValidations[0];
  }

  /**
   * Mark a shortcut as already prompted so the user is not asked again
   * during this session. Also removes it from pending validations.
   */
  markAsPrompted(shortcutId: string): void {
    this.promptedIds.add(shortcutId);
    this.pendingValidations = this.pendingValidations.filter(
      (v) => v.shortcut.id !== shortcutId,
    );
  }

  /**
   * All pending validation candidates the user has not yet been prompted about.
   */
  getPendingValidations(): ValidationCandidate[] {
    return [...this.pendingValidations];
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const validationService = new ValidationService();
export default validationService;
