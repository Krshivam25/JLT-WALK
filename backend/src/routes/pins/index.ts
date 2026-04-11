import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../../config/database.js';
import { authenticate } from '../../middleware/auth.js';
import { pinSchema, parseBbox } from '../../utils/validation.js';

export default async function pinRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = pinSchema.parse(request.body);
    const result = await query(
      `INSERT INTO pins (user_id, geometry, type, name, photo_url, meta)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6, $7)
       RETURNING pin_id, user_id, ST_Y(geometry) as lat, ST_X(geometry) as lon, type, name, photo_url, verification_count, created_at`,
      [request.userData!.id, body.lon, body.lat, body.type, body.title, body.photo_url || null,
       JSON.stringify({ description: body.description || '' })]
    );
    await query('INSERT INTO point_events (user_id, points, reason) VALUES ($1, 5, $2)', [request.userData!.id, 'pin_created']);
    await query('UPDATE users SET points = points + 5 WHERE id = $1', [request.userData!.id]);
    reply.code(201).send(result.rows[0]);
  });

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { bbox } = request.query as { bbox?: string };
    if (!bbox) { reply.code(400).send({ error: 'bbox query parameter required' }); return; }
    const b = parseBbox(bbox);
    const result = await query(
      `SELECT pin_id as id, user_id, ST_Y(geometry) as lat, ST_X(geometry) as lon, type, name as title,
              meta->>'description' as description, photo_url, verification_count as verified_count, created_at
       FROM pins WHERE geometry && ST_MakeEnvelope($1, $2, $3, $4, 4326) AND public_flag = true
       ORDER BY created_at DESC`,
      [b.minLon, b.minLat, b.maxLon, b.maxLat]
    );
    reply.send({ pins: result.rows });
  });

  app.get('/:pinId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { pinId } = request.params as { pinId: string };
    const result = await query(
      `SELECT pin_id as id, user_id, ST_Y(geometry) as lat, ST_X(geometry) as lon, type, name as title,
              meta->>'description' as description, photo_url, verification_count as verified_count, created_at
       FROM pins WHERE pin_id = $1`, [pinId]
    );
    if (!result.rows[0]) { reply.code(404).send({ error: 'Pin not found' }); return; }
    reply.send(result.rows[0]);
  });

  app.delete('/:pinId', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { pinId } = request.params as { pinId: string };
    const pin = await query('SELECT user_id FROM pins WHERE pin_id = $1', [pinId]);
    if (!pin.rows[0]) { reply.code(404).send({ error: 'Pin not found' }); return; }
    if (pin.rows[0].user_id !== request.userData!.id && !['moderator', 'admin'].includes(request.userData!.role)) {
      reply.code(403).send({ error: 'Not authorized' }); return;
    }
    await query('DELETE FROM pins WHERE pin_id = $1', [pinId]);
    reply.send({ success: true });
  });

  app.post('/:pinId/verify', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { pinId } = request.params as { pinId: string };
    const pin = await query('SELECT pin_id FROM pins WHERE pin_id = $1', [pinId]);
    if (!pin.rows[0]) { reply.code(404).send({ error: 'Pin not found' }); return; }
    try {
      await query('INSERT INTO verifications (pin_id, user_id, result) VALUES ($1, $2, $3)', [pinId, request.userData!.id, 'usable']);
      await query('UPDATE pins SET verification_count = verification_count + 1 WHERE pin_id = $1', [pinId]);
      await query('INSERT INTO point_events (user_id, points, reason) VALUES ($1, 2, $2)', [request.userData!.id, 'pin_verified']);
      await query('UPDATE users SET points = points + 2 WHERE id = $1', [request.userData!.id]);
      reply.send({ success: true });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') { reply.code(409).send({ error: 'Already verified' }); return; }
      throw err;
    }
  });
}
