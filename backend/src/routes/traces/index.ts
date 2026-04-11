import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../../config/database.js';
import { authenticate } from '../../middleware/auth.js';
import { traceSchema } from '../../utils/validation.js';

export default async function traceRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = traceSchema.parse(request.body);
    const geojson = JSON.stringify(body.geometry);
    const pointCount = body.geometry.coordinates.length;

    // Calculate distance from coordinates
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
      `INSERT INTO traces (user_id, raw_geojson, point_count, mode, duration_s, distance_m, is_flagged, flag_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id, uploaded_at, mode, duration_s, distance_m, is_flagged`,
      [request.userData!.id, geojson, pointCount, body.mode, durationS, distance, isFlagged, flagReason]
    );

    if (!isFlagged) {
      await query('INSERT INTO point_events (user_id, points, reason) VALUES ($1, 10, $2)', [request.userData!.id, 'trace_submitted']);
      await query('UPDATE users SET points = points + 10 WHERE id = $1', [request.userData!.id]);
    }
    reply.code(201).send(result.rows[0]);
  });

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

  app.post('/anonymous', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = traceSchema.parse(request.body);
    const geojson = JSON.stringify(body.geometry);
    const pointCount = body.geometry.coordinates.length;
    const coords = body.geometry.coordinates;
    let distance = 0;
    for (let i = 1; i < coords.length; i++) {
      const [lon1, lat1] = coords[i - 1];
      const [lon2, lat2] = coords[i];
      distance += haversine(lat1, lon1, lat2, lon2);
    }
    const durationS = (new Date(body.ended_at).getTime() - new Date(body.started_at).getTime()) / 1000;

    const result = await query(
      `INSERT INTO traces (raw_geojson, point_count, mode, duration_s, distance_m)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, uploaded_at, mode, duration_s, distance_m`,
      [geojson, pointCount, body.mode, durationS, distance]
    );
    reply.code(201).send(result.rows[0]);
  });
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
