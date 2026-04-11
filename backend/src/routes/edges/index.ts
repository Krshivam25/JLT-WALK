import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../../config/database.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { parseBbox, edgeCloseSchema } from '../../utils/validation.js';

export default async function edgeRoutes(app: FastifyInstance) {
  app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const { bbox } = request.query as { bbox?: string };
    if (!bbox) { reply.code(400).send({ error: 'bbox parameter required (minLat,minLon,maxLat,maxLon)' }); return; }
    const b = parseBbox(bbox);
    const result = await query(
      `SELECT COUNT(*) as total_edges,
              COUNT(*) FILTER (WHERE sample_count > 2) as verified_edges,
              ROUND(AVG(CASE WHEN sample_count > 0 THEN LEAST(sample_count::float/5, 1) ELSE 0 END)::numeric, 2) as avg_verification,
              (SELECT COUNT(*) FROM edge_observations o JOIN edges e2 ON e2.edge_id = o.edge_id
               WHERE e2.geometry && ST_MakeEnvelope($1,$2,$3,$4,4326)) as total_observations,
              (SELECT COUNT(DISTINCT user_id) FROM edge_observations o JOIN edges e2 ON e2.edge_id = o.edge_id
               WHERE e2.geometry && ST_MakeEnvelope($1,$2,$3,$4,4326) AND user_id IS NOT NULL) as contributor_count
       FROM edges WHERE geometry && ST_MakeEnvelope($1,$2,$3,$4,4326)`,
      [b.minLon, b.minLat, b.maxLon, b.maxLat]
    );
    const r = result.rows[0];
    reply.send({
      total_edges: parseInt(r.total_edges), verified_edges: parseInt(r.verified_edges),
      avg_verification: parseFloat(r.avg_verification), total_observations: parseInt(r.total_observations),
      contributor_count: parseInt(r.contributor_count),
    });
  });

  app.get('/:edgeId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { edgeId } = request.params as { edgeId: string };
    const edgeResult = await query(
      `SELECT edge_id, ST_AsGeoJSON(geometry)::json as geometry, length_m, elevation_gain, stairs_flag, shade_score,
              avg_time_walk, avg_time_run, sample_count, static_estimated_time, last_updated, level,
              is_closed, closure_expiry, closure_reason
       FROM edges WHERE edge_id = $1`, [edgeId]
    );
    if (!edgeResult.rows[0]) { reply.code(404).send({ error: 'Edge not found' }); return; }
    const obsResult = await query(
      `SELECT travel_time_s, speed_mps, mode, accuracy, observed_at
       FROM edge_observations WHERE edge_id = $1 ORDER BY observed_at DESC LIMIT 10`, [edgeId]
    );
    reply.send({ edge: edgeResult.rows[0], recent_observations: obsResult.rows });
  });

  app.post('/close', { preHandler: [requireRole('moderator', 'admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = edgeCloseSchema.parse(request.body);
    await query(
      `UPDATE edges SET is_closed = true, closure_reason = $1, closure_expiry = $2 WHERE edge_id = $3`,
      [body.reason, body.expiry || null, body.edge_id]
    );
    await query(
      `INSERT INTO audit_logs (action, actor_id, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)`,
      ['edge_closed', request.userData!.id, 'edge', String(body.edge_id), JSON.stringify({ reason: body.reason })]
    );
    reply.send({ success: true });
  });

  app.post('/:edgeId/reopen', { preHandler: [requireRole('moderator', 'admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { edgeId } = request.params as { edgeId: string };
    await query(`UPDATE edges SET is_closed = false, closure_reason = null, closure_expiry = null WHERE edge_id = $1`, [edgeId]);
    await query(
      `INSERT INTO audit_logs (action, actor_id, target_type, target_id) VALUES ('edge_reopened', $1, 'edge', $2)`,
      [request.userData!.id, edgeId]
    );
    reply.send({ success: true });
  });
}
