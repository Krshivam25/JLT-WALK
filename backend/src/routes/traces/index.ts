import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../../config/database.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { traceSchema } from '../../utils/validation.js';

export default async function traceRoutes(app: FastifyInstance) {
  // Authenticated trace upload — awards points per 100m walked
  app.post('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = traceSchema.parse(request.body);
    const geojson = JSON.stringify(body.geometry);
    const pointCount = body.geometry.coordinates.length;
    const confidence = (body as any).confidence ?? 1.0;

    let distance = 0;
    const coords = body.geometry.coordinates;
    for (let i = 1; i < coords.length; i++) {
      const [lon1, lat1] = coords[i - 1];
      const [lon2, lat2] = coords[i];
      distance += haversine(lat1, lon1, lat2, lon2);
    }

    const startTime = new Date(body.started_at).getTime();
    const endTime = new Date(body.ended_at).getTime();
    const durationS = (endTime - startTime) / 1000;
    const speed = durationS > 0 ? distance / durationS : 0;
    const isFlagged = speed > 5;
    const flagReason = isFlagged ? `Impossible speed: ${speed.toFixed(2)} m/s` : null;

    const result = await query(
      `INSERT INTO traces (user_id, raw_geojson, point_count, mode, duration_s, distance_m, is_flagged, flag_reason, confidence_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, user_id, uploaded_at, mode, duration_s, distance_m, is_flagged`,
      [request.userData!.id, geojson, pointCount, body.mode, durationS, distance, isFlagged, flagReason, confidence]
    );

    let pointsEarned = 0;
    if (!isFlagged) {
      // Award 1 point per 100m walked
      const distancePoints = Math.floor(distance / 100);
      // Base 10 points for submitting + distance bonus
      pointsEarned = 10 + distancePoints;
      await query('INSERT INTO point_events (user_id, points, reason, reference_id) VALUES ($1, $2, $3, $4)',
        [request.userData!.id, pointsEarned, 'trace_submitted', result.rows[0].id]);
      await query('UPDATE users SET points = points + $1, trust_score = LEAST(trust_score + 0.5, 100) WHERE id = $2',
        [pointsEarned, request.userData!.id]);
    }
    reply.code(201).send({ ...result.rows[0], points_earned: pointsEarned });
  });

  // Batch trace upload — for background tracking
  app.post('/batch', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { traces } = request.body as { traces: any[] };
    if (!traces || !Array.isArray(traces)) {
      reply.code(400).send({ error: 'traces array required' }); return;
    }

    let totalPoints = 0;
    let savedCount = 0;

    for (const t of traces.slice(0, 50)) { // max 50 traces per batch
      try {
        const parsed = traceSchema.parse(t);
        const geojson = JSON.stringify(parsed.geometry);
        const coords = parsed.geometry.coordinates;
        let distance = 0;
        for (let i = 1; i < coords.length; i++) {
          distance += haversine(coords[i-1][1], coords[i-1][0], coords[i][1], coords[i][0]);
        }
        const durationS = (new Date(parsed.ended_at).getTime() - new Date(parsed.started_at).getTime()) / 1000;
        const speed = durationS > 0 ? distance / durationS : 0;
        if (speed > 5) continue; // skip flagged

        await query(
          `INSERT INTO traces (user_id, raw_geojson, point_count, mode, duration_s, distance_m, confidence_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [request.userData!.id, geojson, coords.length, parsed.mode, durationS, distance, (t as any).confidence ?? 1.0]
        );
        const pts = 10 + Math.floor(distance / 100);
        totalPoints += pts;
        savedCount++;
      } catch { /* skip invalid traces */ }
    }

    if (totalPoints > 0) {
      await query('INSERT INTO point_events (user_id, points, reason) VALUES ($1, $2, $3)',
        [request.userData!.id, totalPoints, 'batch_traces']);
      await query('UPDATE users SET points = points + $1, trust_score = LEAST(trust_score + $2, 100) WHERE id = $3',
        [totalPoints, savedCount * 0.5, request.userData!.id]);
    }

    reply.send({ saved: savedCount, points_earned: totalPoints });
  });

  // Get my traces
  app.get('/mine', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit = '20', offset = '0' } = request.query as Record<string, string>;
    const result = await query(
      `SELECT id, raw_geojson as geometry, uploaded_at, mode, duration_s, distance_m, is_flagged
       FROM traces WHERE user_id = $1 ORDER BY uploaded_at DESC LIMIT $2 OFFSET $3`,
      [request.userData!.id, parseInt(limit), parseInt(offset)]
    );
    const cnt = await query('SELECT COUNT(*)::int as total FROM traces WHERE user_id = $1', [request.userData!.id]);
    reply.send({ traces: result.rows, total: cnt.rows[0].total });
  });

  // Anonymous trace upload
  app.post('/anonymous', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = traceSchema.parse(request.body);
    const geojson = JSON.stringify(body.geometry);
    const coords = body.geometry.coordinates;
    let distance = 0;
    for (let i = 1; i < coords.length; i++) {
      distance += haversine(coords[i-1][1], coords[i-1][0], coords[i][1], coords[i][0]);
    }
    const durationS = (new Date(body.ended_at).getTime() - new Date(body.started_at).getTime()) / 1000;
    const result = await query(
      `INSERT INTO traces (raw_geojson, point_count, mode, duration_s, distance_m)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, uploaded_at, mode, duration_s, distance_m`,
      [geojson, coords.length, body.mode, durationS, distance]
    );
    reply.code(201).send(result.rows[0]);
  });

  // Nearby shortcuts for validation detection
  app.get('/nearby-shortcuts', { preHandler: [optionalAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { lat, lon, radius = '100' } = request.query as Record<string, string>;
    if (!lat || !lon) { reply.code(400).send({ error: 'lat and lon required' }); return; }
    const result = await query(
      `SELECT id, user_id, ST_AsGeoJSON(geometry)::json as geometry, name, tags, status,
              trust_score, validation_count, length_m, created_at
       FROM shortcuts
       WHERE ST_DWithin(geometry::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
         AND status != 'deleted'
       ORDER BY trust_score DESC LIMIT 20`,
      [parseFloat(lon), parseFloat(lat), parseInt(radius)]
    );
    reply.send({ shortcuts: result.rows });
  });
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
