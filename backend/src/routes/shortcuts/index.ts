import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../../config/database.js';
import { authenticate } from '../../middleware/auth.js';
import { parseBbox } from '../../utils/validation.js';
import { z } from 'zod';

const createShortcutSchema = z.object({
  geometry: z.object({ type: z.literal('LineString'), coordinates: z.array(z.array(z.number())) }),
  name: z.string().min(1).max(200),
  tags: z.array(z.enum(['stairs', 'shaded', 'fastest', 'indoor', 'risky', 'scenic', 'accessible'])).optional(),
  description: z.string().max(500).optional(),
});

const validateSchema = z.object({
  result: z.enum(['valid', 'invalid']),
  notes: z.string().max(500).optional(),
});

export default async function shortcutRoutes(app: FastifyInstance) {
  // Create shortcut with tags + duplicate detection
  app.post('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createShortcutSchema.parse(request.body);
    const geojson = JSON.stringify(body.geometry);

    // Check for duplicate (>80% overlap with existing)
    const overlapCheck = await query(
      `SELECT id, name, ST_AsGeoJSON(geometry)::json as geometry FROM shortcuts
       WHERE status != 'deleted'
         AND ST_DWithin(geometry, ST_GeomFromGeoJSON($1), 0.0002)
       LIMIT 1`, [geojson]
    );
    if (overlapCheck.rows.length > 0) {
      reply.code(409).send({
        error: 'Duplicate shortcut',
        message: `Similar shortcut "${overlapCheck.rows[0].name}" already exists nearby`,
        existing_id: overlapCheck.rows[0].id,
      });
      return;
    }

    // Rate limit: max 5 shortcuts per day per user
    const todayCount = await query(
      `SELECT COUNT(*)::int as cnt FROM shortcuts WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 day' AND status != 'deleted'`,
      [request.userData!.id]
    );
    if (todayCount.rows[0].cnt >= 5) {
      reply.code(429).send({ error: 'Limit reached', message: 'You can add up to 5 shortcuts per day' });
      return;
    }

    const lenResult = await query(`SELECT ST_Length(ST_Transform(ST_GeomFromGeoJSON($1), 3857)) as length_m`, [geojson]);
    const length = lenResult.rows[0]?.length_m || 0;
    const tags = body.tags || [];

    const result = await query(
      `INSERT INTO shortcuts (user_id, geometry, name, length_m, tags)
       VALUES ($1, ST_GeomFromGeoJSON($2), $3, $4, $5)
       RETURNING id, user_id, ST_AsGeoJSON(geometry)::json as geometry, name, status, length_m, tags, trust_score, validation_count, created_at`,
      [request.userData!.id, geojson, body.name, length, tags]
    );

    // Award 50 points for adding shortcut
    await query('INSERT INTO point_events (user_id, points, reason, reference_id) VALUES ($1, 50, $2, $3)',
      [request.userData!.id, 'shortcut_added', result.rows[0].id]);
    await query('UPDATE users SET points = points + 50, shortcuts_added = shortcuts_added + 1 WHERE id = $1',
      [request.userData!.id]);

    reply.code(201).send({ ...result.rows[0], points_earned: 50 });
  });

  // List shortcuts in bbox
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { bbox } = request.query as { bbox?: string };
    if (!bbox) { reply.code(400).send({ error: 'bbox query parameter required' }); return; }
    const b = parseBbox(bbox);
    const result = await query(
      `SELECT id, user_id, ST_AsGeoJSON(geometry)::json as geometry, name, tags, status,
              trust_score, validation_count, length_m, created_at
       FROM shortcuts
       WHERE geometry && ST_MakeEnvelope($1,$2,$3,$4,4326) AND status != 'deleted'
       ORDER BY trust_score DESC, created_at DESC`,
      [b.minLon, b.minLat, b.maxLon, b.maxLat]
    );
    reply.send({ shortcuts: result.rows });
  });

  // Get shortcut detail
  app.get('/:shortcutId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { shortcutId } = request.params as { shortcutId: string };
    const result = await query(
      `SELECT s.id, s.user_id, ST_AsGeoJSON(s.geometry)::json as geometry, s.name, s.tags, s.status,
              s.trust_score, s.validation_count, s.length_m, s.created_at
       FROM shortcuts s WHERE s.id = $1`, [shortcutId]
    );
    if (!result.rows[0]) { reply.code(404).send({ error: 'Shortcut not found' }); return; }

    // Get validations
    const validations = await query(
      `SELECT sv.user_id, sv.created_at FROM shortcut_validations sv
       WHERE sv.shortcut_id = $1 ORDER BY sv.created_at DESC LIMIT 20`, [shortcutId]
    );

    reply.send({ ...result.rows[0], validations: validations.rows });
  });

  // Validate shortcut with trust score calculation
  app.post('/:shortcutId/validate', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { shortcutId } = request.params as { shortcutId: string };
    const body = validateSchema.parse(request.body || { result: 'valid' });

    const sc = await query('SELECT id, trust_score, validation_count, user_id, status FROM shortcuts WHERE id = $1', [shortcutId]);
    if (!sc.rows[0]) { reply.code(404).send({ error: 'Shortcut not found' }); return; }

    // Can't validate own shortcut
    if (sc.rows[0].user_id === request.userData!.id) {
      reply.code(403).send({ error: 'Cannot validate your own shortcut' }); return;
    }

    try {
      await query('INSERT INTO shortcut_validations (shortcut_id, user_id) VALUES ($1, $2)',
        [shortcutId, request.userData!.id]);

      // Trust score calculation: valid=+2, invalid=-3, unique user bonus=+1
      const isValid = body.result === 'valid';
      const scoreDelta = isValid ? 2 : -3;
      const uniqueBonus = 1; // bonus for each unique validator

      const newTrustScore = sc.rows[0].trust_score + scoreDelta + uniqueBonus;
      const newValidationCount = sc.rows[0].validation_count + (isValid ? 1 : 0);

      // Determine status based on trust score
      let newStatus = sc.rows[0].status;
      if (newTrustScore > 10) newStatus = 'verified';
      else if (newTrustScore < -5) newStatus = 'flagged';
      else if (newStatus === 'flagged' && newTrustScore >= 0) newStatus = 'pending';

      await query(
        `UPDATE shortcuts SET trust_score = $1, validation_count = $2, status = $3, updated_at = NOW() WHERE id = $4`,
        [newTrustScore, newValidationCount, newStatus, shortcutId]
      );

      // Auto-create edge from verified shortcut
      if (newStatus === 'verified' && sc.rows[0].status !== 'verified') {
        try {
          const shortcutData = await query(
            `SELECT ST_AsText(geometry) as geom_text, ST_AsGeoJSON(geometry)::json as geom_json, length_m, tags
             FROM shortcuts WHERE id = $1`, [shortcutId]
          );
          const sd = shortcutData.rows[0];
          if (sd) {
            // Check no edge already exists within 10m of this shortcut
            const existing = await query(
              `SELECT edge_id FROM edges
               WHERE ST_DWithin(geometry::geography, ST_GeomFromGeoJSON($1)::geography, 10)
               LIMIT 1`, [JSON.stringify(sd.geom_json)]
            );
            if (!existing.rows[0]) {
              const tags = sd.tags || [];
              const stairsFlag = tags.includes('stairs');
              const shadeScore = tags.includes('shaded') ? 0.7 : 0.3;
              const newEdge = await query(
                `INSERT INTO edges (geometry, length_m, stairs_flag, shade_score, static_estimated_time, source)
                 VALUES (ST_GeomFromGeoJSON($1), $2, $3, $4, $5, 'shortcut')
                 RETURNING edge_id`,
                [JSON.stringify(sd.geom_json), sd.length_m, stairsFlag, shadeScore, sd.length_m / 1.4]
              );
              await query('UPDATE shortcuts SET edge_id = $1 WHERE id = $2', [newEdge.rows[0].edge_id, shortcutId]);
            }
          }
        } catch (e) { /* log but don't fail validation */ }
      }

      // Points for validator
      const isFirstValidator = sc.rows[0].validation_count === 0;
      let validatorPoints = isValid ? 10 : 5; // points for validating
      if (isFirstValidator) validatorPoints += 20; // bonus for first validator
      if (newStatus === 'verified' && sc.rows[0].status !== 'verified') validatorPoints += 100; // bonus for triggering verification

      await query('INSERT INTO point_events (user_id, points, reason, reference_id) VALUES ($1, $2, $3, $4)',
        [request.userData!.id, validatorPoints, 'shortcut_validated', shortcutId]);
      await query('UPDATE users SET points = points + $1, validations_done = validations_done + 1, trust_score = LEAST(trust_score + 1, 100) WHERE id = $2',
        [validatorPoints, request.userData!.id]);

      reply.send({
        success: true,
        validation_count: newValidationCount,
        trust_score: newTrustScore,
        status: newStatus,
        points_earned: validatorPoints,
        first_validator: isFirstValidator,
      });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        reply.code(409).send({ error: 'Already validated this shortcut' }); return;
      }
      throw err;
    }
  });

  // Check overlap for duplicate prevention
  app.get('/check-overlap', async (request: FastifyRequest, reply: FastifyReply) => {
    const { geometry } = request.query as { geometry?: string };
    if (!geometry) { reply.code(400).send({ error: 'geometry parameter required' }); return; }
    const result = await query(
      `SELECT id, name, trust_score, status,
              ST_AsGeoJSON(geometry)::json as geometry
       FROM shortcuts WHERE status != 'deleted'
         AND ST_DWithin(geometry, ST_GeomFromGeoJSON($1), 0.0002)
       LIMIT 5`, [geometry]
    );
    reply.send({ overlapping: result.rows, has_overlap: result.rows.length > 0 });
  });

  // Delete shortcut
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
