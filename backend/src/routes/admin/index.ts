import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../../config/database.js';
import { requireRole } from '../../middleware/auth.js';

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('moderator', 'admin'));

  app.get('/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    const [users, traces, pins, edges, observations] = await Promise.all([
      query('SELECT COUNT(*)::int as count FROM users'),
      query('SELECT COUNT(*)::int as count FROM traces'),
      query('SELECT COUNT(*)::int as count FROM pins'),
      query('SELECT COUNT(*)::int as count FROM edges'),
      query('SELECT COUNT(*)::int as count FROM edge_observations'),
    ]);
    reply.send({
      users: users.rows[0].count, traces: traces.rows[0].count, pins: pins.rows[0].count,
      edges: edges.rows[0].count, observations: observations.rows[0].count,
    });
  });

  app.get('/flagged-traces', async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit = '20', offset = '0' } = request.query as Record<string, string>;
    const result = await query(
      `SELECT t.id, t.user_id, t.uploaded_at, t.mode, t.distance_m, t.flag_reason
       FROM traces t WHERE t.is_flagged = true ORDER BY t.uploaded_at DESC LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );
    reply.send({ traces: result.rows });
  });

  app.get('/moderation/pins', async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit = '20', offset = '0' } = request.query as Record<string, string>;
    const result = await query(
      `SELECT pin_id as id, user_id, ST_Y(geometry) as lat, ST_X(geometry) as lon,
              type, name as title, verification_count, created_at
       FROM pins ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );
    reply.send({ pins: result.rows });
  });

  app.get('/closures', async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await query(
      `SELECT edge_id, closure_reason as reason, closure_expiry
       FROM edges WHERE is_closed = true ORDER BY last_updated DESC`
    );
    reply.send({ closures: result.rows });
  });

  app.get('/users', async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit = '20', offset = '0', search = '' } = request.query as Record<string, string>;
    let sql = 'SELECT id, email, role, points, created_at FROM users';
    const params: unknown[] = [];
    if (search) { sql += ' WHERE email ILIKE $1'; params.push(`%${search}%`); }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    const result = await query(sql, params);
    const cnt = await query('SELECT COUNT(*)::int as total FROM users');
    reply.send({ users: result.rows, total: cnt.rows[0].total });
  });

  app.get('/audit-log', async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit = '50', offset = '0' } = request.query as Record<string, string>;
    const result = await query(
      `SELECT id, action, actor_id, target_type, target_id, details, created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );
    reply.send({ entries: result.rows });
  });
}
