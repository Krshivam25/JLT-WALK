/**
 * Map-Matching Service
 *
 * Closes the self-learning loop:
 *   trace uploaded → snap GPS points to edges → create observations → update edge weights
 *
 * Uses PostGIS spatial queries to match trace points to the nearest edge within 30m,
 * groups consecutive points by edge, calculates travel times, and updates the
 * running weighted average with 90-day temporal decay.
 */

import { query } from '../config/database.js';

// --- Tunable constants ---
const SNAP_DISTANCE_M = 30;        // Max meters from edge to accept a GPS point
const MIN_FRACTION_COVERED = 0.3;   // Min fraction of edge that must be traversed
const MIN_SPEED_MPS = 0.3;          // Below this = standing still
const MAX_SPEED_MPS = 3.0;          // Above this = running/GPS glitch (for walk mode)
const DECAY_HALF_LIFE_DAYS = 90;    // Temporal decay half-life in days

interface MatchedSegment {
  edgeId: number;
  lengthM: number;
  entryFraction: number;
  exitFraction: number;
  entryTime: number;   // seconds from trace start
  exitTime: number;
}

/**
 * Process a single trace: map-match to edges, create observations, update weights.
 * Designed to be called synchronously after trace insert — fast on a 52-edge graph.
 */
export async function processTrace(traceId: string): Promise<{ matched: number; observations: number }> {
  // 1. Load trace
  const traceResult = await query(
    `SELECT id, user_id, raw_geojson, duration_s, distance_m, is_flagged, processed, mode, confidence_score
     FROM traces WHERE id = $1`, [traceId]
  );
  const trace = traceResult.rows[0];
  if (!trace) return { matched: 0, observations: 0 };
  if (trace.is_flagged || trace.processed) return { matched: 0, observations: 0 };

  // Parse geometry
  let geojson: { type: string; coordinates: number[][] };
  try {
    geojson = typeof trace.raw_geojson === 'string' ? JSON.parse(trace.raw_geojson) : trace.raw_geojson;
  } catch {
    return { matched: 0, observations: 0 };
  }

  const coords = geojson?.coordinates;
  if (!coords || coords.length < 2) return { matched: 0, observations: 0 };

  const confidence = trace.confidence_score ?? 0.8;
  const durationS = trace.duration_s || 0;
  if (durationS <= 0) return { matched: 0, observations: 0 };

  // 2. Interpolate timestamps proportional to cumulative distance
  const distances: number[] = [0];
  let totalDist = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
    totalDist += d;
    distances.push(totalDist);
  }
  if (totalDist <= 0) return { matched: 0, observations: 0 };

  const timestamps = distances.map(d => (d / totalDist) * durationS);

  // 3. Map-match each point to nearest edge
  const pointMatches: { edgeId: number; fraction: number; lengthM: number; time: number }[] = [];

  for (let i = 0; i < coords.length; i++) {
    const [lon, lat] = coords[i];
    const matchResult = await query(
      `SELECT edge_id, length_m,
              ST_LineLocatePoint(geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS fraction,
              ST_Distance(geometry::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS dist_m
       FROM edges
       WHERE ST_DWithin(geometry::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
         AND NOT is_closed
       ORDER BY dist_m ASC
       LIMIT 1`,
      [lon, lat, SNAP_DISTANCE_M]
    );

    if (matchResult.rows[0]) {
      pointMatches.push({
        edgeId: matchResult.rows[0].edge_id,
        fraction: parseFloat(matchResult.rows[0].fraction),
        lengthM: matchResult.rows[0].length_m,
        time: timestamps[i],
      });
    }
  }

  if (pointMatches.length < 2) return { matched: 0, observations: 0 };

  // 4. Group consecutive points by edge_id
  const segments: MatchedSegment[] = [];
  let currentEdge = pointMatches[0].edgeId;
  let entryFraction = pointMatches[0].fraction;
  let entryTime = pointMatches[0].time;
  let lastFraction = entryFraction;
  let lastTime = entryTime;
  let edgeLengthM = pointMatches[0].lengthM;

  for (let i = 1; i < pointMatches.length; i++) {
    const pm = pointMatches[i];
    if (pm.edgeId === currentEdge) {
      // Same edge — extend segment
      lastFraction = pm.fraction;
      lastTime = pm.time;
    } else {
      // Edge changed — commit segment
      segments.push({
        edgeId: currentEdge,
        lengthM: edgeLengthM,
        entryFraction,
        exitFraction: lastFraction,
        entryTime,
        exitTime: lastTime,
      });
      // Start new segment
      currentEdge = pm.edgeId;
      entryFraction = pm.fraction;
      entryTime = pm.time;
      lastFraction = pm.fraction;
      lastTime = pm.time;
      edgeLengthM = pm.lengthM;
    }
  }
  // Commit final segment
  segments.push({
    edgeId: currentEdge,
    lengthM: edgeLengthM,
    entryFraction,
    exitFraction: lastFraction,
    entryTime,
    exitTime: lastTime,
  });

  // 5. Calculate per-edge travel time and create observations
  let observationsCreated = 0;
  const updatedEdges = new Set<number>();

  for (const seg of segments) {
    const fractionCovered = Math.abs(seg.exitFraction - seg.entryFraction);
    if (fractionCovered < MIN_FRACTION_COVERED) continue;

    const elapsedS = seg.exitTime - seg.entryTime;
    if (elapsedS <= 0) continue;

    const effectiveLength = fractionCovered * seg.lengthM;
    const speed = effectiveLength / elapsedS;

    // Filter by speed bounds (walk mode)
    if (trace.mode === 'walk' && (speed < MIN_SPEED_MPS || speed > MAX_SPEED_MPS)) continue;
    if (trace.mode === 'run' && (speed < MIN_SPEED_MPS || speed > 6.0)) continue;

    // Extrapolate to full-edge travel time
    const fullEdgeTime = elapsedS / fractionCovered;

    // 6. Insert observation
    try {
      await query(
        `INSERT INTO edge_observations (edge_id, travel_time_s, speed_mps, mode, accuracy, observed_at, user_id, trace_id)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
        [seg.edgeId, fullEdgeTime, speed, trace.mode, confidence, trace.user_id, traceId]
      );
      observationsCreated++;
      updatedEdges.add(seg.edgeId);
    } catch {
      // Duplicate or constraint violation — skip
    }
  }

  // 7. Update edge weights for all affected edges
  for (const edgeId of updatedEdges) {
    await updateEdgeWeight(edgeId, trace.mode);
  }

  // 8. Mark trace as processed
  await query('UPDATE traces SET processed = true WHERE id = $1', [traceId]);

  return { matched: segments.length, observations: observationsCreated };
}

/**
 * Update an edge's avg_time using confidence-weighted average with temporal decay.
 * Recent observations count more than old ones (90-day half-life).
 */
async function updateEdgeWeight(edgeId: number, mode: string): Promise<void> {
  const timeField = mode === 'run' ? 'avg_time_run' : 'avg_time_walk';
  const decaySeconds = DECAY_HALF_LIFE_DAYS * 86400;

  await query(
    `UPDATE edges SET
       ${timeField} = subq.weighted_avg,
       sample_count = subq.total_count,
       last_updated = NOW()
     FROM (
       SELECT
         COALESCE(
           SUM(travel_time_s * accuracy * EXP(-EXTRACT(EPOCH FROM (NOW() - observed_at)) / $2))
           / NULLIF(SUM(accuracy * EXP(-EXTRACT(EPOCH FROM (NOW() - observed_at)) / $2)), 0),
           ${timeField}
         ) AS weighted_avg,
         COUNT(*) AS total_count
       FROM edge_observations
       WHERE edge_id = $1 AND mode = $3
     ) AS subq
     WHERE edge_id = $1`,
    [edgeId, decaySeconds, mode]
  );
}

/**
 * Batch-process all unprocessed traces. Useful for backfilling.
 */
export async function processUnmatchedTraces(limit = 100): Promise<number> {
  const result = await query(
    `SELECT id FROM traces WHERE processed = false AND is_flagged = false ORDER BY uploaded_at ASC LIMIT $1`,
    [limit]
  );
  let count = 0;
  for (const row of result.rows) {
    try {
      const r = await processTrace(row.id);
      if (r.observations > 0) count++;
    } catch { /* skip failed traces */ }
  }
  return count;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
