import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../../config/database.js';
import { authenticate } from '../../middleware/auth.js';
import { preferencesSchema } from '../../utils/validation.js';

export default async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.put('/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    const prefs = preferencesSchema.parse(request.body);
    await query('UPDATE users SET prefs = prefs || $1::jsonb, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(prefs), request.userData!.id]);
    reply.send({ success: true, preferences: prefs });
  });

  app.post('/export', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.userData!.id;
    const [user, traces, pins, points] = await Promise.all([
      query('SELECT id, email, role, prefs, points, created_at FROM users WHERE id = $1', [userId]),
      query('SELECT id, raw_geojson as geometry, uploaded_at, mode, distance_m FROM traces WHERE user_id = $1', [userId]),
      query('SELECT pin_id, ST_Y(geometry) as lat, ST_X(geometry) as lon, type, name, created_at FROM pins WHERE user_id = $1', [userId]),
      query('SELECT points, reason, created_at FROM point_events WHERE user_id = $1 ORDER BY created_at', [userId]),
    ]);
    reply.send({ user: user.rows[0], traces: traces.rows, pins: pins.rows, points_log: points.rows, exported_at: new Date().toISOString() });
  });

  app.delete('/data', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.userData!.id;
    await query('DELETE FROM verifications WHERE user_id = $1', [userId]);
    await query('DELETE FROM point_events WHERE user_id = $1', [userId]);
    await query('DELETE FROM user_badges WHERE user_id = $1', [userId]);
    await query('UPDATE traces SET user_id = NULL WHERE user_id = $1', [userId]);
    await query('UPDATE pins SET user_id = NULL WHERE user_id = $1', [userId]);
    await query('DELETE FROM users WHERE id = $1', [userId]);
    reply.send({ success: true, message: 'All user data deleted' });
  });

  app.get('/points', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await query('SELECT points FROM users WHERE id = $1', [request.userData!.id]);
    const pts = result.rows[0]?.points || 0;
    const level = Math.floor(pts / 100) + 1;
    reply.send({ points: pts, level, next_level_at: level * 100 });
  });

  app.get('/points/recent', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await query(
      'SELECT id, points, reason, created_at FROM point_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [request.userData!.id]
    );
    reply.send({ entries: result.rows });
  });

  app.get('/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.userData!.id;
    const [user, traceStats, pinCount, badgeCount] = await Promise.all([
      query('SELECT id, email, role, prefs, points, created_at FROM users WHERE id = $1', [userId]),
      query('SELECT COUNT(*)::int as count, COALESCE(SUM(distance_m),0) as total_distance FROM traces WHERE user_id = $1 AND NOT is_flagged', [userId]),
      query('SELECT COUNT(*)::int as count FROM pins WHERE user_id = $1', [userId]),
      query('SELECT COUNT(*)::int as count FROM user_badges WHERE user_id = $1', [userId]),
    ]);
    reply.send({
      ...user.rows[0],
      stats: { traces: traceStats.rows[0].count, total_distance_m: parseFloat(traceStats.rows[0].total_distance), pins: pinCount.rows[0].count, badges: badgeCount.rows[0].count },
    });
  });

  app.get('/badges', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await query(
      `SELECT b.id, b.name, b.description, b.icon_url, ub.earned_at
       FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = $1 ORDER BY ub.earned_at DESC`,
      [request.userData!.id]
    );
    reply.send({ badges: result.rows });
  });
}
