import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../../config/database.js';
import { authenticate } from '../../middleware/auth.js';
import { shortcutSchema, parseBbox } from '../../utils/validation.js';

export default async function shortcutRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = shortcutSchema.parse(request.body);
    const geojson = JSON.stringify(body.geometry);
    // Calculate length
    const lenResult = await query(`SELECT ST_Length(ST_Transform(ST_GeomFromGeoJSON($1), 3857)) as length_m`, [geojson]);
    const length = lenResult.rows[0]?.length_m || 0;
    const result = await query(
      `INSERT INTO shortcuts (user_id, geometry, name, length_m)
       VALUES ($1, ST_GeomFromGeoJSON($2), $3, $4)
       RETURNING id, user_id, ST_AsGeoJSON(geometry)::json as geometry, name, status, length_m, validation_count, created_at`,
      [request.userData!.id, geojson, body.name, length]
    );
    await query('INSERT INTO point_events (user_id, points, reason) VALUES ($1, 20, $2)', [request.userData!.id, 'shortcut_submitted']);
    await query('UPDATE users SET points = points + 20, shortcuts_added = shortcuts_added + 1 WHERE id = $1', [request.userData!.id]);
    reply.code(201).send(result.rows[0]);
  });

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { bbox } = request.query as { bbox?: string };
    if (!bbox) { reply.code(400).send({ error: 'bbox query parameter required' }); return; }
    const b = parseBbox(bbox);
    const result = await query(
      `SELECT id, user_id, ST_AsGeoJSON(geometry)::json as geometry, name, status, length_m, validation_count, created_at
       FROM shortcuts WHERE geometry && ST_MakeEnvelope($1,$2,$3,$4,4326) AND status != 'deleted' ORDER BY created_at DESC`,
      [b.minLon, b.minLat, b.maxLon, b.maxLat]
    );
    reply.send({ shortcuts: result.rows });
  });

  app.post('/:shortcutId/validate', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { shortcutId } = request.params as { shortcutId: string };
    const sc = await query('SELECT id FROM shortcuts WHERE id = $1', [shortcutId]);
    if (!sc.rows[0]) { reply.code(404).send({ error: 'Shortcut not found' }); return; }
    try {
      await query('INSERT INTO shortcut_validations (shortcut_id, user_id) VALUES ($1, $2)', [shortcutId, request.userData!.id]);
      const cnt = await query(
        `UPDATE shortcuts SET validation_count = validation_count + 1, status = CASE WHEN validation_count + 1 >= 3 THEN 'verified' ELSE status END, updated_at = NOW()
         WHERE id = $1 RETURNING validation_count, status`,
        [shortcutId]
      );
      await query('UPDATE users SET validations_done = validations_done + 1 WHERE id = $1', [request.userData!.id]);
      reply.send({ success: true, ...cnt.rows[0] });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') { reply.code(409).send({ error: 'Already validated' }); return; }
      throw err;
    }
  });

  app.get('/check-overlap', async (request: FastifyRequest, reply: FastifyReply) => {
    const { geometry } = request.query as { geometry?: string };
    if (!geometry) { reply.code(400).send({ error: 'geometry parameter required' }); return; }
    const result = await query(
      `SELECT edge_id, ST_AsGeoJSON(e.geometry)::json as geometry, length_m
       FROM edges e WHERE ST_DWithin(e.geometry, ST_GeomFromGeoJSON($1), 0.0001)`, [geometry]
    );
    reply.send({ overlapping_edges: result.rows, has_overlap: result.rows.length > 0 });
  });

  app.delete('/:shortcutId', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { shortcutId } = request.params as { shortcutId: string };
    const sc = await query('SELECT user_id FROM shortcuts WHERE id = $1', [shortcutId]);
    if (!sc.rows[0]) { reply.code(404).send({ error: 'Shortcut not found' }); return; }
    if (sc.rows[0].user_id !== request.userData!.id && !['moderator', 'admin'].includes(request.userData!.role)) {
      reply.code(403).send({ error: 'Not authorized' }); return;
    }
    await query("UPDATE shortcuts SET status = 'deleted' WHERE id = $1", [shortcutId]);
    reply.send({ success: true });
  });
}
