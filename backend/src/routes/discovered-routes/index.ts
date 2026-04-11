import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../../config/database.js';
import { authenticate } from '../../middleware/auth.js';
import { parseBbox } from '../../utils/validation.js';

export default async function discoveredRouteRoutes(app: FastifyInstance) {
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { orig_lat, orig_lon, dest_lat, dest_lon } = request.query as Record<string, string>;
    const oLat = parseFloat(orig_lat), oLon = parseFloat(orig_lon);
    const dLat = parseFloat(dest_lat), dLon = parseFloat(dest_lon);
    if ([oLat, oLon, dLat, dLon].some(isNaN)) {
      reply.code(400).send({ error: 'orig_lat, orig_lon, dest_lat, dest_lon required' }); return;
    }
    const result = await query(
      `SELECT id, ST_AsGeoJSON(geometry)::json as geometry,
              ST_Y(origin_point) as origin_lat, ST_X(origin_point) as origin_lon,
              ST_Y(destination_point) as dest_lat, ST_X(destination_point) as dest_lon,
              length_m as distance_m, avg_duration_s as estimated_time_s, endorsement_count, created_at
       FROM discovered_routes
       WHERE ST_DWithin(origin_point::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 500)
         AND ST_DWithin(destination_point::geography, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 500)
         AND status != 'archived'
       ORDER BY endorsement_count DESC`,
      [oLon, oLat, dLon, dLat]
    );
    reply.send({ routes: result.rows });
  });

  app.get('/bbox', async (request: FastifyRequest, reply: FastifyReply) => {
    const { bbox } = request.query as { bbox?: string };
    if (!bbox) { reply.code(400).send({ error: 'bbox query parameter required' }); return; }
    const b = parseBbox(bbox);
    const result = await query(
      `SELECT id, ST_AsGeoJSON(geometry)::json as geometry,
              ST_Y(origin_point) as origin_lat, ST_X(origin_point) as origin_lon,
              ST_Y(destination_point) as dest_lat, ST_X(destination_point) as dest_lon,
              length_m as distance_m, avg_duration_s as estimated_time_s, endorsement_count, created_at
       FROM discovered_routes WHERE geometry && ST_MakeEnvelope($1,$2,$3,$4,4326) AND status != 'archived'
       ORDER BY endorsement_count DESC`,
      [b.minLon, b.minLat, b.maxLon, b.maxLat]
    );
    reply.send({ routes: result.rows });
  });

  app.get('/:routeId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { routeId } = request.params as { routeId: string };
    const result = await query(
      `SELECT id, ST_AsGeoJSON(geometry)::json as geometry,
              ST_Y(origin_point) as origin_lat, ST_X(origin_point) as origin_lon,
              ST_Y(destination_point) as dest_lat, ST_X(destination_point) as dest_lon,
              length_m as distance_m, avg_duration_s as estimated_time_s, endorsement_count,
              name, status, trust_score, shade_score, elevation_gain_m, created_at
       FROM discovered_routes WHERE id = $1`, [routeId]
    );
    if (!result.rows[0]) { reply.code(404).send({ error: 'Route not found' }); return; }
    reply.send(result.rows[0]);
  });

  app.post('/:routeId/endorse', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { routeId } = request.params as { routeId: string };
    const route = await query('SELECT id FROM discovered_routes WHERE id = $1', [routeId]);
    if (!route.rows[0]) { reply.code(404).send({ error: 'Route not found' }); return; }
    try {
      await query('INSERT INTO route_endorsements (route_id, user_id) VALUES ($1, $2)', [routeId, request.userData!.id]);
      await query('UPDATE discovered_routes SET endorsement_count = COALESCE(endorsement_count, 0) + 1 WHERE id = $1', [routeId]);
      reply.send({ success: true });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') { reply.code(409).send({ error: 'Already endorsed' }); return; }
      throw err;
    }
  });
}
